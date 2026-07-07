/**
 * pelvisSway.test.ts
 * SwingSwang – Tests
 *
 * Tests for the pelvis sway metric.
 */

import { pelvisSwayMetric } from '@/features/metrics/pelvisSway';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { LandmarkID } from '@/types/landmarks';
import { createTestPoseFrame, createStationarySequence } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

function makeConfig(view: 'DTL' | 'FO' = 'FO'): SwingConfig {
  return { cameraView: view, handedness: 'RIGHT', club: 'MID_IRON' };
}

function makeTimeline(frames: ReturnType<typeof createTestPoseFrame>[]): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Pelvis Sway Metric', () => {
  describe('FO view measurement', () => {
    it('measures lateral sway from address position', () => {
      // Create frames where hips shift laterally midway
      const frames = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 15;
        // First 5 frames at address, then shift right
        const hipOffset = i < 5 ? 0 : 0.05;

        frames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftHip]: { x: 0.45 + hipOffset, y: 0.55 },
            [LandmarkID.rightHip]: { x: 0.55 + hipOffset, y: 0.55 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const result = pelvisSwayMetric.calculate(timeline, makeConfig('FO'));

      expect(result.id).toBe('pelvisSway');
      expect(result.value).not.toBeNull();
      expect(result.value!).toBeGreaterThan(0);
      expect(result.unit).toBe('hip_widths');
      expect(result.supportedView).toBe('FO');
    });

    it('reports zero sway for stationary hips', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const result = pelvisSwayMetric.calculate(timeline, makeConfig('FO'));

      expect(result.value).not.toBeNull();
      // Stationary hips should have zero or near-zero sway
      expect(result.value!).toBeCloseTo(0, 1);
    });

    it('normalizes sway by hip width', () => {
      // Wider hips = smaller normalized sway for same raw displacement
      const wideHipFrames = [];
      const narrowHipFrames = [];

      for (let i = 0; i < 20; i++) {
        const t = i / 15;
        const shift = i < 5 ? 0 : 0.03;

        // Wide hips: 0.20 width
        wideHipFrames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftHip]: { x: 0.40 + shift, y: 0.55 },
            [LandmarkID.rightHip]: { x: 0.60 + shift, y: 0.55 },
          }),
        );

        // Narrow hips: 0.10 width
        narrowHipFrames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftHip]: { x: 0.45 + shift, y: 0.55 },
            [LandmarkID.rightHip]: { x: 0.55 + shift, y: 0.55 },
          }),
        );
      }

      const wideResult = pelvisSwayMetric.calculate(makeTimeline(wideHipFrames), makeConfig('FO'));
      const narrowResult = pelvisSwayMetric.calculate(makeTimeline(narrowHipFrames), makeConfig('FO'));

      // Same raw shift but wider hips → smaller normalized value
      expect(wideResult.value!).toBeLessThan(narrowResult.value!);
    });
  });

  describe('view restriction', () => {
    it('returns NOT_RELIABLE for DTL view config', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);

      const result = pelvisSwayMetric.calculate(timeline, makeConfig('DTL'));

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });
  });

  describe('missing landmarks', () => {
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
      const result = pelvisSwayMetric.calculate(timeline, makeConfig('FO'));

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });
  });

  describe('metadata', () => {
    it('has correct metric metadata', () => {
      expect(pelvisSwayMetric.id).toBe('pelvisSway');
      expect(pelvisSwayMetric.displayName).toBe('Pelvis Sway');
      expect(pelvisSwayMetric.supportedViews).toEqual(['FO']);
      expect(pelvisSwayMetric.supportedViews).not.toContain('DTL');
    });

    it('includes evidence and explanation', () => {
      const frames = createStationarySequence(20);
      const timeline = makeTimeline(frames);
      const result = pelvisSwayMetric.calculate(timeline, makeConfig('FO'));

      expect(result.evidence).toBeDefined();
      expect(result.calculationExplanation.length).toBeGreaterThan(0);
      expect(result.limitations.length).toBeGreaterThan(0);
    });
  });
});
