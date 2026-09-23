/**
 * p1p10Metrics.test.ts
 * SwingSwang – Tests
 *
 * Comprehensive unit tests for P1–P10 dedicated biomechanical coaching metrics:
 * 1. leadArmExtension (elbow angle at P7 / IMPACT_PROXY)
 * 2. xFactorStretch (shoulder-pelvis coil separation at P4 / TOP)
 * 3. finishBalance (lead-side posting and trail heel lift at P10 / FINISH)
 */

import { leadArmExtensionMetric } from '@/features/metrics/leadArmExtension';
import { xFactorStretchMetric } from '@/features/metrics/xFactorStretch';
import { finishBalanceMetric } from '@/features/metrics/finishBalance';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { LandmarkID } from '@/types/landmarks';
import { SwingEventResult } from '@/features/events/types';
import { createTestPoseFrame } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

function makeConfig(view: 'DTL' | 'FO' = 'FO', handedness: 'RIGHT' | 'LEFT' = 'RIGHT'): SwingConfig {
  return { cameraView: view, handedness, club: 'DRIVER' };
}

function makeTimeline(frames: ReturnType<typeof createTestPoseFrame>[]): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

function makeMockEvents(overrides?: Partial<Record<string, { frameIndex: number; timestampMs: number }>>): SwingEventResult {
  const p1 = overrides?.P1 ?? { frameIndex: 0, timestampMs: 0 };
  const p4 = overrides?.P4 ?? { frameIndex: 5, timestampMs: 500 };
  const p7 = overrides?.P7 ?? { frameIndex: 8, timestampMs: 800 };
  const p10 = overrides?.P10 ?? { frameIndex: 12, timestampMs: 1200 };

  const p1p10Events: any = {
    P1: { position: 'P1', semantic: 'ADDRESS', status: 'DETECTED_EXACT', ...p1 },
    P4: { position: 'P4', semantic: 'TOP_TRANSITION', status: 'DETECTED_EXACT', ...p4 },
    P7: { position: 'P7', semantic: 'IMPACT_PROXY', status: 'DETECTED_PROXY', ...p7 },
    P10: { position: 'P10', semantic: 'FINISH', status: 'DETECTED_EXACT', ...p10 },
  };

  const canonicalEvents: any[] = [
    { event: 'ADDRESS', ...p1, status: 'RELIABLE', confidence: 0.9, signals: {} },
    { event: 'TOP', ...p4, status: 'RELIABLE', confidence: 0.9, signals: {} },
    { event: 'IMPACT_PROXY', ...p7, status: 'RELIABLE', confidence: 0.9, signals: {} },
    { event: 'FINISH', ...p10, status: 'RELIABLE', confidence: 0.9, signals: {} },
  ];

  return {
    events: canonicalEvents,
    detectedCount: 4,
    reliableCount: 4,
    temporalOrderValid: true,
    warnings: [],
    ...({ p1p10Events } as any),
  } as any;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('P1–P10 Biomechanical Metrics', () => {
  // ──────────────────────────────────────────────────────────────────
  // 1. Lead Arm Extension
  // ──────────────────────────────────────────────────────────────────
  describe('leadArmExtensionMetric', () => {
    it('detects straight lead arm at impact (no chicken wing)', () => {
      // Right-handed golfer: lead side is LEFT (leftShoulder, leftElbow, leftWrist)
      // Frame 8 is impact (P7)
      const frames = [];
      for (let i = 0; i < 15; i++) {
        const isImpact = i === 8;
        frames.push(
          createTestPoseFrame(i / 10, i, {
            // Straight line along shoulder -> elbow -> wrist:
            // Shoulder: (0.42, 0.25), Elbow: (0.42, 0.40), Wrist: (0.42, 0.55) -> 180°
            [LandmarkID.leftShoulder]: { x: 0.42, y: 0.25 },
            [LandmarkID.leftElbow]: { x: 0.42, y: 0.40 },
            [LandmarkID.leftWrist]: { x: 0.42, y: 0.55 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = leadArmExtensionMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.id).toBe('leadArmExtension');
      expect(result.status).toBe('RELIABLE');
      expect(result.value).toBeCloseTo(180, 0);
      expect(result.unit).toBe('degrees');
      expect(result.evidence.chickenWingDetected).toBe(false);
      expect(result.warnings).not.toContain(
        'Lead arm flexion indicates early breakdown (chicken wing) through impact zone.',
      );
      expect(result.evidence.isProxy).toBe(true);
    });

    it('detects collapsed elbow at impact (chicken wing alert triggered)', () => {
      // Impact at frame 8: bent lead elbow (e.g. 90 degree flexion)
      const frames = [];
      for (let i = 0; i < 15; i++) {
        const isImpact = i === 8;
        frames.push(
          createTestPoseFrame(i / 10, i, {
            [LandmarkID.leftShoulder]: { x: 0.40, y: 0.25 },
            [LandmarkID.leftElbow]: { x: 0.40, y: 0.40 },
            // If wrist turns 90 degrees horizontally to (0.55, 0.40), elbow angle is 90°
            [LandmarkID.leftWrist]: isImpact ? { x: 0.55, y: 0.40 } : { x: 0.40, y: 0.55 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = leadArmExtensionMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.value).toBeCloseTo(90, 0);
      expect(result.evidence.chickenWingDetected).toBe(true);
      expect(result.warnings).toContain(
        'Lead arm flexion indicates early breakdown (chicken wing) through impact zone.',
      );
    });

    it('handles left-handed golfers by selecting right-side lead arm', () => {
      // Left-handed golfer: lead side is RIGHT
      const frames = [];
      for (let i = 0; i < 15; i++) {
        frames.push(
          createTestPoseFrame(i / 10, i, {
            // Straight right arm
            [LandmarkID.rightShoulder]: { x: 0.58, y: 0.25 },
            [LandmarkID.rightElbow]: { x: 0.58, y: 0.40 },
            [LandmarkID.rightWrist]: { x: 0.58, y: 0.55 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = leadArmExtensionMetric.calculate(timeline, makeConfig('FO', 'LEFT'), events);

      expect(result.value).toBeCloseTo(180, 0);
      expect(result.evidence.handedness).toBe('LEFT');
      expect(result.evidence.chickenWingDetected).toBe(false);
    });

    it('abstains cleanly if no impact event / P7 is detected', () => {
      const frames = [createTestPoseFrame(0, 0)];
      const timeline = makeTimeline(frames);

      // No events provided
      const result = leadArmExtensionMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), undefined);

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
      expect(result.warnings[0]).toContain('Lead arm extension kräver en detekterad träffposition');
    });

    it('abstains if lead arm landmarks are missing at P7', () => {
      const frames = [];
      for (let i = 0; i < 15; i++) {
        frames.push(
          createTestPoseFrame(i / 10, i, {
            // Exclude left elbow at impact
            [LandmarkID.leftElbow]: i === 8 ? null : { x: 0.42, y: 0.40 },
          }),
        );
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = leadArmExtensionMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.warnings[0]).toContain('Främre armens landmärken');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. X-Factor Stretch
  // ──────────────────────────────────────────────────────────────────
  describe('xFactorStretchMetric', () => {
    it('calculates significant coil separation at top (P4)', () => {
      const frames = [];
      for (let i = 0; i < 15; i++) {
        if (i === 0) {
          // P1 (Address): Shoulders and hips are both horizontal (0° separation)
          frames.push(
            createTestPoseFrame(0, 0, {
              [LandmarkID.leftShoulder]: { x: 0.40, y: 0.25 },
              [LandmarkID.rightShoulder]: { x: 0.60, y: 0.25 },
              [LandmarkID.leftHip]: { x: 0.45, y: 0.55 },
              [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
            }),
          );
        } else if (i === 5) {
          // P4 (Top): Shoulders turned ~45° tilt, hips remain near horizontal (~0°)
          // Shoulder vector: (0.54 - 0.40, 0.39 - 0.25) = (0.14, 0.14) -> angle 45°
          // Hip vector: (0.55 - 0.45, 0.55 - 0.55) = (0.10, 0) -> angle 0°
          // Separation = 45°
          frames.push(
            createTestPoseFrame(0.5, 5, {
              [LandmarkID.leftShoulder]: { x: 0.40, y: 0.25 },
              [LandmarkID.rightShoulder]: { x: 0.54, y: 0.39 },
              [LandmarkID.leftHip]: { x: 0.45, y: 0.55 },
              [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
            }),
          );
        } else {
          frames.push(createTestPoseFrame(i / 10, i));
        }
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = xFactorStretchMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.id).toBe('xFactorStretch');
      expect(result.status).toBe('RELIABLE');
      expect(result.value).toBeCloseTo(45, 0);
      expect(result.unit).toBe('degrees');
      expect(result.evidence.isRestricted).toBe(false);
      expect(result.warnings).not.toContain(expect.stringContaining('Limited shoulder-to-pelvis coil separation'));
    });

    it('detects restricted turn when coil separation is below 28°', () => {
      const frames = [];
      for (let i = 0; i < 15; i++) {
        if (i === 0) {
          // Address
          frames.push(
            createTestPoseFrame(0, 0, {
              [LandmarkID.leftShoulder]: { x: 0.40, y: 0.25 },
              [LandmarkID.rightShoulder]: { x: 0.60, y: 0.25 },
              [LandmarkID.leftHip]: { x: 0.45, y: 0.55 },
              [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
            }),
          );
        } else if (i === 5) {
          // P4 (Top): Weak turn, shoulders only tilted ~15° relative to hips
          // dx = 0.20 * cos(15°) ≈ 0.193, dy = 0.20 * sin(15°) ≈ 0.0518
          frames.push(
            createTestPoseFrame(0.5, 5, {
              [LandmarkID.leftShoulder]: { x: 0.40, y: 0.25 },
              [LandmarkID.rightShoulder]: { x: 0.593, y: 0.302 },
              [LandmarkID.leftHip]: { x: 0.45, y: 0.55 },
              [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
            }),
          );
        } else {
          frames.push(createTestPoseFrame(i / 10, i));
        }
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = xFactorStretchMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.value).toBeLessThan(28);
      expect(result.evidence.isRestricted).toBe(true);
      expect(result.warnings).toContain('Limited shoulder-to-pelvis coil separation at top (< 28°).');
    });

    it('abstains if P4 or P1 event is missing', () => {
      const frames = [createTestPoseFrame(0, 0)];
      const timeline = makeTimeline(frames);

      const result = xFactorStretchMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), undefined);
      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.warnings[0]).toContain('X-Factor kräver en detekterad topposition');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. Finish Balance
  // ──────────────────────────────────────────────────────────────────
  describe('finishBalanceMetric', () => {
    it('disallows non-FO camera views (abstained with explanation)', () => {
      const frames = [createTestPoseFrame(0, 0)];
      const timeline = makeTimeline(frames);
      const events = makeMockEvents();

      const result = finishBalanceMetric.calculate(timeline, makeConfig('DTL', 'RIGHT'), events);
      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.warnings[0]).toContain('requires Face-On (FO) camera view');
    });

    it('rewards solid lead-side posting and trail heel lift at finish (P10)', () => {
      // Right-handed: lead ankle is leftAnkle, trail ankle is rightAnkle
      // Stance width: 0.57 - 0.43 = 0.14
      // Lead ankle at x: 0.43, y: 0.90
      // Mid-hip stacked directly over lead ankle:
      // leftHip at 0.38, rightHip at 0.48 -> midHip.x = 0.43 (dx = 0!)
      // Trail heel elevated: rightAnkle.y = 0.82 (higher than leadAnkle at 0.90 -> dy = 0.08)
      const frames = [];
      for (let i = 0; i < 15; i++) {
        if (i === 12) {
          frames.push(
            createTestPoseFrame(1.2, 12, {
              [LandmarkID.leftAnkle]: { x: 0.43, y: 0.90 },
              [LandmarkID.rightAnkle]: { x: 0.57, y: 0.82 }, // trail heel lifted
              [LandmarkID.leftHip]: { x: 0.38, y: 0.55 },
              [LandmarkID.rightHip]: { x: 0.48, y: 0.55 }, // mid-hip is 0.43
            }),
          );
        } else {
          frames.push(createTestPoseFrame(i / 10, i));
        }
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = finishBalanceMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.id).toBe('finishBalance');
      expect(result.status).toBe('RELIABLE');
      expect(result.value).toBeGreaterThanOrEqual(80);
      expect(result.unit).toBe('%');
      expect(result.evidence.isHangingBack).toBe(false);
      expect(result.evidence.weightTransferComplete).toBe(true);
      expect(result.warnings).not.toContain(expect.stringContaining('Weight hanging back'));
    });

    it('detects hanging back (reverse pivot) when weight stays on trail foot', () => {
      // Hanging back at P10:
      // Lead ankle at 0.43, trail ankle at 0.57
      // Mid-hip hangs over trail ankle: leftHip at 0.52, rightHip at 0.62 -> midHip.x = 0.57
      // dx from lead ankle = 0.14 = stanceWidth! stackRatio = 0!
      // Trail foot flat: rightAnkle.y = 0.90 (same as lead ankle)
      const frames = [];
      for (let i = 0; i < 15; i++) {
        if (i === 12) {
          frames.push(
            createTestPoseFrame(1.2, 12, {
              [LandmarkID.leftAnkle]: { x: 0.43, y: 0.90 },
              [LandmarkID.rightAnkle]: { x: 0.57, y: 0.90 }, // trail heel NOT lifted
              [LandmarkID.leftHip]: { x: 0.52, y: 0.55 },
              [LandmarkID.rightHip]: { x: 0.62, y: 0.55 }, // mid-hip is 0.57 (over trail foot)
            }),
          );
        } else {
          frames.push(createTestPoseFrame(i / 10, i));
        }
      }

      const timeline = makeTimeline(frames);
      const events = makeMockEvents();
      const result = finishBalanceMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), events);

      expect(result.value).toBeLessThan(60);
      expect(result.evidence.isHangingBack).toBe(true);
      expect(result.warnings).toContain('Weight hanging back on trail side at finish (< 60% lead-side post).');
    });

    it('abstains if P10 / FINISH event is missing', () => {
      const frames = [createTestPoseFrame(0, 0)];
      const timeline = makeTimeline(frames);

      const result = finishBalanceMetric.calculate(timeline, makeConfig('FO', 'RIGHT'), undefined);
      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.warnings[0]).toContain('Finish balance kräver en detekterad avslutsposition');
    });
  });
});
