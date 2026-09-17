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
  checkAddressPosture,
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

  describe('checkAddressPosture', () => {
    it('accepts standard full-body golf address posture', () => {
      const frame = createTestPoseFrame(0, 0);
      const result = checkAddressPosture(frame, 'FO');
      expect(result.isValid).toBe(true);
      expect(result.isRelaxed).toBe(false);
    });

    it('accepts relaxed address posture when lower body landmarks are missing', () => {
      const frame = createTestPoseFrame(0, 0, {
        [LandmarkID.leftKnee]: null,
        [LandmarkID.rightKnee]: null,
        [LandmarkID.leftAnkle]: null,
        [LandmarkID.rightAnkle]: null,
      });
      const result = checkAddressPosture(frame, 'FO');
      expect(result.isValid).toBe(true);
      expect(result.isRelaxed).toBe(true);
    });

    it('rejects posture when hands are raised above shoulders', () => {
      const frame = createTestPoseFrame(0, 0, {
        [LandmarkID.leftWrist]: { x: 0.45, y: 0.15 }, // above shoulders at y=0.25
        [LandmarkID.rightWrist]: { x: 0.55, y: 0.15 },
      });
      const result = checkAddressPosture(frame, 'FO');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Hands not hanging down below shoulders');
    });

    it('rejects posture when hands are stretched outside shoulder width in Face-On', () => {
      const frame = createTestPoseFrame(0, 0, {
        // Shoulders are at 0.42 and 0.58
        [LandmarkID.leftWrist]: { x: 0.85, y: 0.50 }, // Far to the right
        [LandmarkID.rightWrist]: { x: 0.90, y: 0.50 },
      });
      const result = checkAddressPosture(frame, 'FO');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Hands not centered');
    });
  });

  describe('address posture validation in swing event detector', () => {
    it('ignores early non-address stillness and picks the real address posture', () => {
      // Create a 15-frame timeline:
      // Frames 0-4: Still, but hands are raised above shoulders (e.g. adjusting hat/grip)
      // Frames 5-9: Still, in valid golf address posture
      // Frames 10-14: Takeaway motion
      const frames: PoseFrame[] = [];
      for (let i = 0; i < 5; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.50, y: 0.15 },
            [LandmarkID.rightWrist]: { x: 0.50, y: 0.15 },
          })
        );
      }
      for (let i = 5; i < 10; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.45, y: 0.50 },
            [LandmarkID.rightWrist]: { x: 0.55, y: 0.50 },
          })
        );
      }
      for (let i = 10; i < 15; i++) {
        const step = (i - 9) * 0.05;
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.45 + step, y: 0.50 - step },
            [LandmarkID.rightWrist]: { x: 0.55 + step, y: 0.50 - step },
          })
        );
      }

      const timeline = toTimeline(frames);
      const result = detector.detect(timeline, { cameraView: 'FO', handedness: 'RIGHT', club: 'DRIVER' });

      const address = getEventByType(result.events, 'ADDRESS');
      expect(address?.status).toBe('RELIABLE');
      // Address frame should be in the second still sequence (frames 5-9), around frame 7
      expect(address?.frameIndex).toBeGreaterThanOrEqual(5);
      expect(address?.frameIndex).toBeLessThan(10);
    });

    it('marks ADDRESS as NOT_RELIABLE when no golf address posture is adopted', () => {
      // Stationary timeline where hands are always above shoulders
      const frames: PoseFrame[] = [];
      for (let i = 0; i < 10; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftWrist]: { x: 0.50, y: 0.15 },
            [LandmarkID.rightWrist]: { x: 0.50, y: 0.15 },
          })
        );
      }
      const timeline = toTimeline(frames);
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      const address = getEventByType(result.events, 'ADDRESS');
      expect(address?.status).toBe('NOT_RELIABLE');
      expect(result.warnings).toContain('No valid golf address posture detected');
    });

    it('emits warning when relaxed address posture is used', () => {
      // Cropped timeline without legs
      const frames: PoseFrame[] = [];
      for (let i = 0; i < 5; i++) {
        frames.push(
          createTestPoseFrame(i / 15, i, {
            [LandmarkID.leftKnee]: null,
            [LandmarkID.rightKnee]: null,
            [LandmarkID.leftAnkle]: null,
            [LandmarkID.rightAnkle]: null,
          })
        );
      }
      const timeline = toTimeline(frames);
      const result = detector.detect(timeline, DEFAULT_SWING_CONFIG);

      const address = getEventByType(result.events, 'ADDRESS');
      expect(address?.status).toBe('RELIABLE');
      expect(result.warnings).toContain('Relaxed address posture criteria used: lower body landmarks not fully visible');
    });
  });

  describe('cameraView support (FO and DTL)', () => {
    it('detects events successfully with cameraView = FO', () => {
      const timeline = createSwingTimeline({ duration: 3, fps: 15 });
      const result = detector.detect(timeline, {
        cameraView: 'FO',
        handedness: 'RIGHT',
        club: 'DRIVER',
      });

      expect(result.events).toHaveLength(8);
      const address = getEventByType(result.events, 'ADDRESS');
      const takeaway = getEventByType(result.events, 'TAKEAWAY');
      const top = getEventByType(result.events, 'TOP');

      expect(address?.status).toBe('RELIABLE');
      expect(takeaway?.status).toBe('RELIABLE');
      expect(top?.status).toBe('RELIABLE');
      expect(takeaway?.signals.isDTL).toBe(false);
      expect(top?.signals.isDTL).toBe(false);
    });

    it('detects events successfully with cameraView = DTL', () => {
      const timeline = createSwingTimeline({ duration: 3, fps: 15 });
      const result = detector.detect(timeline, {
        cameraView: 'DTL',
        handedness: 'RIGHT',
        club: 'DRIVER',
      });

      expect(result.events).toHaveLength(8);
      const address = getEventByType(result.events, 'ADDRESS');
      const takeaway = getEventByType(result.events, 'TAKEAWAY');
      const top = getEventByType(result.events, 'TOP');

      expect(address?.status).toBe('RELIABLE');
      expect(takeaway?.status).toBe('RELIABLE');
      expect(top?.status).toBe('RELIABLE');
      expect(takeaway?.signals.isDTL).toBe(true);
      expect(top?.signals.isDTL).toBe(true);
    });
  });

  describe('untrimmed swing with high finish pose (P1-P10 discrimination)', () => {
    it('correctly identifies TOP on trail side and FINISH on lead side even when finish is higher and held longer', () => {
      // 100 frames at 15 FPS (~6.7s):
      // Frames 0-35: Address setup and stillness
      // Frames 36-55: Backswing moving to trail side (x increasing to 0.65, y decreasing to 0.20)
      // Frame 56: TOP of backswing (wristY = 0.18, trail side x = 0.65, feet planted)
      // Frames 57-63: Rapid downswing dropping to address height (peak velocity)
      // Frame 64: IMPACT near address height (wristY = 0.50, x = 0.48)
      // Frames 65-72: Follow-through moving to lead side (x decreasing to 0.32, y decreasing to 0.14)
      // Frames 73-88: FINISH pose — wrists higher than top (y = 0.14), held still for 15 frames, trail heel lifted
      // Frames 89-99: Relaxing
      const totalFrames = 100;
      const fps = 15;
      const frames: PoseFrame[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i / fps;
        let wx = 0.50;
        let wy = 0.50;
        let trailAnkleY = 0.85;

        if (i <= 35) {
          // Address
          wx = 0.50;
          wy = 0.50;
        } else if (i <= 55) {
          // Backswing
          const p = (i - 35) / 20;
          wx = 0.50 + p * 0.15; // moves trail (0.65)
          wy = 0.50 - p * 0.32; // rises (0.18)
        } else if (i === 56) {
          // TOP
          wx = 0.65;
          wy = 0.18;
        } else if (i <= 63) {
          // Downswing (very fast)
          const p = (i - 56) / 7;
          wx = 0.65 - p * 0.17; // moves towards lead
          wy = 0.18 + p * 0.32; // drops fast to address height
        } else if (i === 64) {
          // IMPACT
          wx = 0.48;
          wy = 0.50;
        } else if (i <= 72) {
          // Follow-through
          const p = (i - 64) / 8;
          wx = 0.48 - p * 0.16; // 0.32 lead side
          wy = 0.50 - p * 0.36; // 0.14 (higher than top!)
          trailAnkleY = 0.85 - p * 0.10; // trail heel lifts (toe roll)
        } else if (i <= 88) {
          // FINISH pose held still
          wx = 0.32;
          wy = 0.14; // hands higher than at top!
          trailAnkleY = 0.75; // trail heel held up
        } else {
          // Lowering club
          wx = 0.45;
          wy = 0.55;
          trailAnkleY = 0.85;
        }

        frames.push(
          createTestPoseFrame(timestamp, i, {
            [LandmarkID.leftWrist]: { x: wx - 0.05, y: wy },
            [LandmarkID.rightWrist]: { x: wx + 0.05, y: wy },
            [LandmarkID.leftShoulder]: { x: 0.42, y: 0.25 },
            [LandmarkID.rightShoulder]: { x: 0.58, y: 0.25 },
            [LandmarkID.leftHip]: { x: 0.45, y: 0.55 },
            [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
            [LandmarkID.leftAnkle]: { x: 0.45, y: 0.85 },
            [LandmarkID.rightAnkle]: { x: 0.55, y: trailAnkleY },
          })
        );
      }

      const timeline = new PoseTimeline(frames, totalFrames, 1000, fps);
      const result = detector.detect(timeline, {
        cameraView: 'FO',
        handedness: 'RIGHT',
        club: 'MID_IRON',
      });

      const top = getEventByType(result.events, 'TOP');
      const impact = getEventByType(result.events, 'IMPACT_PROXY');
      const finish = getEventByType(result.events, 'FINISH');
      const address = getEventByType(result.events, 'ADDRESS');

      expect(result.temporalOrderValid).toBe(true);

      // TOP must be around frame 56 (at ~3.7s), NOT at frame 80 (in the finish)!
      expect(top?.status).toBe('RELIABLE');
      expect(top?.frameIndex).toBeGreaterThanOrEqual(50);
      expect(top?.frameIndex).toBeLessThanOrEqual(60);

      // IMPACT must be around frame 64
      expect(impact?.status).toBe('RELIABLE');
      expect(impact?.frameIndex).toBeGreaterThanOrEqual(60);
      expect(impact?.frameIndex).toBeLessThanOrEqual(70);

      // FINISH must be in the finish pose (frames 73-88)
      expect(finish?.status).toBe('RELIABLE');
      expect(finish?.frameIndex).toBeGreaterThanOrEqual(73);

      // ADDRESS must immediately precede the swing (around frame 30-36)
      expect(address?.status).toBe('RELIABLE');
      expect(address?.frameIndex).toBeGreaterThanOrEqual(15);
      expect(address?.frameIndex).toBeLessThan(40);
    });
  });
});

