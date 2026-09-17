/**
 * MockPoseEngine.ts
 * SwingSwang – Pose Engine
 *
 * Synthetic swing pose generator for development and testing.
 * Generates realistic-looking (but completely fabricated) pose data
 * based on a 4-phase golf swing model.
 *
 * IMPORTANT: This engine ignores actual image content entirely.
 * It must NEVER be used silently in production — only via
 * explicit PoseEngineConfig { mode: 'MOCK' }.
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '@/types/pose';
import { LandmarkID, PoseLandmark, LANDMARK_COUNT } from '@/types/landmarks';
import { Logger, PerformanceTimer } from '@/utils/logger';

// ─── Base Pose ──────────────────────────────────────────────────────

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

// ─── Mock Pose Engine ───────────────────────────────────────────────

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
  private firstTimestamp: number | null = null;

  async initialize(): Promise<void> {
    Logger.pose.info('MockPoseEngine: initialized');
    this.initialized = true;
    this.firstTimestamp = null;
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number,
    width?: number,
    height?: number
  ): Promise<PoseFrame | null> {
    if (!this.initialized) return null;

    const timer = new PerformanceTimer('MockPoseEngine.analyzeFrame');

    // Simulate processing delay (10-30ms)
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));

    if (this.firstTimestamp === null) {
      this.firstTimestamp = timestamp;
    }
    const relativeTime = Math.max(0, timestamp - this.firstTimestamp);

    const landmarks = this.generateSwingPose(relativeTime, frameIndex);
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
      sourceWidth: width ?? 1080,
      sourceHeight: height ?? 1920,
      processingTimeMs,
    };
  }

  dispose(): void {
    this.initialized = false;
    this.firstTimestamp = null;
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
    // Swing motion model:
    // 0.00–0.20: Address (still setup posture)
    // 0.20–0.65: Backswing (arms ascend to top of backswing)
    // 0.65–0.78: Downswing & Impact (rapid descent to impact)
    // 0.78–1.00: Follow-through (finish pose)

    for (const [id, baseX, baseY] of BASE_POSE) {
      let dx = 0;
      let dy = 0;

      const isWrist = id === LandmarkID.leftWrist || id === LandmarkID.rightWrist;
      const isElbow = id === LandmarkID.leftElbow || id === LandmarkID.rightElbow;
      const isShoulder = id === LandmarkID.leftShoulder || id === LandmarkID.rightShoulder;
      const isHip = id === LandmarkID.leftHip || id === LandmarkID.rightHip;
      const isHead = id === LandmarkID.nose || id === LandmarkID.leftEye || id === LandmarkID.rightEye || id === LandmarkID.leftEar || id === LandmarkID.rightEar;

      if (phase < 0.20) {
        // Address — very small natural micro-sway
        dx = (Math.random() - 0.5) * 0.002;
        dy = (Math.random() - 0.5) * 0.002;
      } else if (phase < 0.65) {
        // Backswing (takeaway -> top): hands move trail-side (+X) and up (-Y)
        const backProgress = (phase - 0.20) / 0.45;
        if (isWrist) {
          dx = backProgress * 0.16;
          dy = -backProgress * 0.32; // wrists lift from 0.53 to 0.21 (top of backswing)
        } else if (isElbow) {
          dx = backProgress * 0.10;
          dy = -backProgress * 0.20;
        } else if (isShoulder) {
          dx = (id === LandmarkID.leftShoulder ? 1 : -1) * 0.03 * backProgress + backProgress * 0.02;
          dy = (id === LandmarkID.leftShoulder ? 0.02 : -0.02) * backProgress;
        } else if (isHip) {
          dx = backProgress * 0.015;
        } else if (isHead) {
          dx = backProgress * 0.008;
        }
      } else if (phase < 0.78) {
        // Downswing to impact (rapid acceleration toward target / lead-side -X and down +Y)
        const downProgress = (phase - 0.65) / 0.13;
        if (isWrist) {
          dx = 0.16 - downProgress * 0.18; // sweeps down to impact point
          dy = -0.32 + downProgress * 0.32; // descends rapidly back to impact height (0.53)
        } else if (isElbow) {
          dx = 0.10 - downProgress * 0.12;
          dy = -0.20 + downProgress * 0.20;
        } else if (isShoulder) {
          dx = (0.5 - downProgress) * 0.04;
          dy = (downProgress - 0.5) * 0.02;
        } else if (isHip) {
          dx = 0.015 - downProgress * 0.03; // hip bump toward target
        }
      } else {
        // Follow-through & finish: hands sweep up (-Y) and target-side (-X)
        const followProgress = (phase - 0.78) / 0.22;
        if (isWrist) {
          dx = -0.02 - followProgress * 0.18;
          dy = -followProgress * 0.33; // finishes high at target side
        } else if (isElbow) {
          dx = -followProgress * 0.12;
          dy = -followProgress * 0.22;
        } else if (isShoulder) {
          dx = -followProgress * 0.04;
          dy = -followProgress * 0.02;
        } else if (isHip) {
          dx = -0.015 - followProgress * 0.015;
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
