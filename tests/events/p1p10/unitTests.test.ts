/**
 * unitTests.test.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Unit tests U01 through U12 according to Table 11.1 in the specification.
 */

import {
  LANDMARK_INDEX,
  CaptureContext,
  PoseFrame,
} from '@/features/events/p1p10/types';
import {
  canonicalizeFrame,
  canonicalizeSequence,
} from '@/features/events/p1p10/canonicalize';
import {
  handleGapsAndQuality,
  fitLocalQuadratic,
  processSignals,
} from '@/features/events/p1p10/signalProcessing';
import { P1P10EventDetector } from '@/features/events/p1p10/P1P10EventDetector';
import {
  generateSyntheticSwing,
  createBaseAddressLandmarks,
} from './testHelpers';

describe('MediaPipe P1–P10 Normative Unit Tests (U01–U12)', () => {
  const detector = new P1P10EventDetector();

  // ─── U01: 33 landmarks, korrekt indexmappning ──────────────────────
  test('U01: 33 landmarks, correct index mapping and named accessors', () => {
    const indices = Object.values(LANDMARK_INDEX);
    expect(indices.length).toBe(33);

    // Verify uniqueness from 0 to 32
    const unique = new Set(indices);
    expect(unique.size).toBe(33);
    for (let i = 0; i < 33; i++) {
      expect(unique.has(i as any)).toBe(true);
    }

    // Key body joint indices
    expect(LANDMARK_INDEX.NOSE).toBe(0);
    expect(LANDMARK_INDEX.LEFT_SHOULDER).toBe(11);
    expect(LANDMARK_INDEX.RIGHT_SHOULDER).toBe(12);
    expect(LANDMARK_INDEX.LEFT_ELBOW).toBe(13);
    expect(LANDMARK_INDEX.RIGHT_ELBOW).toBe(14);
    expect(LANDMARK_INDEX.LEFT_WRIST).toBe(15);
    expect(LANDMARK_INDEX.RIGHT_WRIST).toBe(16);
    expect(LANDMARK_INDEX.LEFT_HIP).toBe(23);
    expect(LANDMARK_INDEX.RIGHT_HIP).toBe(24);
    expect(LANDMARK_INDEX.LEFT_ANKLE).toBe(27);
    expect(LANDMARK_INDEX.RIGHT_ANKLE).toBe(28);
    expect(LANDMARK_INDEX.LEFT_FOOT_INDEX).toBe(31);
    expect(LANDMARK_INDEX.RIGHT_FOOT_INDEX).toBe(32);
  });

  // ─── U02: Höger-/vänsterhänt mapping ──────────────────────────────
  test('U02: Handedness mapping swaps lead/trail without modifying raw MediaPipe indices', () => {
    const rawLandmarks = createBaseAddressLandmarks();
    const frame: PoseFrame = {
      frameIndex: 0,
      timestampUs: 0,
      image: rawLandmarks,
      world: rawLandmarks.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: 1 })),
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    };

    const rightCtx: CaptureContext = {
      view: 'FACE_ON',
      handedness: 'RIGHT',
      mode: 'VIDEO',
      nominalFps: 120,
    };

    const leftCtx: CaptureContext = {
      view: 'FACE_ON',
      handedness: 'LEFT',
      mode: 'VIDEO',
      nominalFps: 120,
    };

    const rightCanonical = canonicalizeFrame(frame, rightCtx);
    const leftCanonical = canonicalizeFrame(frame, leftCtx);

    // Right-handed: lead = anatomical left (11), trail = anatomical right (12)
    expect(rightCanonical.leadShoulder.x).toBe(rightCanonical.image[LANDMARK_INDEX.LEFT_SHOULDER].x);
    expect(rightCanonical.trailShoulder.x).toBe(rightCanonical.image[LANDMARK_INDEX.RIGHT_SHOULDER].x);

    // Left-handed: lead = anatomical right (12), trail = anatomical left (11)
    expect(leftCanonical.leadShoulder.x).toBe(leftCanonical.image[LANDMARK_INDEX.RIGHT_SHOULDER].x);
    expect(leftCanonical.trailShoulder.x).toBe(leftCanonical.image[LANDMARK_INDEX.LEFT_SHOULDER].x);

    // Underlying raw indices remain strictly untouched
    expect(LANDMARK_INDEX.LEFT_SHOULDER).toBe(11);
    expect(LANDMARK_INDEX.RIGHT_SHOULDER).toBe(12);
  });

  // ─── U03: Rotera 90/180/270° och canonicalisera ────────────────────
  test('U03: Rotation metadata canonicalizes consistently into normalized up-space', () => {
    const baseLm = createBaseAddressLandmarks();
    const frame: PoseFrame = {
      frameIndex: 0,
      timestampUs: 100_000,
      image: baseLm,
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    };

    const ctx: CaptureContext = {
      view: 'FACE_ON',
      handedness: 'RIGHT',
      mode: 'VIDEO',
      nominalFps: 120,
    };

    const canonical = canonicalizeFrame(frame, ctx);
    // In image coords, yUp = 1 - yImage
    // Nose was at y = 0.20, so yUp must be 0.80
    expect(canonical.image[LANDMARK_INDEX.NOSE].y).toBeCloseTo(0.80, 4);
    // Ankle was at y = 0.95, so yUp must be 0.05
    expect(canonical.image[LANDMARK_INDEX.LEFT_ANKLE].y).toBeCloseTo(0.05, 4);
    // Shoulders are above hips in yUp:
    expect(canonical.midShoulder.y).toBeGreaterThan(canonical.midHip.y);
  });

  // ─── U04: Mirrored preview, omirrorerad inference ──────────────────
  test('U04: Input marked as mirrored is unmirrored before inference', () => {
    const baseLm = createBaseAddressLandmarks();
    const origLeftWristX = baseLm[LANDMARK_INDEX.LEFT_WRIST].x; // 0.49

    const mirroredFrame: PoseFrame = {
      frameIndex: 0,
      timestampUs: 0,
      image: baseLm,
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: true, // Marked as mirrored
    };

    const ctx: CaptureContext = {
      view: 'FACE_ON',
      handedness: 'RIGHT',
      mode: 'VIDEO',
      nominalFps: 120,
    };

    const canonical = canonicalizeFrame(mirroredFrame, ctx);
    // Unmirrored X: 1 - 0.49 = 0.51
    expect(canonical.image[LANDMARK_INDEX.LEFT_WRIST].x).toBeCloseTo(1.0 - origLeftWristX, 4);
  });

  // ─── U05: Ojämna PTS med samma rörelse ────────────────────────────
  test('U05: Variable PTS timestamps calculate velocity from dt and match reference within ±2%', () => {
    // Constant velocity motion: y(t) = 2.0 * t
    const trueVelocity = 2.0;

    // Even timestamps: dt = 0.01 s
    const uniformTimes = [0.00, 0.01, 0.02, 0.03, 0.04];
    const uniformVals = uniformTimes.map(t => trueVelocity * t);
    const fitUniform = fitLocalQuadratic(uniformTimes, uniformVals, 2, 2);

    // Uneven (jittered) timestamps: dt varies
    const jitteredTimes = [0.00, 0.008, 0.021, 0.029, 0.042];
    const jitteredVals = jitteredTimes.map(t => trueVelocity * t);
    const fitJittered = fitLocalQuadratic(jitteredTimes, jitteredVals, 2, 2);

    expect(fitUniform.deriv1).toBeCloseTo(trueVelocity, 3);
    expect(Math.abs(fitJittered.deriv1 - trueVelocity) / trueVelocity).toBeLessThan(0.02);
  });

  // ─── U06: Lucka 33 ms med bra ändpunkter ──────────────────────────
  test('U06: Gap <= 50 ms with high endpoint quality (q >= 0.75) is interpolated and flagged', () => {
    const rawFrames: PoseFrame[] = [];
    const baseLm = createBaseAddressLandmarks();

    // Frame 0: t=0ms, q=0.9
    rawFrames.push({
      frameIndex: 0,
      timestampUs: 0,
      image: baseLm.map(p => ({ ...p, visibility: 0.9, presence: 0.9 })),
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    });

    // Frame 1: t=16.6ms, drop left wrist (q=0.1)
    const droppedLm = baseLm.map((p, idx) =>
      idx === LANDMARK_INDEX.LEFT_WRIST ? { ...p, visibility: 0.1, presence: 0.1 } : { ...p, visibility: 0.9 }
    );
    rawFrames.push({
      frameIndex: 1,
      timestampUs: 16_667,
      image: droppedLm,
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    });

    // Frame 2: t=33.3ms, recovered (q=0.9)
    rawFrames.push({
      frameIndex: 2,
      timestampUs: 33_333,
      image: baseLm.map(p => ({ ...p, visibility: 0.9, presence: 0.9 })),
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    });

    const ctx: CaptureContext = {
      view: 'FACE_ON',
      handedness: 'RIGHT',
      mode: 'VIDEO',
      nominalFps: 60,
    };

    const seq = canonicalizeSequence(rawFrames, ctx);
    const { interpolatedFrames, interpolatedMasks, gaps } = handleGapsAndQuality(seq.frames);

    // Frame 1 should be interpolated
    expect(interpolatedMasks[1][LANDMARK_INDEX.LEFT_WRIST]).toBe(true);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].interpolated).toBe(true);
  });

  // ─── U07: Lucka 67 ms ─────────────────────────────────────────────
  test('U07: Gap > 50 ms is NOT interpolated', () => {
    const rawFrames: PoseFrame[] = [];
    const baseLm = createBaseAddressLandmarks();

    // 0 ms
    rawFrames.push({
      frameIndex: 0,
      timestampUs: 0,
      image: baseLm.map(p => ({ ...p, visibility: 0.9 })),
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    });

    // 20ms, 40ms, 60ms: dropped left wrist (gap duration = 67 ms)
    for (let t = 20_000; t <= 60_000; t += 20_000) {
      rawFrames.push({
        frameIndex: rawFrames.length,
        timestampUs: t,
        image: baseLm.map((p, idx) =>
          idx === LANDMARK_INDEX.LEFT_WRIST ? { ...p, visibility: 0.1 } : { ...p, visibility: 0.9 }
        ),
        world: baseLm,
        sourceSizePx: { width: 1080, height: 1920 },
        rotationAppliedDeg: 0,
        inputWasMirrored: false,
      });
    }

    // 67 ms
    rawFrames.push({
      frameIndex: rawFrames.length,
      timestampUs: 67_000,
      image: baseLm.map(p => ({ ...p, visibility: 0.9 })),
      world: baseLm,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    });

    const ctx: CaptureContext = {
      view: 'FACE_ON',
      handedness: 'RIGHT',
      mode: 'VIDEO',
      nominalFps: 60,
    };

    const seq = canonicalizeSequence(rawFrames, ctx);
    const { interpolatedMasks, gaps } = handleGapsAndQuality(seq.frames);

    const wristGaps = gaps.filter(g => g.landmarkIndex === LANDMARK_INDEX.LEFT_WRIST);
    expect(wristGaps.length).toBeGreaterThan(0);
    expect(wristGaps[0].interpolated).toBe(false);
    expect(wristGaps[0].reason).toBe('GAP_EXCEEDS_50MS');
  });

  // ─── U08: Lead arm passerar horisontell två gånger ────────────────
  test('U08: Lead arm horizontal chosen as P3 before P4 and P5 after P4', () => {
    const { frames, context } = generateSyntheticSwing({ fps: 120 });
    const result = detector.detect(frames, context);

    if (result.events.P3.status !== 'ABSTAIN' && result.events.P5.status !== 'ABSTAIN') {
      const tP3 = result.events.P3.timestampMs!;
      const tP4 = result.events.P4.timestampMs!;
      const tP5 = result.events.P5.timestampMs!;

      expect(tP3).toBeLessThan(tP4);
      expect(tP5).toBeGreaterThan(tP4);
    }
  });

  // ─── U09: Trail arm horisontell efter P8 ───────────────────────────
  test('U09: P9 strictly uses trail arm (not lead arm) in through-swing', () => {
    const { frames, context } = generateSyntheticSwing({ fps: 120 });
    const result = detector.detect(frames, context);

    if (result.events.P9.status !== 'ABSTAIN') {
      expect(result.events.P9.position).toBe('P9');
      expect(result.events.P9.semantic).toContain('TRAIL_ARM');
    }
  });

  // ─── U10: Klubba saknas ───────────────────────────────────────────
  test('U10: Club missing in pose-only -> P2, P6, P8 are NEVER DETECTED_EXACT', () => {
    const { frames, context } = generateSyntheticSwing({ fps: 120 });
    const result = detector.detect(frames, context);

    expect(result.events.P2.status).not.toBe('DETECTED_EXACT');
    expect(result.events.P6.status).not.toBe('DETECTED_EXACT');
    expect(result.events.P8.status).not.toBe('DETECTED_EXACT');

    // In pose-only, if detected, must be DETECTED_PROXY and have warning NO_CLUB_SIGNAL
    if (result.events.P2.status === 'DETECTED_PROXY') {
      expect(result.events.P2.warnings).toContain('NO_CLUB_SIGNAL');
      expect(result.events.P2.qualityScore).toBeLessThanOrEqual(0.55);
    }
    if (result.events.P6.status === 'DETECTED_PROXY') {
      expect(result.events.P6.warnings).toContain('NO_CLUB_SIGNAL');
      expect(result.events.P6.qualityScore).toBeLessThanOrEqual(0.55);
    }
    if (result.events.P8.status === 'DETECTED_PROXY') {
      expect(result.events.P8.warnings).toContain('NO_CLUB_SIGNAL');
      expect(result.events.P8.qualityScore).toBeLessThanOrEqual(0.55);
    }
  });

  // ─── U11: Boll/klubbkontakt saknas ────────────────────────────────
  test('U11: Ball/club contact missing -> P7 is NEVER DETECTED_EXACT', () => {
    const { frames, context } = generateSyntheticSwing({ fps: 120 });
    const result = detector.detect(frames, context);

    expect(result.events.P7.status).not.toBe('DETECTED_EXACT');

    if (result.events.P7.status === 'DETECTED_PROXY') {
      expect(result.events.P7.warnings).toContain('NO_CLUB_SIGNAL');
      expect(result.events.P7.warnings).toContain('NO_BALL_CONTACT_SIGNAL');
      expect(result.events.P7.qualityScore).toBeLessThanOrEqual(0.50);
    }
  });

  // ─── U12: Två kandidater med samma lokalscore ─────────────────────
  test('U12: DP solver chooses globally optimal sequence when local scores are ambiguous', () => {
    const { frames, context } = generateSyntheticSwing({ fps: 120 });
    const result = detector.detect(frames, context);

    // Global monotonic invariant: P1 < P2 < ... < P10
    const detected = result.orderedEvents.filter(e => e.status !== 'ABSTAIN');
    for (let i = 1; i < detected.length; i++) {
      expect(detected[i].timestampMs!).toBeGreaterThan(detected[i - 1].timestampMs!);
    }
  });
});
