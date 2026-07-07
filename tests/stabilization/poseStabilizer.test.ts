/**
 * poseStabilizer.test.ts
 * Integration tests for the full stabilization pipeline.
 */

import { LandmarkID } from '@/types/landmarks';
import { stabilizePoseTimeline } from '@/features/stabilization/PoseStabilizer';
import { DEFAULT_STABILIZATION_CONFIG } from '@/features/stabilization/types';
import { createTestPoseFrame } from '../helpers/poseFixtures';

describe('PoseStabilizer – stabilizePoseTimeline', () => {
  it('runs all pipeline stages and returns a valid report', () => {
    const frames = [
      createTestPoseFrame(0, 0),
      createTestPoseFrame(1 / 30, 1),
      createTestPoseFrame(2 / 30, 2),
      createTestPoseFrame(3 / 30, 3),
      createTestPoseFrame(4 / 30, 4),
    ];

    const result = stabilizePoseTimeline(frames);

    expect(result.frames.length).toBe(5);
    expect(result.report.totalFrames).toBe(5);
    expect(result.report.smoothingApplied).toBe(true);
    expect(result.report.config).toEqual(DEFAULT_STABILIZATION_CONFIG);
  });

  it('uses default config when none provided', () => {
    const frames = [createTestPoseFrame(0, 0)];
    const result = stabilizePoseTimeline(frames);

    expect(result.report.config).toEqual(DEFAULT_STABILIZATION_CONFIG);
  });

  it('merges partial config with defaults', () => {
    const frames = [createTestPoseFrame(0, 0)];
    const result = stabilizePoseTimeline(frames, {
      minLandmarkConfidence: 0.5,
    });

    expect(result.report.config.minLandmarkConfidence).toBe(0.5);
    expect(result.report.config.outlierVelocityThreshold).toBe(0.15); // Default
    expect(result.report.config.maxInterpolationGap).toBe(2); // Default
  });

  it('filters, detects outliers, interpolates, and smooths in sequence', () => {
    // Build a scenario that exercises all four stages:
    // - Frame 0: normal
    // - Frame 1: nose has low confidence (will be filtered) + leftWrist spikes
    // - Frame 2: leftWrist returns (frame 1 wrist is outlier)
    // - Frame 3: normal (nose gap from frame 1 gets interpolated)
    const frames = [
      createTestPoseFrame(0, 0, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12 },
        [LandmarkID.leftWrist]: { x: 0.45, y: 0.50 },
      }),
      createTestPoseFrame(1 / 30, 1, {
        [LandmarkID.nose]: { x: 0.50, y: 0.12, confidence: 0.1 }, // Filtered
        [LandmarkID.leftWrist]: { x: 0.90, y: 0.90 }, // Outlier spike
      }),
      createTestPoseFrame(2 / 30, 2, {
        [LandmarkID.nose]: { x: 0.52, y: 0.12 },
        [LandmarkID.leftWrist]: { x: 0.45, y: 0.50 }, // Returns
      }),
      createTestPoseFrame(3 / 30, 3, {
        [LandmarkID.nose]: { x: 0.51, y: 0.12 },
        [LandmarkID.leftWrist]: { x: 0.46, y: 0.50 },
      }),
    ];

    const result = stabilizePoseTimeline(frames);

    expect(result.report.landmarksFiltered).toBeGreaterThanOrEqual(1);
    expect(result.frames.length).toBe(4);
    // All frames should exist.
    for (const frame of result.frames) {
      expect(frame).toBeDefined();
    }
  });

  it('handles empty input', () => {
    const result = stabilizePoseTimeline([]);

    expect(result.frames.length).toBe(0);
    expect(result.report.totalFrames).toBe(0);
    expect(result.report.landmarksFiltered).toBe(0);
    expect(result.report.outliersDetected).toBe(0);
    expect(result.report.gapsInterpolated).toBe(0);
    expect(result.report.smoothingApplied).toBe(false);
  });

  it('handles single frame', () => {
    const result = stabilizePoseTimeline([createTestPoseFrame(0, 0)]);

    expect(result.frames.length).toBe(1);
    expect(result.report.totalFrames).toBe(1);
    expect(result.report.smoothingApplied).toBe(false);
  });
});
