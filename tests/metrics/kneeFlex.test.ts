/**
 * kneeFlex.test.ts
 * SwingSwang – Tests
 *
 * Tests for the knee flex pattern metric.
 */

import { kneeFlexMetric } from '@/features/metrics/kneeFlex';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { LandmarkID } from '@/types/landmarks';
import { createTestPoseFrame, createStationarySequence } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

function makeConfig(view: 'DTL' | 'FO' = 'FO', handedness: 'RIGHT' | 'LEFT' = 'RIGHT'): SwingConfig {
  return { cameraView: view, handedness, club: 'MID_IRON' };
}

function makeTimeline(frames: ReturnType<typeof createTestPoseFrame>[]): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Knee Flex Metric', () => {
  describe('knee angle calculation', () => {
    it('calculates knee angle change across frames', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 15;
        // Simulate knee flex: knees bend more midway through the swing
        const kneeOffset = i >= 5 && i <= 15 ? 0.03 : 0;

        frames.push(
          createTestPoseFrame(t, i, {
            // Move knee forward to decrease angle (more bent)
            [LandmarkID.leftKnee]: { x: 0.44, y: 0.72 + kneeOffset },
            [LandmarkID.rightKnee]: { x: 0.56, y: 0.72 + kneeOffset },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = kneeFlexMetric.calculate(timeline, makeConfig());

      expect(result.id).toBe('kneeFlex');
      expect(result.value).not.toBeNull();
      expect(result.value!).toBeGreaterThanOrEqual(0);
      expect(result.unit).toBe('degrees');
    });

    it('reports larger change with more knee movement', () => {
      // Small knee movement
      const smallMoveFrames = [];
      for (let i = 0; i < 20; i++) {
        const offset = i >= 5 ? 0.01 : 0;
        smallMoveFrames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftKnee]: { x: 0.44, y: 0.72 + offset },
            [LandmarkID.rightKnee]: { x: 0.56, y: 0.72 + offset },
          }),
        );
      }

      // Large knee movement
      const largeMoveFrames = [];
      for (let i = 0; i < 20; i++) {
        const offset = i >= 5 ? 0.08 : 0;
        largeMoveFrames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftKnee]: { x: 0.44, y: 0.72 + offset },
            [LandmarkID.rightKnee]: { x: 0.56, y: 0.72 + offset },
          }),
        );
      }

      const smallResult = kneeFlexMetric.calculate(makeTimeline(smallMoveFrames), makeConfig());
      const largeResult = kneeFlexMetric.calculate(makeTimeline(largeMoveFrames), makeConfig());

      expect(largeResult.value!).toBeGreaterThan(smallResult.value!);
    });
  });

  describe('lead vs trail knee', () => {
    it('distinguishes lead and trail knee for right-handed golfer', () => {
      // Asymmetric knee movement: left knee moves more
      const frames = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 15;
        const leftOffset = i >= 5 ? 0.06 : 0;  // Lead for right-handed
        const rightOffset = i >= 5 ? 0.02 : 0;  // Trail for right-handed

        frames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftKnee]: { x: 0.44, y: 0.72 + leftOffset },
            [LandmarkID.rightKnee]: { x: 0.56, y: 0.72 + rightOffset },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = kneeFlexMetric.calculate(timeline, makeConfig('FO', 'RIGHT'));

      expect(result.evidence.dominantSide).toBeDefined();
      // Lead (left for right-handed) should have more change
      expect(Number(result.evidence.leadMaxChange)).toBeGreaterThan(
        Number(result.evidence.trailMaxChange),
      );
    });

    it('swaps lead/trail for left-handed golfer', () => {
      // Same asymmetric movement
      const frames = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 15;
        const leftOffset = i >= 5 ? 0.06 : 0;
        const rightOffset = i >= 5 ? 0.02 : 0;

        frames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftKnee]: { x: 0.44, y: 0.72 + leftOffset },
            [LandmarkID.rightKnee]: { x: 0.56, y: 0.72 + rightOffset },
          }),
        );
      }

      const rightResult = kneeFlexMetric.calculate(makeTimeline(frames), makeConfig('FO', 'RIGHT'));
      const leftResult = kneeFlexMetric.calculate(makeTimeline(frames), makeConfig('FO', 'LEFT'));

      // For LEFT-handed, lead = right and trail = left, so sides swap
      expect(rightResult.evidence.leadMaxChange).not.toEqual(leftResult.evidence.leadMaxChange);
    });
  });

  describe('missing landmarks', () => {
    it('handles missing knee landmarks', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftKnee]: null,
            [LandmarkID.rightKnee]: null,
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = kneeFlexMetric.calculate(timeline, makeConfig());

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });

    it('handles missing ankle landmarks', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftAnkle]: null,
            [LandmarkID.rightAnkle]: null,
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = kneeFlexMetric.calculate(timeline, makeConfig());

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });

    it('handles missing hip landmarks', () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftHip]: null,
            [LandmarkID.rightHip]: null,
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = kneeFlexMetric.calculate(timeline, makeConfig());

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });
  });

  describe('view awareness', () => {
    it('works for both DTL and FO', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const foResult = kneeFlexMetric.calculate(timeline, makeConfig('FO'));
      const dtlResult = kneeFlexMetric.calculate(timeline, makeConfig('DTL'));

      // Both should produce results (not NOT_RELIABLE due to wrong view)
      expect(foResult.value).not.toBeNull();
      expect(dtlResult.value).not.toBeNull();
    });

    it('adds warning for DTL view', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const dtlResult = kneeFlexMetric.calculate(timeline, makeConfig('DTL'));
      expect(dtlResult.warnings.some((w) => w.includes('Down-the-Line'))).toBe(true);
    });
  });

  describe('metadata', () => {
    it('has correct metric metadata', () => {
      expect(kneeFlexMetric.id).toBe('kneeFlex');
      expect(kneeFlexMetric.displayName).toBe('Knee Flex Pattern');
      expect(kneeFlexMetric.supportedViews).toContain('DTL');
      expect(kneeFlexMetric.supportedViews).toContain('FO');
    });
  });
});
