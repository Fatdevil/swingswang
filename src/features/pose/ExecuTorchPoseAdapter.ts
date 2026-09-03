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
    frameIndex: number,
    imageWidth?: number,
    imageHeight?: number
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

      // Select primary person from detections using area, center-distance, and keypoint count (Finding 10)
      const detection = this.selectPrimaryDetection(detections, imageWidth, imageHeight);

      // Map ExecuTorch keypoints to our RawKeypoint format
      const keypoints = this.mapDetectionToKeypoints(detection);

      // Check max coordinates to detect if output is pixel vs normalized (Finding 3)
      const maxX = Math.max(...keypoints.filter(k => k.x >= 0).map(k => k.x), 0);
      const maxY = Math.max(...keypoints.filter(k => k.y >= 0).map(k => k.y), 0);

      const isPixelCoords = maxX > 2 || maxY > 2;

      let poseFrame: PoseFrame;
      if (isPixelCoords) {
        // If imageWidth/imageHeight are available, use actual image resolution for normalization
        // to preserve exact aspect ratio (Finding 3)
        let frameWidth = imageWidth;
        let frameHeight = imageHeight;

        if (!frameWidth || !frameHeight) {
          // If frame dimensions were not provided, infer from max coordinate bounds without forcing square snapping
          const maxDim = Math.max(maxX, maxY);
          frameWidth = maxDim > 640 ? maxDim * 1.05 : 640;
          frameHeight = maxDim > 640 ? maxDim * 1.05 : 640;
        }

        const normalizedFrame = mapPoseOutputToFrame(
          keypoints,
          timestamp,
          frameIndex,
          frameWidth,
          frameHeight,
          true // pixel coords → normalize
        );

        poseFrame = {
          ...normalizedFrame,
          sourceWidth: frameWidth,
          sourceHeight: frameHeight,
        };
      } else {
        // Already normalized (0-1)
        poseFrame = mapPoseOutputToFrame(
          keypoints,
          timestamp,
          frameIndex,
          imageWidth ?? 1,
          imageHeight ?? 1,
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
   * Select primary person detection (Finding 10).
   * Ranks candidates by bounding box area, valid keypoints, and proximity to frame center.
   */
  private selectPrimaryDetection(
    detections: ExecuTorchDetection[],
    imageWidth?: number,
    imageHeight?: number
  ): ExecuTorchDetection {
    if (detections.length === 1) return detections[0];

    let bestDetection = detections[0];
    let bestScore = -1;

    for (const det of detections) {
      let validKpCount = 0;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      for (const name of EXECUTORCH_KEYPOINT_NAMES) {
        const kp = det[name];
        if (kp && kp.x !== -1 && kp.y !== -1) {
          validKpCount++;
          if (kp.x < minX) minX = kp.x;
          if (kp.x > maxX) maxX = kp.x;
          if (kp.y < minY) minY = kp.y;
          if (kp.y > maxY) maxY = kp.y;
        }
      }

      if (validKpCount === 0) continue;

      const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
      // Normalized center distance heuristic if dimensions known
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const refW = imageWidth || (maxX > 2 ? 640 : 1.0);
      const refH = imageHeight || (maxY > 2 ? 640 : 1.0);
      const distFromCenter = Math.hypot((centerX / refW) - 0.5, (centerY / refH) - 0.5);

      // Score combines keypoint count (weight 0.4), area (weight 0.4), center proximity (weight 0.2)
      const compositeScore = (validKpCount / 17) * 0.4 + Math.min(1, area / (refW * refH || 1)) * 0.4 + (1 - Math.min(1, distFromCenter)) * 0.2;

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestDetection = det;
      }
    }

    return bestDetection;
  }

  /**
   * Map ExecuTorch detection object to RawKeypoint array.
   * Handles per-keypoint confidence if available from model output;
   * otherwise uses conservative provisional confidence flag (Finding 3).
   */
  private mapDetectionToKeypoints(detection: ExecuTorchDetection): RawKeypoint[] {
    return EXECUTORCH_KEYPOINT_NAMES.map((name) => {
      const kp = detection[name] as any;

      if (!kp || (kp.x === -1 && kp.y === -1)) {
        // Below threshold — mark as undetected
        return { x: 0, y: 0, score: 0 };
      }

      // Check if native module provided actual keypoint score/confidence (Finding 3)
      const rawScore = typeof kp.score === 'number' ? kp.score : typeof kp.confidence === 'number' ? kp.confidence : null;
      const score = rawScore !== null ? Math.min(1.0, Math.max(0.0, rawScore)) : 0.70; // Conservative fallback score if model score unavailable

      return {
        x: kp.x,
        y: kp.y,
        score,
      };
    });
  }
}
