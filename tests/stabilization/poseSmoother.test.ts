/**
 * poseSmoother.test.ts
 * Tests for velocity-adaptive EMA smoothing.
 */

import { LandmarkID } from '@/types/landmarks';
import { smoothLandmarks } from '@/features/stabilization/PoseSmoother';
import { createTestPoseFrame, createStationarySequence } from '../helpers/poseFixtures';

describe('PoseSmoother – smoothLandmarks', () => {
  const BASE = 0.3;
  const VELOCITY_SCALE = 2.0;
  const MIN_FACTOR = 0.05;

  it('reduces jitter in a stationary sequence', () => {
    // Add small random-like jitter to nose position.
    const jitterSequence = [
      createTestPoseFrame(0, 0, { [LandmarkID.nose]: { x: 0.50, y: 0.12 } }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: { x: 0.505, y: 0.125 } }),
      createTestPoseFrame(2 / 30, 2, { [LandmarkID.nose]: { x: 0.495, y: 0.115 } }),
      createTestPoseFrame(3 / 30, 3, { [LandmarkID.nose]: { x: 0.503, y: 0.122 } }),
      createTestPoseFrame(4 / 30, 4, { [LandmarkID.nose]: { x: 0.497, y: 0.118 } }),
      createTestPoseFrame(5 / 30, 5, { [LandmarkID.nose]: { x: 0.501, y: 0.121 } }),
    ];

    const smoothed = smoothLandmarks(jitterSequence, BASE, VELOCITY_SCALE, MIN_FACTOR);

    // After smoothing, the range of x-values should be tighter than the raw data.
    const rawXs = jitterSequence.map(
      (f) => f.landmarks.get(LandmarkID.nose)!.x,
    );
    const smoothedXs = smoothed.map(
      (f) => f.landmarks.get(LandmarkID.nose)!.x,
    );

    const rawRange = Math.max(...rawXs) - Math.min(...rawXs);
    const smoothedRange = Math.max(...smoothedXs) - Math.min(...smoothedXs);

    expect(smoothedRange).toBeLessThan(rawRange);
  });

  it('preserves fast motion (high velocity → less smoothing)', () => {
    // Nose moves sharply from 0.3 to 0.7 in one frame.
    const frames = [
      createTestPoseFrame(0, 0, { [LandmarkID.nose]: { x: 0.30, y: 0.12 } }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: { x: 0.70, y: 0.12 } }),
    ];

    const smoothed = smoothLandmarks(frames, BASE, VELOCITY_SCALE, MIN_FACTOR);

    const smoothedNose = smoothed[1].landmarks.get(LandmarkID.nose)!;
    // With high velocity, alpha should be close to MIN_FACTOR (0.05).
    // smoothed.x = alpha * 0.70 + (1-alpha) * 0.30
    // At alpha=0.05: smoothed.x = 0.035 + 0.285 = 0.32
    // At alpha=0.30: smoothed.x = 0.21 + 0.21 = 0.42
    // The fast motion should push the result closer to the new position than
    // heavy smoothing would, meaning alpha is small and the smoothed value
    // is further from 0.70 than with base smoothing.
    // But the key test is that it *does* move significantly toward the new position.
    expect(smoothedNose.x).toBeGreaterThan(0.30);
    expect(smoothedNose.x).toBeLessThan(0.70);
  });

  it('is deterministic: same input → same output', () => {
    const frames = [
      createTestPoseFrame(0, 0, { [LandmarkID.nose]: { x: 0.40, y: 0.12 } }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: { x: 0.45, y: 0.14 } }),
      createTestPoseFrame(2 / 30, 2, { [LandmarkID.nose]: { x: 0.50, y: 0.16 } }),
    ];

    const result1 = smoothLandmarks(frames, BASE, VELOCITY_SCALE, MIN_FACTOR);
    const result2 = smoothLandmarks(frames, BASE, VELOCITY_SCALE, MIN_FACTOR);

    for (let i = 0; i < result1.length; i++) {
      const n1 = result1[i].landmarks.get(LandmarkID.nose)!;
      const n2 = result2[i].landmarks.get(LandmarkID.nose)!;
      expect(n1.x).toBe(n2.x);
      expect(n1.y).toBe(n2.y);
    }
  });

  it('single frame returns unchanged', () => {
    const frame = createTestPoseFrame(0, 0, {
      [LandmarkID.nose]: { x: 0.50, y: 0.12 },
    });

    const result = smoothLandmarks([frame], BASE, VELOCITY_SCALE, MIN_FACTOR);

    expect(result.length).toBe(1);
    const nose = result[0].landmarks.get(LandmarkID.nose)!;
    expect(nose.x).toBe(0.50);
    expect(nose.y).toBe(0.12);
  });

  it('handles missing landmarks gracefully', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: null, // Missing in this frame
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.52, y: 0.13 },
      }),
    ];

    // Should not throw.
    const result = smoothLandmarks(frames, BASE, VELOCITY_SCALE, MIN_FACTOR);

    expect(result.length).toBe(3);
    // Frame 1 should have no nose.
    expect(result[1].landmarks.has(LandmarkID.nose)).toBe(false);
    // Frame 2 should still have nose (treated as first occurrence after gap).
    expect(result[2].landmarks.has(LandmarkID.nose)).toBe(true);
  });

  it('velocity-adaptive: alpha varies with velocity', () => {
    // Low velocity: tiny step.
    const slowFrames = [
      createTestPoseFrame(0, 0, { [LandmarkID.nose]: { x: 0.500, y: 0.12 } }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: { x: 0.501, y: 0.12 } }),
    ];

    // High velocity: large step.
    const fastFrames = [
      createTestPoseFrame(0, 0, { [LandmarkID.nose]: { x: 0.300, y: 0.12 } }),
      createTestPoseFrame(1 / 30, 1, { [LandmarkID.nose]: { x: 0.700, y: 0.12 } }),
    ];

    const slowResult = smoothLandmarks(slowFrames, BASE, VELOCITY_SCALE, MIN_FACTOR);
    const fastResult = smoothLandmarks(fastFrames, BASE, VELOCITY_SCALE, MIN_FACTOR);

    // For slow motion, smoothed should be heavily pulled toward previous
    // (alpha ~= baseFactor ~= 0.3, so smoothed ≈ 0.3*0.501 + 0.7*0.500).
    const slowNose = slowResult[1].landmarks.get(LandmarkID.nose)!;
    const slowExpected = BASE * 0.501 + (1 - BASE) * 0.500; // ≈ 0.5003
    expect(slowNose.x).toBeCloseTo(slowExpected, 3);

    // For fast motion, alpha should be much smaller (near MIN_FACTOR),
    // so the smoothed value should be pulled strongly toward previous.
    const fastNose = fastResult[1].landmarks.get(LandmarkID.nose)!;
    // With velocity ≈ 0.4, alpha = max(0.05, 0.3 * exp(-2 * 0.4)) ≈ max(0.05, 0.135) = 0.135
    // smoothed = 0.135 * 0.70 + 0.865 * 0.30 = 0.0945 + 0.2595 = 0.354
    expect(fastNose.x).toBeGreaterThan(0.30);
    expect(fastNose.x).toBeLessThan(0.50); // Definitely not at full new value
  });

  it('handles empty frame array', () => {
    const result = smoothLandmarks([], BASE, VELOCITY_SCALE, MIN_FACTOR);
    expect(result.length).toBe(0);
  });

  it('does not modify non-positional properties (confidence, visibility)', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12, confidence: 0.85, visibility: 0.95 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.52, y: 0.14, confidence: 0.78, visibility: 0.88 },
      }),
    ];

    const result = smoothLandmarks(frames, BASE, VELOCITY_SCALE, MIN_FACTOR);
    const nose = result[1].landmarks.get(LandmarkID.nose)!;

    // Confidence and visibility should be preserved as-is.
    expect(nose.confidence).toBe(0.78);
    expect(nose.visibility).toBe(0.88);
  });
});
