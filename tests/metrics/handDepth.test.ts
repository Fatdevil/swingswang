/**
 * handDepth.test.ts
 * SwingSwang – Tests
 *
 * Tests for the hand depth proxy metric.
 */

import { handDepthMetric } from '@/features/metrics/handDepth';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { LandmarkID } from '@/types/landmarks';
import { createTestPoseFrame, createStationarySequence } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

function makeConfig(view: 'DTL' | 'FO' = 'DTL'): SwingConfig {
  return { cameraView: view, handedness: 'RIGHT', club: 'MID_IRON' };
}

function makeTimeline(frames: ReturnType<typeof createTestPoseFrame>[]): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Hand Depth Metric', () => {
  describe('DTL view measurement', () => {
    it('measures hand depth relative to shoulders', () => {
      // Create frames where hands move behind then forward of shoulders
      const frames = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 15;
        // Simulate: address → hands behind → hands forward
        let wristOffset: number;
        if (i < 5) {
          wristOffset = 0; // At address, hands at shoulder level
        } else if (i < 12) {
          wristOffset = -0.08; // Backswing: hands behind
        } else {
          wristOffset = 0.03; // Follow through: hands forward
        }

        frames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftWrist]: { x: 0.45 + wristOffset, y: 0.50 },
            [LandmarkID.rightWrist]: { x: 0.55 + wristOffset, y: 0.50 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = handDepthMetric.calculate(timeline, makeConfig('DTL'));

      expect(result.id).toBe('handDepth');
      expect(result.value).not.toBeNull();
      expect(result.value!).toBeGreaterThan(0);
      expect(result.unit).toBe('shoulder_widths');
    });

    it('measures larger range with more hand movement', () => {
      // Small movement
      const smallFrames = [];
      for (let i = 0; i < 20; i++) {
        const offset = i >= 5 ? 0.02 : 0;
        smallFrames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.45 + offset, y: 0.50 },
            [LandmarkID.rightWrist]: { x: 0.55 + offset, y: 0.50 },
          }),
        );
      }

      // Large movement
      const largeFrames = [];
      for (let i = 0; i < 20; i++) {
        const offset = i >= 5 ? -0.10 : 0;
        largeFrames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.45 + offset, y: 0.50 },
            [LandmarkID.rightWrist]: { x: 0.55 + offset, y: 0.50 },
          }),
        );
      }

      const smallResult = handDepthMetric.calculate(makeTimeline(smallFrames), makeConfig('DTL'));
      const largeResult = handDepthMetric.calculate(makeTimeline(largeFrames), makeConfig('DTL'));

      expect(largeResult.value!).toBeGreaterThan(smallResult.value!);
    });
  });

  describe('view restriction', () => {
    it('only works for DTL view', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const dtlResult = handDepthMetric.calculate(timeline, makeConfig('DTL'));
      expect(dtlResult.value).not.toBeNull();
    });

    it('returns NOT_RELIABLE for FO view config', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const foResult = handDepthMetric.calculate(timeline, makeConfig('FO'));
      expect(foResult.status).toBe('NOT_RELIABLE');
      expect(foResult.value).toBeNull();
    });
  });

  describe('missing landmarks', () => {
    it('handles missing wrist landmarks', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: null,
            [LandmarkID.rightWrist]: null,
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = handDepthMetric.calculate(timeline, makeConfig('DTL'));

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });

    it('handles missing shoulder landmarks', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftShoulder]: null,
            [LandmarkID.rightShoulder]: null,
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = handDepthMetric.calculate(timeline, makeConfig('DTL'));

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });
  });

  describe('stationary hands', () => {
    it('measures near-zero depth range for stationary hands', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const result = handDepthMetric.calculate(timeline, makeConfig('DTL'));

      expect(result.value).not.toBeNull();
      expect(result.value!).toBeCloseTo(0, 1);
    });
  });

  describe('metadata', () => {
    it('has correct metric metadata', () => {
      expect(handDepthMetric.id).toBe('handDepth');
      expect(handDepthMetric.displayName).toBe('Hand Depth');
      expect(handDepthMetric.supportedViews).toEqual(['DTL']);
      expect(handDepthMetric.supportedViews).not.toContain('FO');
    });

    it('includes evidence with depth values', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        const offset = i >= 5 ? -0.05 : 0;
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.45 + offset, y: 0.50 },
            [LandmarkID.rightWrist]: { x: 0.55 + offset, y: 0.50 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = handDepthMetric.calculate(timeline, makeConfig('DTL'));

      expect(result.evidence.minRelativeDepth).toBeDefined();
      expect(result.evidence.maxRelativeDepth).toBeDefined();
      expect(result.evidence.rawDepthRange).toBeDefined();
      expect(result.evidence.avgShoulderWidth).toBeDefined();
    });
  });
});
