/**
 * MediaPipePoseAdapter.ts
 * SwingSwang – Pose Engine
 *
 * Implements PoseEngine using the MediaPipe Pose Landmarker native module.
 * Maps 33 MediaPipe landmarks → 17 COCO keypoints for canonical PoseFrame,
 * preserving all 33 in typed extendedLandmarks.
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '../../types/pose';
import {
  detectImage as mpDetectImage,
  processVideo as mpProcessVideo,
  isAvailable as mpIsAvailable,
  release as mpRelease,
  type MediaPipeModelVariant,
  type MediaPipeFrameResult,
  type MediaPipeVideoResult,
} from '../../../modules/mediapipe-pose';
import { mapPoseOutputToFrame, RawKeypoint } from './landmarkMapper';

/** MediaPipe 33 → COCO 17 landmark index mapping. */
const MP_TO_COCO_MAPPING: ReadonlyMap<number, number> = new Map([
  [0, 0],   // NOSE
  [2, 1],   // LEFT_EYE
  [5, 2],   // RIGHT_EYE
  [7, 3],   // LEFT_EAR
  [8, 4],   // RIGHT_EAR
  [11, 5],  // LEFT_SHOULDER
  [12, 6],  // RIGHT_SHOULDER
  [13, 7],  // LEFT_ELBOW
  [14, 8],  // RIGHT_ELBOW
  [15, 9],  // LEFT_WRIST
  [16, 10], // RIGHT_WRIST
  [23, 11], // LEFT_HIP
  [24, 12], // RIGHT_HIP
  [25, 13], // LEFT_KNEE
  [26, 14], // RIGHT_KNEE
  [27, 15], // LEFT_ANKLE
  [28, 16], // RIGHT_ANKLE
]);

export class MediaPipePoseAdapter implements PoseEngine {
  readonly name = 'MediaPipe';
  readonly version = '1.0.0';
  readonly landmarkCount = 17; // COCO subset

  private modelVariant: MediaPipeModelVariant;

  constructor(modelVariant: MediaPipeModelVariant = 'lite') {
    this.modelVariant = modelVariant;
  }

  async initialize(): Promise<void> {
    const available = await mpIsAvailable(this.modelVariant);
    if (!available) {
      throw new Error(
        `MediaPipe Pose Landmarker not available for variant '${this.modelVariant}'. ` +
        'Ensure the .task model file is present in the build assets. ' +
        'Run scripts/download-models.sh to download models.'
      );
    }
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number,
    width?: number,
    height?: number
  ): Promise<PoseFrame | null> {
    const result = await mpDetectImage(imageUri, this.modelVariant);

    if (!result.landmarks || result.landmarks.length === 0) {
      return null;
    }

    return mapMediaPipeResultToFrame(
      result,
      timestamp,
      frameIndex,
      width ?? 1,
      height ?? 1
    );
  }

  /**
   * Process an entire video natively with frame-accurate timestamps.
   * Uses MediaExtractor + MediaCodec on Android for real decode timestamps.
   */
  async processVideoNative(
    videoUri: string,
    targetFps: number,
    maxFrames?: number
  ): Promise<{ frames: PoseFrame[]; videoResult: MediaPipeVideoResult }> {
    const videoResult = await mpProcessVideo(videoUri, this.modelVariant, {
      targetFps,
      maxFrames,
    });

    const frames: PoseFrame[] = [];
    for (let i = 0; i < videoResult.frames.length; i++) {
      const mpFrame = videoResult.frames[i];
      if (mpFrame.landmarks.length === 0) continue;

      const frame = mapMediaPipeResultToFrame(
        mpFrame,
        mpFrame.timestampMs / 1000, // Convert ms → seconds for PoseFrame
        i,
        1, // Normalized coordinates — dimensions not needed
        1
      );
      frames.push(frame);
    }

    return { frames, videoResult };
  }

  dispose(): void {
    mpRelease().catch(() => {});
  }
}

/**
 * Map a single MediaPipe frame result to a canonical PoseFrame.
 * Preserves all 33 landmarks in extendedLandmarks.
 */
function mapMediaPipeResultToFrame(
  result: MediaPipeFrameResult,
  timestamp: number,
  frameIndex: number,
  width: number,
  height: number
): PoseFrame {
  const mpLandmarks = result.landmarks;

  // Map 33 → 17 COCO keypoints
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
        score: Math.min(lm.visibility, lm.presence),
      };
    }
  }

  // MediaPipe returns normalized coordinates (0-1)
  const frame = mapPoseOutputToFrame(
    cocoKeypoints,
    timestamp,
    frameIndex,
    width,
    height,
    false // already normalized
  );

  return {
    ...frame,
    processingTimeMs: result.inferenceDurationMs,
    extendedLandmarks: mpLandmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility,
      presence: lm.presence,
    })),
  };
}

// Re-export mapping for testing
export { MP_TO_COCO_MAPPING, mapMediaPipeResultToFrame };
