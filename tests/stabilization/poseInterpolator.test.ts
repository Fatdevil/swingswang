/**
 * poseInterpolator.test.ts
 * Tests for short-gap linear interpolation of missing landmarks.
 */

import { LandmarkID } from '@/types/landmarks';
import { interpolateShortGaps } from '@/features/stabilization/PoseInterpolator';
import { createTestPoseFrame } from '../helpers/poseFixtures';

describe('PoseInterpolator – interpolateShortGaps', () => {
  it('interpolates a 1-frame gap', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.40, y: 0.10 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: null, // Missing
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10 },
      }),
    ];

    const result = interpolateShortGaps(frames, 2);

    expect(result.interpolatedCount).toBe(1);
    expect(result.rejectedGaps).toBe(0);

    const interpolatedNose = result.frames[1].landmarks.get(LandmarkID.nose);
    expect(interpolatedNose).toBeDefined();
    // Linear interpolation: t = 1/2, so x = 0.40 + 0.5 * (0.60 - 0.40) = 0.50
    expect(interpolatedNose!.x).toBeCloseTo(0.50, 5);
    expect(interpolatedNose!.y).toBeCloseTo(0.10, 5);
  });

  it('interpolates a 2-frame gap (maxGap=2)', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.30, y: 0.10 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: null,
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: null,
      }),
      createTestPoseFrame(3 / 30, 3, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10 },
      }),
    ];

    const result = interpolateShortGaps(frames, 2);

    expect(result.interpolatedCount).toBe(2);
    expect(result.rejectedGaps).toBe(0);

    // Frame 1: t = 1/3
    const nose1 = result.frames[1].landmarks.get(LandmarkID.nose);
    expect(nose1).toBeDefined();
    expect(nose1!.x).toBeCloseTo(0.30 + (1 / 3) * (0.60 - 0.30), 5);

    // Frame 2: t = 2/3
    const nose2 = result.frames[2].landmarks.get(LandmarkID.nose);
    expect(nose2).toBeDefined();
    expect(nose2!.x).toBeCloseTo(0.30 + (2 / 3) * (0.60 - 0.30), 5);
  });

  it('rejects a 3-frame gap (maxGap=2)', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.30, y: 0.10 },
      }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: null }),
      createTestPoseFrame(2 / 30, 2, { [LandmarkID.nose]: null }),
      createTestPoseFrame(3 / 30, 3, { [LandmarkID.nose]: null }),
      createTestPoseFrame(4 / 30, 4, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10 },
      }),
    ];

    const result = interpolateShortGaps(frames, 2);

    expect(result.interpolatedCount).toBe(0);
    expect(result.rejectedGaps).toBeGreaterThanOrEqual(1);

    // The gap should remain unfilled.
    expect(result.frames[1].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.frames[2].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.frames[3].landmarks.has(LandmarkID.nose)).toBe(false);
  });

  it('sets correct interpolation metadata', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.40, y: 0.10, confidence: 0.8 },
      }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: null }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10, confidence: 0.6 },
      }),
    ];

    const result = interpolateShortGaps(frames, 2);

    const nose = result.frames[1].landmarks.get(LandmarkID.nose);
    expect(nose).toBeDefined();

    // Effective confidence = avg(0.8, 0.6) * (1 - 1/10) = 0.7 * 0.9 = 0.63
    expect(nose!.confidence).toBeCloseTo(0.63, 5);
  });

  it('effectiveConfidence decreases with gap size', () => {
    // 1-frame gap
    const frames1 = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.40, y: 0.10, confidence: 0.8 },
      }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: null }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10, confidence: 0.8 },
      }),
    ];

    // 2-frame gap
    const frames2 = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.40, y: 0.10, confidence: 0.8 },
      }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: null }),
      createTestPoseFrame(2 / 30, 2, { [LandmarkID.nose]: null }),
      createTestPoseFrame(3 / 30, 3, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10, confidence: 0.8 },
      }),
    ];

    const result1 = interpolateShortGaps(frames1, 2);
    const result2 = interpolateShortGaps(frames2, 2);

    const conf1 = result1.frames[1].landmarks.get(LandmarkID.nose)!.confidence;
    const conf2 = result2.frames[1].landmarks.get(LandmarkID.nose)!.confidence;

    // Larger gap → lower effective confidence.
    expect(conf1).toBeGreaterThan(conf2);
  });

  it('does not interpolate at start of timeline', () => {
    const frames = [
      createTestPoseFrame(0, 0, { [LandmarkID.nose]: null }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12 },
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12 },
      }),
    ];

    const result = interpolateShortGaps(frames, 2);

    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.rejectedGaps).toBeGreaterThanOrEqual(1);
  });

  it('does not interpolate at end of timeline', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12 },
      }),
      createTestPoseFrame(2 / 30, 2, { [LandmarkID.nose]: null }),
    ];

    const result = interpolateShortGaps(frames, 2);

    expect(result.frames[2].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.rejectedGaps).toBeGreaterThanOrEqual(1);
  });

  it('handles multiple landmarks with different gap patterns', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.40, y: 0.10 },
        [LandmarkID.leftWrist]: { x: 0.30, y: 0.50 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: null,      // 1-frame gap — interpolatable
        [LandmarkID.leftWrist]: null,  // Start of 3-frame gap
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.60, y: 0.10 },
        [LandmarkID.leftWrist]: null,
      }),
      createTestPoseFrame(3 / 30, 3, {
        [LandmarkID.leftWrist]: null,
      }),
      createTestPoseFrame(4 / 30, 4, {
        [LandmarkID.leftWrist]: { x: 0.70, y: 0.50 },
      }),
    ];

    const result = interpolateShortGaps(frames, 2);

    // Nose gap (1 frame) should be interpolated.
    expect(result.frames[1].landmarks.has(LandmarkID.nose)).toBe(true);

    // Left wrist gap (3 frames) should be rejected.
    expect(result.frames[1].landmarks.has(LandmarkID.leftWrist)).toBe(false);
    expect(result.frames[2].landmarks.has(LandmarkID.leftWrist)).toBe(false);
    expect(result.frames[3].landmarks.has(LandmarkID.leftWrist)).toBe(false);
  });

  it('handles empty frame array', () => {
    const result = interpolateShortGaps([], 2);

    expect(result.frames.length).toBe(0);
    expect(result.interpolatedCount).toBe(0);
    expect(result.rejectedGaps).toBe(0);
  });

  it('handles single frame', () => {
    const result = interpolateShortGaps(
      [createTestPoseFrame(0, 0, { [LandmarkID.nose]: null })],
      2,
    );

    expect(result.frames.length).toBe(1);
    expect(result.interpolatedCount).toBe(0);
  });
});
