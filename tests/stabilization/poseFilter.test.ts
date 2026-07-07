/**
 * poseFilter.test.ts
 * Tests for confidence-based pose landmark filtering.
 */

import { LandmarkID, LANDMARK_COUNT } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';
import { filterByConfidence } from '@/features/stabilization/PoseFilter';
import { createTestPoseFrame } from '../helpers/poseFixtures';

describe('PoseFilter – filterByConfidence', () => {
  it('filters low-confidence landmarks below threshold', () => {
    const frame = createTestPoseFrame(0, 0, {
      [LandmarkID.nose]: { x: 0.5, y: 0.1, confidence: 0.1 },
      [LandmarkID.leftEye]: { x: 0.48, y: 0.1, confidence: 0.2 },
    });

    const result = filterByConfidence([frame], 0.3);

    expect(result.filteredCount).toBe(2);
    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.frames[0].landmarks.has(LandmarkID.leftEye)).toBe(false);
  });

  it('preserves high-confidence landmarks', () => {
    const frame = createTestPoseFrame(0, 0, {
      [LandmarkID.nose]: { x: 0.5, y: 0.1, confidence: 0.95 },
    });

    const result = filterByConfidence([frame], 0.3);

    expect(result.filteredCount).toBe(0);
    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(true);
    const nose = result.frames[0].landmarks.get(LandmarkID.nose)!;
    expect(nose.confidence).toBe(0.95);
  });

  it('does NOT delete entire frames when a single landmark is bad', () => {
    // One bad landmark among 17.
    const frame = createTestPoseFrame(0, 0, {
      [LandmarkID.leftWrist]: { x: 0.45, y: 0.5, confidence: 0.05 },
    });

    const result = filterByConfidence([frame], 0.3);

    // Frame still exists.
    expect(result.frames.length).toBe(1);
    // Only 1 landmark was filtered.
    expect(result.filteredCount).toBe(1);
    // Other landmarks are intact.
    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(true);
    expect(result.frames[0].landmarks.has(LandmarkID.leftWrist)).toBe(false);
    expect(result.frames[0].detectedCount).toBe(LANDMARK_COUNT - 1);
    expect(result.frames[0].missingCount).toBe(1);
  });

  it('handles frames with no landmarks gracefully', () => {
    const emptyFrame: PoseFrame = {
      timestamp: 0,
      frameIndex: 0,
      landmarks: new Map(),
      averageConfidence: 0,
      detectedCount: 0,
      missingCount: 17,
      sourceWidth: 1080,
      sourceHeight: 1920,
      processingTimeMs: 10,
    };

    const result = filterByConfidence([emptyFrame], 0.3);

    expect(result.frames.length).toBe(1);
    expect(result.filteredCount).toBe(0);
    expect(result.frames[0].landmarks.size).toBe(0);
  });

  it('handles empty frame array', () => {
    const result = filterByConfidence([], 0.3);

    expect(result.frames.length).toBe(0);
    expect(result.filteredCount).toBe(0);
  });

  it('preserves landmarks at exactly the threshold', () => {
    const frame = createTestPoseFrame(0, 0, {
      [LandmarkID.nose]: { x: 0.5, y: 0.1, confidence: 0.3 },
    });

    const result = filterByConfidence([frame], 0.3);

    expect(result.filteredCount).toBe(0);
    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(true);
  });

  it('correctly updates averageConfidence after filtering', () => {
    const frame = createTestPoseFrame(0, 0, {
      [LandmarkID.nose]: { x: 0.5, y: 0.1, confidence: 0.1 }, // Will be filtered
    });

    const result = filterByConfidence([frame], 0.3);

    // All remaining landmarks have confidence 0.9 (default).
    expect(result.frames[0].averageConfidence).toBeCloseTo(0.9, 5);
  });

  it('processes multiple frames independently', () => {
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.5, y: 0.1, confidence: 0.05 },
      }),
      createTestPoseFrame(1 / 30, 1), // All defaults (0.9 confidence)
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.leftHip]: { x: 0.45, y: 0.55, confidence: 0.1 },
        [LandmarkID.rightHip]: { x: 0.55, y: 0.55, confidence: 0.15 },
      }),
    ];

    const result = filterByConfidence(frames, 0.3);

    expect(result.frames.length).toBe(3);
    expect(result.filteredCount).toBe(3); // 1 + 0 + 2
    expect(result.frames[0].landmarks.has(LandmarkID.nose)).toBe(false);
    expect(result.frames[1].landmarks.has(LandmarkID.nose)).toBe(true);
    expect(result.frames[2].landmarks.has(LandmarkID.leftHip)).toBe(false);
    expect(result.frames[2].landmarks.has(LandmarkID.rightHip)).toBe(false);
  });
});
