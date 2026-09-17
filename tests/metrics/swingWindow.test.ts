/**
 * swingWindow.test.ts
 * SwingSwang – Tests
 *
 * Tests for swingWindow utility: extracting swing windows and address reference frames.
 */

import { extractSwingWindow, getAddressReferenceFrames } from '@/features/metrics/swingWindow';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingEventResult, SwingEvent, SwingEventType } from '@/features/events/types';
import { createTestPoseFrame } from '../helpers/poseFixtures';

function makeEvents(
  phases: Partial<Record<SwingEventType, { frameIndex: number; confidence: number; status?: 'RELIABLE' | 'NOT_RELIABLE' }>>,
): SwingEventResult {
  const events: SwingEvent[] = [];
  for (const [eventType, data] of Object.entries(phases)) {
    if (data) {
      events.push({
        event: eventType as SwingEventType,
        timestampMs: (data.frameIndex / 15) * 1000,
        frameIndex: data.frameIndex,
        confidence: data.confidence,
        status: data.status ?? 'RELIABLE',
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

describe('swingWindow utility', () => {
  describe('extractSwingWindow', () => {
    it('returns full timeline when events are omitted or empty', () => {
      const frames = [createTestPoseFrame(0, 0), createTestPoseFrame(1 / 15, 1)];
      const timeline = new PoseTimeline(frames, 2, 100, 15);

      const resultWithoutEvents = extractSwingWindow(timeline);
      expect(resultWithoutEvents.hasEvents).toBe(false);
      expect(resultWithoutEvents.windowFrames).toHaveLength(2);

      const emptyEvents: SwingEventResult = {
        events: [],
        detectedCount: 0,
        reliableCount: 0,
        temporalOrderValid: true,
        warnings: [],
      };
      const resultWithEmptyEvents = extractSwingWindow(timeline, emptyEvents);
      expect(resultWithEmptyEvents.hasEvents).toBe(false);
      expect(resultWithEmptyEvents.windowFrames).toHaveLength(2);
    });

    it('extracts frames bounded by ADDRESS and FINISH with buffers', () => {
      // 20 frames total:
      // Frames 0-4: pre-swing
      // Frame 5: ADDRESS
      // Frame 10: TOP
      // Frame 12: IMPACT_PROXY
      // Frame 16: FINISH
      // Frames 17-19: post-swing
      const frames = [];
      for (let i = 0; i < 20; i++) {
        frames.push(createTestPoseFrame(i / 15, i));
      }
      const timeline = new PoseTimeline(frames, 20, 1000, 15);

      const events = makeEvents({
        ADDRESS: { frameIndex: 5, confidence: 0.9 },
        TOP: { frameIndex: 10, confidence: 0.9 },
        IMPACT_PROXY: { frameIndex: 12, confidence: 0.9 },
        FINISH: { frameIndex: 16, confidence: 0.9 },
      });

      const result = extractSwingWindow(timeline, events);
      expect(result.hasEvents).toBe(true);
      expect(result.addressFrameIndex).toBe(5);
      expect(result.finishFrameIndex).toBe(16);

      // Start should be Math.max(0, 5 - 1) = 4
      // End should be Math.min(19, 16 + 1) = 17
      // Sliced [4..17] inclusive -> 14 frames
      expect(result.windowFrames).toHaveLength(14);
      expect(result.windowFrames[0].frameIndex).toBe(4);
      expect(result.windowFrames[result.windowFrames.length - 1].frameIndex).toBe(17);
    });

    it('falls back to IMPACT_PROXY + buffer if FINISH is missing', () => {
      const frames = [];
      for (let i = 0; i < 30; i++) {
        frames.push(createTestPoseFrame(i / 15, i));
      }
      const timeline = new PoseTimeline(frames, 30, 1000, 15);

      const events = makeEvents({
        ADDRESS: { frameIndex: 5, confidence: 0.9 },
        TOP: { frameIndex: 10, confidence: 0.9 },
        IMPACT_PROXY: { frameIndex: 12, confidence: 0.9 },
      });

      const result = extractSwingWindow(timeline, events);
      expect(result.hasEvents).toBe(true);
      expect(result.addressFrameIndex).toBe(5);
      // End index should be impact (12) + 15 = 27
      expect(result.windowFrames[result.windowFrames.length - 1].frameIndex).toBe(27);
    });
  });

  describe('getAddressReferenceFrames', () => {
    it('returns frames around addressFrameIndex when present', () => {
      const frames = [];
      for (let i = 0; i < 10; i++) {
        frames.push(createTestPoseFrame(i / 15, i));
      }

      // Address is at frame 5
      const refFrames = getAddressReferenceFrames(frames, 5, 2);
      // Should pick [4, 5, 6]
      expect(refFrames.map(f => f.frameIndex)).toEqual([4, 5, 6]);
    });

    it('falls back to first N frames when addressFrameIndex is null', () => {
      const frames = [];
      for (let i = 0; i < 10; i++) {
        frames.push(createTestPoseFrame(i / 15, i));
      }

      const refFrames = getAddressReferenceFrames(frames, null, 3);
      expect(refFrames.map(f => f.frameIndex)).toEqual([0, 1, 2]);
    });
  });
});
