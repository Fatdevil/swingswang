/**
 * MediaPipeWebPoseEngine.ts
 * SwingSwang – Pose Engine
 *
 * WebAssembly-based MediaPipe Pose Landmarker for Web (Chrome / Safari / Firefox).
 * Enables genuine pose tracking directly in the browser without requiring native mobile builds!
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '../../types/pose';
import { MediaPipeModelVariant } from './types';
import { mapPoseOutputToFrame, RawKeypoint } from './landmarkMapper';
import { MP_TO_COCO_MAPPING } from './MediaPipePoseAdapter';
import { Logger, PerformanceTimer } from '@/utils/logger';

type WebPoseResult = {
  landmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number; presence?: number }>>;
};

interface WebPoseLandmarker {
  detect(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): WebPoseResult;
  detectForVideo(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, timestampMs: number): WebPoseResult;
  close(): void;
}

/** Gap inserted on the MediaPipe clock when a new, unrelated sequence starts. */
const NEW_SEQUENCE_GAP_MS = 1000;

/**
 * Maps media timestamps (seconds) to the strictly increasing millisecond clock
 * MediaPipe VIDEO mode requires. Consecutive frames keep their real spacing so
 * the tracker sees true inter-frame timing; a timestamp that does not advance
 * (a new clip, or a one-off photo analyzed with timestamp 0) starts a new
 * sequence after a gap instead of throwing.
 */
export function createVideoClock(): (timestampSec: number) => number {
  let lastInputMs = -Infinity;
  let lastClockMs = -Infinity;
  // Clock value and media time at the start of the current sequence; anchoring
  // to it (rather than summing rounded deltas) keeps the clock drift-free.
  let sequenceStartClockMs = 0;
  let sequenceStartInputMs = 0;

  return (timestampSec: number) => {
    const inputMs = timestampSec * 1000;
    if (inputMs <= lastInputMs) {
      sequenceStartClockMs = lastClockMs + NEW_SEQUENCE_GAP_MS;
      sequenceStartInputMs = inputMs;
    } else if (lastInputMs === -Infinity) {
      sequenceStartInputMs = inputMs;
    }
    const clockMs = Math.max(
      lastClockMs + 1,
      sequenceStartClockMs + Math.round(inputMs - sequenceStartInputMs),
    );
    lastInputMs = inputMs;
    lastClockMs = clockMs;
    return clockMs;
  };
}

export class MediaPipeWebPoseEngine implements PoseEngine {
  readonly name = 'MediaPipeWeb';
  readonly version = '0.10.18';
  readonly landmarkCount = 17; // COCO subset canonical

  private modelVariant: MediaPipeModelVariant;
  private landmarker: WebPoseLandmarker | null = null;
  private initialized = false;
  private nextVideoTimestampMs = createVideoClock();

  constructor(modelVariant: MediaPipeModelVariant = 'lite') {
    this.modelVariant = modelVariant;
  }

  async initialize(): Promise<void> {
    if (this.initialized && this.landmarker) return;

    const timer = new PerformanceTimer('MediaPipeWeb.init');
    Logger.pose.info(`Initializing MediaPipe WebAssembly PoseLandmarker (variant: ${this.modelVariant})...`);

    if (typeof window === 'undefined') {
      throw new Error('MediaPipeWebPoseEngine requires a browser environment with window/DOM support.');
    }

    // Load tasks-vision via browser dynamic import to avoid Metro's static AST transform crash
    const dynamicImport = new Function('url', 'return import(url)');
    const tasksVision = await dynamicImport('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm');
    const { FilesetResolver, PoseLandmarker } = tasksVision;

    const wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    const modelAssetPath = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${this.modelVariant}/float16/1/pose_landmarker_${this.modelVariant}.task`;

    // Try GPU acceleration first, fall back to CPU if WebGL/WebGPU is unavailable
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'GPU',
        },
        // VIDEO mode tracks the golfer from the previous frame's landmarks
        // instead of re-detecting from scratch each frame, which keeps the
        // skeleton on the body through the fast, blurred downswing.
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      Logger.pose.info('MediaPipe WebAssembly initialized with GPU delegate');
    } catch (gpuError) {
      Logger.pose.warn('Failed to initialize with GPU delegate, falling back to CPU', { error: String(gpuError) });
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      Logger.pose.info('MediaPipe WebAssembly initialized with CPU delegate');
    }

    this.initialized = true;
    const elapsed = timer.stop();
    Logger.pose.info(`MediaPipe WebAssembly ready in ${elapsed.toFixed(0)}ms`);
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number,
    width?: number,
    height?: number
  ): Promise<PoseFrame | null> {
    if (!this.initialized || !this.landmarker) {
      throw new Error('MediaPipeWebPoseEngine must be initialized before analyzing frames.');
    }

    const timer = new PerformanceTimer('MediaPipeWeb.analyzeFrame');

    let imageElement: HTMLImageElement;
    if (typeof document !== 'undefined') {
      imageElement = new Image();
      imageElement.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve();
        imageElement.onerror = (e) => reject(new Error(`Failed to load image for pose analysis at frame ${frameIndex}: ${String(e)}`));
        imageElement.src = imageUri;
      });
    } else {
      return null;
    }

    const detection = this.landmarker.detectForVideo(imageElement, this.nextVideoTimestampMs(timestamp));
    const inferenceTimeMs = timer.stop();

    if (!detection.landmarks || detection.landmarks.length === 0 || detection.landmarks[0].length === 0) {
      return null;
    }

    const mpLandmarks = detection.landmarks[0];

    // Map 33 MediaPipe landmarks to 17 COCO keypoints
    const cocoKeypoints: RawKeypoint[] = new Array(17);
    for (let i = 0; i < 17; i++) {
      cocoKeypoints[i] = { x: 0, y: 0, score: 0 };
    }

    for (const [mpIndex, cocoIndex] of MP_TO_COCO_MAPPING) {
      if (mpIndex < mpLandmarks.length) {
        const lm = mpLandmarks[mpIndex];
        cocoKeypoints[cocoIndex] = {
          x: lm.x,
          y: lm.y,
          score: Math.min(lm.visibility ?? 0.9, 1.0),
        };
      }
    }

    const sourceWidth = width ?? imageElement.naturalWidth ?? 640;
    const sourceHeight = height ?? imageElement.naturalHeight ?? 480;

    const frame = mapPoseOutputToFrame(
      cocoKeypoints,
      timestamp,
      frameIndex,
      sourceWidth,
      sourceHeight,
      false // normalized coordinates
    );

    return {
      ...frame,
      processingTimeMs: inferenceTimeMs,
      extendedLandmarks: mpLandmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 0.9,
        presence: 1.0,
      })),
    };
  }

  dispose(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (e) {
        Logger.pose.warn('Error closing MediaPipe PoseLandmarker', { error: String(e) });
      }
      this.landmarker = null;
    }
    this.initialized = false;
  }
}
