/**
 * ExecuTorchPoseAdapter.ts
 * SwingSwang – Pose Engine
 *
 * Real pose estimation adapter using react-native-executorch.
 * Maps ExecuTorch PoseEstimationModule output to our PoseEngine interface.
 *
 * REQUIRES:
 * - react-native-executorch installed
 * - Development Build (not Expo Go)
 * - New Architecture enabled (Expo SDK 57 default)
 *
 * LICENSE WARNING:
 * YOLO26N_POSE model weights are AGPL-3.0 licensed (Ultralytics).
 * A commercial Enterprise License is required for closed-source distribution.
 * See docs/phase1/P1_POSE_ARCHITECTURE_DECISION.md for details.
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '@/types/pose';
import { LandmarkID, PoseLandmark, LANDMARK_COUNT } from '@/types/landmarks';
import { RawKeypoint, mapPoseOutputToFrame } from './landmarkMapper';
import { Logger, PerformanceTimer } from '@/utils/logger';

// ─── ExecuTorch Types ───────────────────────────────────────────────

/**
 * Keypoint names from ExecuTorch YOLO pose model output.
 * Maps to COCO 17-keypoint format — same order as our LandmarkID enum.
 */
const EXECUTORCH_KEYPOINT_NAMES = [
  'NOSE',
  'LEFT_EYE',
  'RIGHT_EYE',
  'LEFT_EAR',
  'RIGHT_EAR',
  'LEFT_SHOULDER',
  'RIGHT_SHOULDER',
  'LEFT_ELBOW',
  'RIGHT_ELBOW',
  'LEFT_WRIST',
  'RIGHT_WRIST',
  'LEFT_HIP',
  'RIGHT_HIP',
  'LEFT_KNEE',
  'RIGHT_KNEE',
  'LEFT_ANKLE',
  'RIGHT_ANKLE',
] as const;

/** Shape of a single keypoint from ExecuTorch. */
interface ExecuTorchKeypoint {
  readonly x: number;
  readonly y: number;
}

/** Shape of a detection from ExecuTorch PoseEstimationModule.forward(). */
type ExecuTorchDetection = {
  readonly [key: string]: ExecuTorchKeypoint;
};

// ─── Adapter ────────────────────────────────────────────────────────

/**
 * Real pose engine using react-native-executorch PoseEstimationModule.
 *
 * Loads the YOLO26N_POSE model and runs inference on JPEG/PNG file URIs.
 * Returns PoseFrames with 17 COCO landmarks in normalized coordinates.
 */
export class ExecuTorchPoseAdapter implements PoseEngine {
  readonly name = 'ExecuTorch-YOLO26N';
  readonly version = '1.0.0';
  readonly landmarkCount = LANDMARK_COUNT;

  private module: any = null; // PoseEstimationModule instance
  private initialized = false;

  /** Default inference thresholds. */
  private readonly detectionThreshold: number;
  private readonly keypointThreshold: number;

  constructor(options?: {
    detectionThreshold?: number;
    keypointThreshold?: number;
  }) {
    this.detectionThreshold = options?.detectionThreshold ?? 0.5;
    this.keypointThreshold = options?.keypointThreshold ?? 0.3;
  }

  async initialize(): Promise<void> {
    const timer = new PerformanceTimer('ExecuTorchPoseAdapter.initialize');

    try {
      // Dynamic import — only available in Development Builds
      const executorch = require('react-native-executorch');
      const { PoseEstimationModule, YOLO26N_POSE } = executorch;

      if (!PoseEstimationModule) {
        throw new Error(
          'PoseEstimationModule not found in react-native-executorch. ' +
          'Ensure the package is correctly installed and you are running a Development Build.'
        );
      }

      Logger.pose.info('Loading YOLO26N_POSE model...');
      this.module = await PoseEstimationModule.fromModelName(YOLO26N_POSE);
      this.initialized = true;

      const elapsed = timer.stop();
      Logger.pose.info(`ExecuTorch model loaded in ${elapsed.toFixed(0)}ms`);
    } catch (error) {
      timer.stop();
      const msg = error instanceof Error ? error.message : String(error);
      Logger.pose.error('Failed to initialize ExecuTorch', { error: msg });
      throw new Error(`ExecuTorch initialization failed: ${msg}`);
    }
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number
  ): Promise<PoseFrame | null> {
    if (!this.initialized || !this.module) {
      Logger.pose.warn('ExecuTorchPoseAdapter not initialized');
      return null;
    }

    const timer = new PerformanceTimer('ExecuTorchPoseAdapter.analyzeFrame');

    try {
      // Run inference
      const detections: ExecuTorchDetection[] = await this.module.forward(
        imageUri,
        {
          detectionThreshold: this.detectionThreshold,
          keypointThreshold: this.keypointThreshold,
        }
      );

      const processingTimeMs = timer.stop();

      // No person detected
      if (!detections || detections.length === 0) {
        Logger.pose.debug(`No person detected in frame ${frameIndex}`);
        return null;
      }

      // Use first detection (primary person in frame)
      const detection = detections[0];

      // Map ExecuTorch keypoints to our RawKeypoint format
      const keypoints = this.mapDetectionToKeypoints(detection);

      // Use mapPoseOutputToFrame from landmarkMapper
      // ExecuTorch outputs pixel coordinates, but we don't know the image
      // dimensions from the detection itself. The keypoints are in the
      // model's input resolution space. We pass them as normalized (0-1)
      // if they appear to already be normalized, or as pixel coords
      // with estimated dimensions.
      //
      // ExecuTorch YOLO models output pixel coordinates relative to
      // the input image dimensions. Default inputSize is 384.
      // However, the exact behavior depends on the model version.
      // We'll detect the coordinate range and handle accordingly.
      const maxX = Math.max(...keypoints.filter(k => k.x >= 0).map(k => k.x), 0);
      const maxY = Math.max(...keypoints.filter(k => k.y >= 0).map(k => k.y), 0);

      // If max values are > 2, assume pixel coordinates
      const isPixelCoords = maxX > 2 || maxY > 2;

      let poseFrame: PoseFrame;
      if (isPixelCoords) {
        // Snaps to standard ExecuTorch model input resolutions to prevent aspect ratio skewing
        let estimatedWidth = 384;
        let estimatedHeight = 384;
        const maxVal = Math.max(maxX, maxY);

        if (maxVal > 384 && maxVal <= 640) {
          estimatedWidth = 640;
          estimatedHeight = 640;
        } else if (maxVal > 640) {
          // Fallback if model output dimensions are larger (e.g. 960 or actual original image scale)
          estimatedWidth = Math.ceil(maxVal * 1.05);
          estimatedHeight = Math.ceil(maxVal * 1.05);
        }

        poseFrame = mapPoseOutputToFrame(
          keypoints,
          timestamp,
          frameIndex,
          estimatedWidth,
          estimatedHeight,
          true // pixel coords → normalize
        );
      } else {
        // Already normalized (0-1)
        poseFrame = mapPoseOutputToFrame(
          keypoints,
          timestamp,
          frameIndex,
          1, 1, // dummy dimensions for normalized coords
          false // already normalized
        );
      }

      // Override processingTimeMs (mapPoseOutputToFrame sets it to 0)
      return {
        ...poseFrame,
        processingTimeMs,
      };
    } catch (error) {
      timer.stop();
      const msg = error instanceof Error ? error.message : String(error);
      Logger.pose.error(`Frame ${frameIndex} analysis failed`, { error: msg });
      return null;
    }
  }

  dispose(): void {
    this.module = null;
    this.initialized = false;
    Logger.pose.info('ExecuTorchPoseAdapter disposed');
  }

  /**
   * Map ExecuTorch detection object to RawKeypoint array.
   * ExecuTorch returns named keypoints (NOSE, LEFT_EYE, etc.).
   * We map them to indexed array matching COCO 17-keypoint order.
   *
   * Keypoints with (-1, -1) are below threshold — treated as score 0.
   */
  private mapDetectionToKeypoints(detection: ExecuTorchDetection): RawKeypoint[] {
    return EXECUTORCH_KEYPOINT_NAMES.map((name) => {
      const kp = detection[name];

      if (!kp || (kp.x === -1 && kp.y === -1)) {
        // Below threshold — mark as undetected
        return { x: 0, y: 0, score: 0 };
      }

      // ExecuTorch doesn't provide per-keypoint confidence scores
      // in the detection object — only x,y. We use a fixed high
      // confidence since the model already filtered by keypointThreshold.
      return {
        x: kp.x,
        y: kp.y,
        score: 0.85, // Assumed confidence for detected keypoints
      };
    });
  }
}
