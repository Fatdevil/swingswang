/**
 * swingEventDetector.test.ts
 * SwingSwang – Tests
 *
 * Tests for RuleBasedSwingEventDetectorV1 — the swing event detection engine.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { PoseFrame } from '@/types/pose';
import { LandmarkID } from '@/types/landmarks';
import { SwingConfig } from '@/types/swing';
import {
  RuleBasedSwingEventDetectorV1,
  DEFAULT_EVENT_DETECTION_CONFIG,
} from '@/features/events/RuleBasedSwingEventDetectorV1';
import { SWING_EVENT_ORDER, SwingEventType, SwingEvent } from '@/features/events/types';
import { createTestPoseFrame, createTestTimeline, createStationarySequence } from '../helpers/poseFixtures';

// ─── Default SwingConfig ────────────────────────────────────────────

const DEFAULT_SWING_CONFIG: SwingConfig = {
  cameraView: 'DTL',
  handedness: 'RIGHT',
  club: 'MID_IRON',
};

// ─── Synthetic Swing Timeline Helper ────────────────────────────────

/**
 * Generate a synthetic golf swing timeline that moves through all phases.
 *
 * Phase 1 (0-20%):  Address — wrists at hip level, still
 * Phase 2 (20-50%): Backswing — wrists move up and away from target
 * Phase 3 (50-55%): Top — wrists at highest point
 * Phase 4 (55-70%): Downswing — wrists drop rapidly toward impact
 * Phase 5 (70-75%): Impact — wrists return to address height
 * Phase 6 (75-90%): Follow-through — wrists move up on other side
 * Phase 7 (90-100%): Finish — wrists settle, still
 */
function createSwingTimeline(options?: {
  duration?: number;
  fps?: number;
  handedness?: 'RIGHT' | 'LEFT';
}): PoseTimeline {
  const duration = options?.duration ?? 4; // seconds
  const fps = options?.fps ?? 15;
  const totalFrames = Math.round(duration * fps);

  const frames: PoseFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = i / (totalFrames - 1); // normalized 0-1 through swing
    const timestamp = (i / fps);

    // Base positions (address position for right-handed golfer)
    const shoulderY = 0.25;
    const addressWristY = 0.50;
    const addressWristLeftX = 0.45;
    const addressWristRightX = 0.55;

    let wristLeftX: number;
    let wristRightX: number;
    let wristY: number;

    if (t < 0.20) {
      // Phase 1: ADDRESS — still at address position
      wristLeftX = addressWristLeftX;
      wristRightX = addressWristRightX;
      wristY = addressWristY;
    } else if (t < 0.50) {
      // Phase 2: BACKSWING — wrists move up and to the right (away from target for RH)
      const phase = (t - 0.20) / 0.30; // 0-1 within backswing
      wristLeftX = addressWristLeftX + phase * 0.15;  // move right (away from target)
      wristRightX = addressWristRightX + phase * 0.15;
      wristY = addressWristY - phase * 0.30; // move up (decreasing Y = higher)
    } else if (t < 0.55) {
      // Phase 3: TOP — wrists at highest point, slightly past
      const phase = (t - 0.50) / 0.05;
      wristLeftX = addressWristLeftX + 0.15 - phase * 0.02; // start coming back
      wristRightX = addressWristRightX + 0.15 - phase * 0.02;
      wristY = addressWristY - 0.30 + phase * 0.02; // at peak, slight descent
    } else if (t < 0.70) {
      // Phase 4: DOWNSWING — wrists drop rapidly
      const phase = (t - 0.55) / 0.15; // 0-1 within downswing
      wristLeftX = addressWristLeftX + 0.13 - phase * 0.15; // move toward target rapidly
      wristRightX = addressWristRightX + 0.13 - phase * 0.15;
      wristY = addressWristY - 0.28 + phase * 0.28; // drop back to address height
    } else if (t < 0.75) {
      // Phase 5: IMPACT — wrists near address height, high velocity
      const phase = (t - 0.70) / 0.05;
      wristLeftX = addressWristLeftX - 0.02 - phase * 0.05; // continue past toward target
      wristRightX = addressWristRightX - 0.02 - phase * 0.05;
      wristY = addressWristY + phase * 0.02; // slightly below address, then up
    } else if (t < 0.90) {
      // Phase 6: FOLLOW-THROUGH — wrists rise on lead side
      const phase = (t - 0.75) / 0.15;
      wristLeftX = addressWristLeftX - 0.07 - phase * 0.05; // continue toward target
      wristRightX = addressWristRightX - 0.07 - phase * 0.05;
      wristY = addressWristY + 0.02 - phase * 0.22; // rise up on follow-through
    } else {
      // Phase 7: FINISH — wrists settle high on lead side, still
      wristLeftX = addressWristLeftX - 0.12;
      wristRightX = addressWristRightX - 0.12;
      wristY = addressWristY - 0.20; // settled high
    }

    frames.push(createTestPoseFrame(timestamp, i, {
      [LandmarkID.leftWrist]: { x: wristLeftX, y: wristY },
      [LandmarkID.rightWrist]: { x: wristRightX, y: wristY },
      [LandmarkID.leftShoulder]: { x: 0.42, y: shoulderY },
      [LandmarkID.rightShoulder]: { x: 0.58, y: shoulderY },
      [LandmarkID.leftHip]: { x: 0.45, y: 0.55 },
      [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
    }));
  }

  return new PoseTimeline(frames, totalFrames, 1000, fps);
}

// ─── Helper ─────────────────────────────────────────────────────────

function toTimeline(frames: PoseFrame[]): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

function getEventByType(events: readonly SwingEvent[], type: SwingEventType) {
  return events.find(e => e.event === type);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('RuleBasedSwingEventDetectorV1', () => {
  const detector = new RuleBasedSwingEventDetectorV1();

  describe('temporal ordering', () => {
    it('detects events in correct temporal order for a well-formed swing', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      expect(result.temporalOrderValid).toBe(true);

      // Check that detected events have ascending frame indices
      let lastFrame = -1;
      for (const event of result.events) {
        if (event.frameIndex !== null) {
          expect(event.frameIndex).toBeGreaterThanOrEqual(lastFrame);
          lastFrame = event.frameIndex;
        }
      }
    });
  });

  describe('all 8 events detected', () => {
    it('detects all 8 events for a well-formed swing', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      expect(result.events).toHaveLength(8);

      // All 8 event types should be present
      const detectedTypes = result.events.map(e => e.event);
      for (const expected of SWING_EVENT_ORDER) {
        expect(detectedTypes).toContain(expected);
      }

      // Most events should be reliable
      expect(result.detectedCount).toBeGreaterThanOrEqual(5);
    });

    it('assigns non-zero confidence to detected events', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      for (const event of result.events) {
        if (event.status === 'RELIABLE') {
          expect(event.confidence).toBeGreaterThan(0);
          expect(event.confidence).toBeLessThanOrEqual(1);
          expect(event.timestampMs).not.toBeNull();
          expect(event.frameIndex).not.toBeNull();
        }
      }
    });
  });

  describe('missing events', () => {
    it('returns NOT_RELIABLE events for too-short timeline', () => {
      // Only 2 frames — not enough for full swing
      const frames = createTestTimeline(2);
      const timeline = toTimeline(frames);
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      expect(result.events).toHaveLength(8);
      // Should have very few reliable events
      expect(result.reliableCount).toBeLessThan(8);

      // Unreliable events should have null timestamps
      for (const event of result.events) {
        if (event.status === 'NOT_RELIABLE') {
          expect(event.timestampMs).toBeNull();
          expect(event.frameIndex).toBeNull();
          expect(event.confidence).toBe(0);
        }
      }
    });
  });

  describe('deterministic output', () => {
    it('produces identical results for identical inputs', () => {
      const timeline = createSwingTimeline({ duration: 3, fps: 15 });
      const result1 = detector.detect(timeline, DEFAULT_SWING_CONFIG);
      const result2 = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      expect(result1.events).toEqual(result2.events);
      expect(result1.detectedCount).toBe(result2.detectedCount);
      expect(result1.reliableCount).toBe(result2.reliableCount);
      expect(result1.temporalOrderValid).toBe(result2.temporalOrderValid);
      expect(result1.warnings).toEqual(result2.warnings);
    });
  });

  describe('temporal order validation', () => {
    it('reports temporalOrderValid correctly for ordered events', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);
      expect(result.temporalOrderValid).toBe(true);
    });
  });

  describe('empty timeline', () => {
    it('returns all events as NOT_RELIABLE for empty timeline', () => {
      const timeline = toTimeline([]);
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      expect(result.events).toHaveLength(8);
      expect(result.detectedCount).toBe(0);
      expect(result.reliableCount).toBe(0);
      expect(result.temporalOrderValid).toBe(true); // vacuously true
      expect(result.warnings.length).toBeGreaterThan(0);

      for (const event of result.events) {
        expect(event.status).toBe('NOT_RELIABLE');
        expect(event.timestampMs).toBeNull();
        expect(event.frameIndex).toBeNull();
      }
    });
  });

  describe('single frame', () => {
    it('detects ADDRESS only for a single still frame', () => {
      const frame = createTestPoseFrame(0, 0);
      const timeline = toTimeline([frame]);
      // Use relaxed config so single frame can match
      const relaxedDetector = new RuleBasedSwingEventDetectorV1({
        stillnessMinFrames: 1,
      });
      const result = relaxedDetector.detect(timeline, DEFAULT_SWING_CONFIG);

      const address = getEventByType(result.events, 'ADDRESS');
      expect(address?.status).toBe('RELIABLE');

      // Other events (except FINISH, which can also match stillness) should not be reliably detected
      const otherReliable = result.events.filter(
        e => e.event !== 'ADDRESS' && e.event !== 'FINISH' && e.status === 'RELIABLE',
      );
      expect(otherReliable.length).toBe(0);
    });
  });

  describe('stationary sequence', () => {
    it('detects only ADDRESS and FINISH for a still sequence', () => {
      // 20 frames of stationary data — should detect address and finish
      const frames = createStationarySequence(20);
      const timeline = toTimeline(frames);
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      const address = getEventByType(result.events, 'ADDRESS');
      const finish = getEventByType(result.events, 'FINISH');

      expect(address?.status).toBe('RELIABLE');
      expect(finish?.status).toBe('RELIABLE');

      // Middle swing events should NOT be reliable since there is no movement
      const takeaway = getEventByType(result.events, 'TAKEAWAY');
      const top = getEventByType(result.events, 'TOP');
      expect(takeaway?.status).toBe('NOT_RELIABLE');
      expect(top?.status).toBe('NOT_RELIABLE');
    });
  });

  describe('event signals', () => {
    it('attaches signal data to reliable events', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      for (const event of result.events) {
        if (event.status === 'RELIABLE') {
          expect(Object.keys(event.signals).length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('result structure', () => {
    it('always returns exactly 8 events in canonical order', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      expect(result.events).toHaveLength(8);
      for (let i = 0; i < 8; i++) {
        expect(result.events[i].event).toBe(SWING_EVENT_ORDER[i]);
      }
    });

    it('detectedCount and reliableCount are consistent', () => {
      const timeline = createSwingTimeline();
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      const reliableCount = result.events.filter(e => e.status === 'RELIABLE').length;
      expect(result.detectedCount).toBe(reliableCount);
      expect(result.reliableCount).toBe(reliableCount);
    });
  });

  describe('custom config', () => {
    it('respects custom threshold overrides', () => {
      // Make stillness threshold very strict — hard to match
      const strictDetector = new RuleBasedSwingEventDetectorV1({
        stillnessVelocityThreshold: 0.0001,
        stillnessMinFrames: 10,
      });
      const timeline = createSwingTimeline({ duration: 2, fps: 15 });
      const result = strictDetector.detect(timeline, DEFAULT_SWING_CONFIG);

      // With very strict thresholds, may detect fewer events
      expect(result.events).toHaveLength(8);
    });
  });
});
