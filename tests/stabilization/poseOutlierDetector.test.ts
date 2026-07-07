/**
 * poseOutlierDetector.test.ts
 * Tests for velocity-based single-frame spike outlier detection.
 */

import { LandmarkID } from '@/types/landmarks';
import { detectOutliers } from '@/features/stabilization/PoseOutlierDetector';
import { createTestPoseFrame } from '../helpers/poseFixtures';

describe('PoseOutlierDetector – detectOutliers', () => {
  const THRESHOLD = 0.15;

  it('detects a single-frame spike (jump + return)', () => {
    // Frame 0: nose at default (0.50, 0.12)
    // Frame 1: nose jumps far away (0.90, 0.12) — OUTLIER
    // Frame 2: nose returns to near original (0.50, 0.12)
    const frames = [
      createTestPoseFrame(0, 0),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.90, y: 0.12 },
      }),
      createTestPoseFrame(2 / 30, 2),
    ];

    const result = detectOutliers(frames, THRESHOLD);

    expect(result.outliersDetected).toBe(1);
    // Nose should be removed from frame 1.
    expect(result.frames[1].landmarks.has(LandmarkID.nose)).toBe(false);
    // Nose should still be present in frames 0 and 2.
    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(true);
    expect(result.frames[2].landmarks.has(LandmarkID.nose)).toBe(true);
  });

  it('does NOT flag gradual movement as an outlier', () => {
    // Nose moves smoothly over 5 frames by 0.04 per frame.
    const frames = Array.from({ length: 5 }, (_, i) =>
      createTestPoseFrame(i / 30, i, {
        [LandmarkID.nose]: { x: 0.50 + i * 0.04, y: 0.12 },
      }),
    );

    const result = detectOutliers(frames, THRESHOLD);

    expect(result.outliersDetected).toBe(0);
    // All frames should retain all landmarks.
    for (const frame of result.frames) {
      expect(frame.landmarks.has(LandmarkID.nose)).toBe(true);
    }
  });

  it('handles a single frame without error', () => {
    const result = detectOutliers(
      [createTestPoseFrame(0, 0)],
      THRESHOLD,
    );

    expect(result.outliersDetected).toBe(0);
    expect(result.frames.length).toBe(1);
  });

  it('handles empty frames', () => {
    const result = detectOutliers([], THRESHOLD);

    expect(result.outliersDetected).toBe(0);
    expect(result.frames.length).toBe(0);
  });

  it('handles two frames (needs 3 for detection)', () => {
    const frames = [
      createTestPoseFrame(0, 0),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.90, y: 0.90 },
      }),
    ];

    const result = detectOutliers(frames, THRESHOLD);

    expect(result.outliersDetected).toBe(0);
    expect(result.frames.length).toBe(2);
  });

  it('preserves landmarks that move fast but do NOT return', () => {
    // Nose jumps far and stays there — this is real motion, not a spike.
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.30, y: 0.12 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.70, y: 0.12 },
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.72, y: 0.12 },
      }),
    ];

    const result = detectOutliers(frames, THRESHOLD);

    expect(result.outliersDetected).toBe(0);
    expect(result.frames[1].landmarks.has(LandmarkID.nose)).toBe(true);
  });

  it('detects outlier in multiple landmarks independently', () => {
    // Both nose and left wrist spike in frame 1.
    const frames = [
      createTestPoseFrame(0, 0),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.90, y: 0.90 },
        [LandmarkID.leftWrist]: { x: 0.90, y: 0.90 },
      }),
      createTestPoseFrame(2 / 30, 2),
    ];

    const result = detectOutliers(frames, THRESHOLD);

    expect(result.outliersDetected).toBe(2);
    expect(result.frames[1].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.frames[1].landmarks.has(LandmarkID.leftWrist)).toBe(false);
    // Other landmarks in frame 1 should be fine.
    expect(result.frames[1].landmarks.has(LandmarkID.leftShoulder)).toBe(true);
  });

  it('correctly updates frame metadata after removing outliers', () => {
    const frames = [
      createTestPoseFrame(0, 0),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.90, y: 0.90 },
      }),
      createTestPoseFrame(2 / 30, 2),
    ];

    const result = detectOutliers(frames, THRESHOLD);

    expect(result.frames[1].detectedCount).toBe(16);
    expect(result.frames[1].missingCount).toBe(1);
  });
});
