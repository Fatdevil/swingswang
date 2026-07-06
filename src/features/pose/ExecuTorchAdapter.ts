/**
 * ExecuTorchAdapter.ts
 * SwingSwang
 *
 * ExecuTorch pose estimation adapter + MockPoseEngine for development.
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '../../types/pose';
import { LandmarkID, PoseLandmark, LANDMARK_COUNT } from '../../types/landmarks';
import { Logger, PerformanceTimer } from '../../utils/logger';

// ─── ExecuTorch Adapter ─────────────────────────────────────────────

/**
 * ExecuTorch-based pose engine.
 * Requires react-native-executorch native module (Development Build only).
 * Falls back to MockPoseEngine in development.
 */
export class ExecuTorchAdapter implements PoseEngine {
  readonly name = 'ExecuTorch';
  readonly version = '0.9.0';
  readonly landmarkCount = LANDMARK_COUNT;

  private initialized = false;

  async initialize(): Promise<void> {
    Logger.pose.info('ExecuTorch adapter: initialize called');
    // In a real build, this would load the YOLO pose model via react-native-executorch
    // For Phase 0 on Windows/dev, this is a no-op
    this.initialized = true;
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number
  ): Promise<PoseFrame | null> {
    if (!this.initialized) {
      Logger.pose.warn('ExecuTorch not initialized');
      return null;
    }

    const timer = new PerformanceTimer('ExecuTorch.analyzeFrame');

    try {
      // In a real Development Build, this would call:
      // const result = await executorchModule.forward(imageUri);
      // For now, delegate to mock
      Logger.pose.debug(`Analyzing frame ${frameIndex} at ${timestamp.toFixed(3)}s`, { imageUri });

      // Placeholder — real implementation requires native module
      const processingTimeMs = timer.stop();
      return null;
    } catch (error) {
      Logger.pose.error('Frame analysis failed', { error: String(error) });
      timer.stop();
      return null;
    }
  }

  dispose(): void {
    this.initialized = false;
    Logger.pose.info('ExecuTorch adapter disposed');
  }
}

// ─── Mock Pose Engine ───────────────────────────────────────────────

/** Base pose positions for a standing golfer (normalized 0–1 coordinates). */
const BASE_POSE: Array<[LandmarkID, number, number]> = [
  [LandmarkID.nose, 0.500, 0.150],
  [LandmarkID.leftEye, 0.485, 0.133],
  [LandmarkID.rightEye, 0.515, 0.133],
  [LandmarkID.leftEar, 0.465, 0.142],
  [LandmarkID.rightEar, 0.535, 0.142],
  [LandmarkID.leftShoulder, 0.400, 0.280],
  [LandmarkID.rightShoulder, 0.600, 0.280],
  [LandmarkID.leftElbow, 0.350, 0.420],
  [LandmarkID.rightElbow, 0.650, 0.420],
  [LandmarkID.leftWrist, 0.380, 0.530],
  [LandmarkID.rightWrist, 0.620, 0.530],
  [LandmarkID.leftHip, 0.430, 0.580],
  [LandmarkID.rightHip, 0.570, 0.580],
  [LandmarkID.leftKnee, 0.420, 0.740],
  [LandmarkID.rightKnee, 0.580, 0.740],
  [LandmarkID.leftAnkle, 0.415, 0.900],
  [LandmarkID.rightAnkle, 0.585, 0.900],
];

/**
 * Mock pose engine that generates realistic synthetic golf swing data.
 * Used for development/testing without native modules.
 */
export class MockPoseEngine implements PoseEngine {
  readonly name = 'MockPoseEngine';
  readonly version = '1.0.0';
  readonly landmarkCount = LANDMARK_COUNT;

  private initialized = false;
  private swingDuration = 3.0; // typical swing duration

  async initialize(): Promise<void> {
    Logger.pose.info('MockPoseEngine: initialized');
    this.initialized = true;
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number
  ): Promise<PoseFrame | null> {
    if (!this.initialized) return null;

    const timer = new PerformanceTimer('MockPoseEngine.analyzeFrame');

    // Simulate processing delay (10-30ms)
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));

    const landmarks = this.generateSwingPose(timestamp, frameIndex);
    const processingTimeMs = timer.stop();

    const confidences = Array.from(landmarks.values()).map(l => l.confidence);
    const avgConfidence = confidences.reduce((s, c) => s + c, 0) / confidences.length;

    return {
      timestamp,
      frameIndex,
      landmarks,
      averageConfidence: avgConfidence,
      detectedCount: landmarks.size,
      missingCount: LANDMARK_COUNT - landmarks.size,
      sourceWidth: 1080,
      sourceHeight: 1920,
      processingTimeMs,
    };
  }

  dispose(): void {
    this.initialized = false;
  }

  /** Generate a swing-like pose for a given timestamp. */
  private generateSwingPose(
    timestamp: number,
    _frameIndex: number
  ): Map<LandmarkID, PoseLandmark> {
    const map = new Map<LandmarkID, PoseLandmark>();

    // Swing phase (0–1 through the swing)
    const phase = Math.min(timestamp / this.swingDuration, 1.0);

    // Swing motion model:
    // 0.0–0.2: Address (still)
    // 0.2–0.5: Backswing (rotation)
    // 0.5–0.7: Downswing + Impact
    // 0.7–1.0: Follow-through

    for (const [id, baseX, baseY] of BASE_POSE) {
      let dx = 0;
      let dy = 0;

      if (phase < 0.2) {
        // Address — very small natural movement
        dx = (Math.random() - 0.5) * 0.003;
        dy = (Math.random() - 0.5) * 0.002;
      } else if (phase < 0.5) {
        // Backswing
        const backswingProgress = (phase - 0.2) / 0.3;
        const isUpperBody = id <= LandmarkID.rightWrist;
        const isLeftSide = [
          LandmarkID.leftEye, LandmarkID.leftEar, LandmarkID.leftShoulder,
          LandmarkID.leftElbow, LandmarkID.leftWrist, LandmarkID.leftHip,
          LandmarkID.leftKnee, LandmarkID.leftAnkle,
        ].includes(id);

        if (isUpperBody) {
          // Upper body rotates in backswing
          dx = -backswingProgress * 0.04 * (isLeftSide ? 1.2 : 0.8);
          dy = -backswingProgress * 0.01;
        }
        // Head stays relatively still
        if (id === LandmarkID.nose || id === LandmarkID.leftEye || id === LandmarkID.rightEye) {
          dx *= 0.3;
        }
      } else if (phase < 0.7) {
        // Downswing + impact
        const downswingProgress = (phase - 0.5) / 0.2;
        const isUpperBody = id <= LandmarkID.rightWrist;

        if (isUpperBody) {
          dx = (downswingProgress * 0.06 - 0.04);
          dy = downswingProgress * 0.005;
        }
        // Hips shift slightly toward target
        if (id === LandmarkID.leftHip || id === LandmarkID.rightHip) {
          dx = downswingProgress * 0.025;
        }
      } else {
        // Follow-through
        const followProgress = (phase - 0.7) / 0.3;
        const isUpperBody = id <= LandmarkID.rightWrist;

        if (isUpperBody) {
          dx = 0.02 + followProgress * 0.03;
          dy = -followProgress * 0.02;
        }
      }

      // Add small random noise (natural body movement)
      dx += (Math.random() - 0.5) * 0.002;
      dy += (Math.random() - 0.5) * 0.002;

      // Confidence: high for most landmarks, slightly lower for extremities
      let confidence = 0.85 + Math.random() * 0.12;
      if (id === LandmarkID.leftWrist || id === LandmarkID.rightWrist) {
        confidence -= 0.05; // wrists move fast, slightly lower confidence
      }
      if (id === LandmarkID.leftAnkle || id === LandmarkID.rightAnkle) {
        confidence -= 0.03; // ankles sometimes occluded
      }

      map.set(id, {
        id,
        x: Math.max(0, Math.min(1, baseX + dx)),
        y: Math.max(0, Math.min(1, baseY + dy)),
        visibility: confidence,
        confidence,
      });
    }

    return map;
  }
}

/**
 * Create the appropriate pose engine based on environment.
 * In development (no native modules), returns MockPoseEngine.
 * In a real build, would return ExecuTorchAdapter.
 */
export function createPoseEngine(): PoseEngine {
  // For Phase 0, always use MockPoseEngine since ExecuTorch requires
  // a Development Build with native modules.
  // TODO: Detect native module availability and use ExecuTorchAdapter when available.
  Logger.pose.info('Creating MockPoseEngine (development mode)');
  return new MockPoseEngine();
}
