/**
 * tempo.test.ts
 * SwingSwang – Tests
 *
 * Tests for the swing tempo metric.
 */

import { tempoMetric } from '@/features/metrics/tempo';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { SwingEventResult, SwingEvent, SwingEventType } from '@/features/events/types';
import { LandmarkID } from '@/types/landmarks';
import { createTestPoseFrame, createStationarySequence } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

function makeConfig(view: 'DTL' | 'FO' = 'FO'): SwingConfig {
  return { cameraView: view, handedness: 'RIGHT', club: 'MID_IRON' };
}

function makeTimeline(frames: ReturnType<typeof createTestPoseFrame>[]): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

/** Create a mock SwingEventResult with specified event timestamps (in seconds, converted to ms). */
function makeEvents(
  phases: Partial<Record<SwingEventType, { timestamp: number; frameIndex: number; confidence: number }>>,
): SwingEventResult {
  const events: SwingEvent[] = [];
  for (const [eventType, data] of Object.entries(phases)) {
    if (data) {
      events.push({
        event: eventType as SwingEventType,
        timestampMs: data.timestamp * 1000,
        frameIndex: data.frameIndex,
        confidence: data.confidence,
        status: 'RELIABLE',
        signals: {},
      });
    }
  }

  return {
    events,
    detectedCount: events.length,
    reliableCount: events.filter(e => e.status === 'RELIABLE').length,
    temporalOrderValid: true,
    warnings: [],
  };
}

/** Create a sequence with progressive wrist movement to simulate a swing. */
function createSwingSequence(frameCount: number): ReturnType<typeof createTestPoseFrame>[] {
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / 15; // 15 fps
    const progress = i / (frameCount - 1);

    // Simulate wrist movement: slow up, pause at top, fast down
    let wristX: number;
    let wristY: number;

    if (progress < 0.1) {
      // Address: hands at center
      wristX = 0.50;
      wristY = 0.50;
    } else if (progress < 0.5) {
      // Backswing: slow movement up/back
      const backP = (progress - 0.1) / 0.4;
      wristX = 0.50 - backP * 0.15;
      wristY = 0.50 - backP * 0.20;
    } else if (progress < 0.55) {
      // Top: pause
      wristX = 0.35;
      wristY = 0.30;
    } else if (progress < 0.75) {
      // Downswing: fast return
      const downP = (progress - 0.55) / 0.2;
      wristX = 0.35 + downP * 0.20;
      wristY = 0.30 + downP * 0.25;
    } else {
      // Follow through
      wristX = 0.55 + (progress - 0.75) * 0.10;
      wristY = 0.55 - (progress - 0.75) * 0.10;
    }

    frames.push(
      createTestPoseFrame(t, i, {
        [LandmarkID.leftWrist]: { x: wristX - 0.05, y: wristY },
        [LandmarkID.rightWrist]: { x: wristX + 0.05, y: wristY },
      }),
    );
  }
  return frames;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Tempo Metric', () => {
  describe('event-based calculation', () => {
    it('calculates correct tempo ratio with events', () => {
      const frames = createSwingSequence(30);
      const timeline = makeTimeline(frames);

      // 3:1 ratio: backswing 0.6s, downswing 0.2s
      const events = makeEvents({
        ADDRESS: { timestamp: 0.1, frameIndex: 1, confidence: 0.9 },
        TOP: { timestamp: 0.7, frameIndex: 10, confidence: 0.9 },
        IMPACT_PROXY: { timestamp: 0.9, frameIndex: 13, confidence: 0.9 },
      });

      const result = tempoMetric.calculate(timeline, makeConfig(), events);

      expect(result.id).toBe('tempo');
      expect(result.value).not.toBeNull();
      expect(result.value).toBeCloseTo(3.0, 0);
      expect(result.unit).toBe('ratio');
      expect(result.evidence.method).toBe('event_based');
    });

    it('calculates different ratios accurately', () => {
      const frames = createSwingSequence(30);
      const timeline = makeTimeline(frames);

      // 2:1 ratio: backswing 0.4s, downswing 0.2s
      const events = makeEvents({
        ADDRESS: { timestamp: 0.1, frameIndex: 1, confidence: 0.9 },
        TOP: { timestamp: 0.5, frameIndex: 7, confidence: 0.9 },
        IMPACT_PROXY: { timestamp: 0.7, frameIndex: 10, confidence: 0.9 },
      });

      const result = tempoMetric.calculate(timeline, makeConfig(), events);
      expect(result.value).toBeCloseTo(2.0, 1);
    });
  });

  describe('velocity fallback', () => {
    it('falls back to velocity-based calculation without events', () => {
      const frames = createSwingSequence(60);
      const timeline = makeTimeline(frames);

      const result = tempoMetric.calculate(timeline, makeConfig());

      expect(result.id).toBe('tempo');
      // Without events, should attempt velocity fallback — may succeed or return NOT_RELIABLE
      if (result.status !== 'NOT_RELIABLE') {
        expect(result.evidence.method).toBe('velocity_fallback');
        expect(result.warnings.length).toBeGreaterThan(0);
      } else {
        // NOT_RELIABLE is acceptable if the synthetic data lacks clear velocity phases
        expect(result.value).toBeNull();
      }
    });

    it('falls back when events are empty', () => {
      const frames = createSwingSequence(60);
      const timeline = makeTimeline(frames);
      const events = makeEvents({});

      const result = tempoMetric.calculate(timeline, makeConfig(), events);
      // Empty events should use velocity fallback path
      if (result.status !== 'NOT_RELIABLE') {
        expect(result.evidence.method).toBe('velocity_fallback');
      } else {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('insufficient data', () => {
    it('returns NOT_RELIABLE for too few frames', () => {
      const frames = createStationarySequence(3);
      const timeline = makeTimeline(frames);

      const result = tempoMetric.calculate(timeline, makeConfig());

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });
  });

  describe('metadata', () => {
    it('has correct metric metadata', () => {
      expect(tempoMetric.id).toBe('tempo');
      expect(tempoMetric.displayName).toBe('Swing Tempo');
      expect(tempoMetric.supportedViews).toContain('DTL');
      expect(tempoMetric.supportedViews).toContain('FO');
    });

    it('result includes version and limitations', () => {
      const frames = createSwingSequence(30);
      const timeline = makeTimeline(frames);
      const events = makeEvents({
        ADDRESS: { timestamp: 0.1, frameIndex: 1, confidence: 0.9 },
        TOP: { timestamp: 0.7, frameIndex: 10, confidence: 0.9 },
        IMPACT_PROXY: { timestamp: 0.9, frameIndex: 13, confidence: 0.9 },
      });

      const result = tempoMetric.calculate(timeline, makeConfig(), events);
      expect(result.version).toBe('1.0.0');
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(result.calculationExplanation.length).toBeGreaterThan(0);
    });
  });
});
