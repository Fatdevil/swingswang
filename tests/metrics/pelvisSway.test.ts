/**
 * pelvisSway.test.ts
 * SwingSwang – Tests
 *
 * Tests for the pelvis sway metric.
 */

import { pelvisSwayMetric } from '@/features/metrics/pelvisSway';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { SwingEventResult } from '@/features/events/types';
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

    it('ignores pre-address and post-finish hip movement when events are provided', () => {
      // 30 frames:
      // Frames 0-4: Golfer walks into frame, hips shift wildly (x + 0.20)
      // Frame 5-9: ADDRESS at normal position (shift = 0)
      // Frames 10-15: Swing with small sway (shift = 0.02)
      // Frame 16-20: FINISH at normal position (shift = 0)
      // Frames 21-29: Golfer walks away, hips shift wildly (x + 0.30)
      const frames = [];
      for (let i = 0; i < 30; i++) {
        const t = i / 15;
        let shift = 0;
        if (i < 5) shift = 0.20; // pre-swing walk
        else if (i >= 10 && i <= 15) shift = 0.02; // true swing sway
        else if (i >= 21) shift = 0.30; // post-swing walk

        frames.push(
          createTestPoseFrame(t, i, {
            [LandmarkID.leftHip]: { x: 0.45 + shift, y: 0.55 },
            [LandmarkID.rightHip]: { x: 0.55 + shift, y: 0.55 },
          })
        );
      }
      const timeline = makeTimeline(frames);

      // Without events, the 0.30 shift from walking away pollutes the metric
      const withoutEvents = pelvisSwayMetric.calculate(timeline, makeConfig('FO'));
      expect(withoutEvents.value!).toBeGreaterThan(1.0); // huge sway due to walking

      // With events, only the 0.02 swing sway within [ADDRESS, FINISH] is measured
      const events: SwingEventResult = {
        events: [
          { event: 'ADDRESS', timestampMs: (7 / 15) * 1000, frameIndex: 7, confidence: 0.9, status: 'RELIABLE', signals: {} },
          { event: 'TOP', timestampMs: (12 / 15) * 1000, frameIndex: 12, confidence: 0.9, status: 'RELIABLE', signals: {} },
          { event: 'IMPACT_PROXY', timestampMs: (14 / 15) * 1000, frameIndex: 14, confidence: 0.9, status: 'RELIABLE', signals: {} },
          { event: 'FINISH', timestampMs: (18 / 15) * 1000, frameIndex: 18, confidence: 0.9, status: 'RELIABLE', signals: {} },
        ],
        detectedCount: 4,
        reliableCount: 4,
        temporalOrderValid: true,
        warnings: [],
      };

      const withEvents = pelvisSwayMetric.calculate(timeline, makeConfig('FO'), events);
      expect(withEvents.value!).toBeLessThan(0.3); // confined to swing sway
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
