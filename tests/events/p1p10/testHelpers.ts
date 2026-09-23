/**
 * testHelpers.ts
 * SwingSwang – MediaPipe P1–P10 Normative Test Generator
 *
 * Synthetic PoseFrame generator for unit tests U01-U12 and synthetic swing series.
 */

import {
  PoseFrame,
  Landmark,
  LANDMARK_INDEX,
  CaptureContext,
} from '@/features/events/p1p10/types';

export function createEmpty33Landmarks(): Landmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0.0,
    visibility: 0.95,
    presence: 0.95,
  }));
}

export function createBaseAddressLandmarks(): Landmark[] {
  const lm = createEmpty33Landmarks();

  // Torso & head
  lm[LANDMARK_INDEX.NOSE] = { x: 0.50, y: 0.20, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.LEFT_SHOULDER] = { x: 0.44, y: 0.35, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_SHOULDER] = { x: 0.56, y: 0.35, z: 0, visibility: 0.95, presence: 0.95 };

  // Arms hanging down at address
  lm[LANDMARK_INDEX.LEFT_ELBOW] = { x: 0.46, y: 0.50, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_ELBOW] = { x: 0.54, y: 0.50, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.LEFT_WRIST] = { x: 0.49, y: 0.65, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_WRIST] = { x: 0.51, y: 0.65, z: 0, visibility: 0.95, presence: 0.95 };

  // Hips
  lm[LANDMARK_INDEX.LEFT_HIP] = { x: 0.46, y: 0.65, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_HIP] = { x: 0.54, y: 0.65, z: 0, visibility: 0.95, presence: 0.95 };

  // Legs & feet
  lm[LANDMARK_INDEX.LEFT_KNEE] = { x: 0.46, y: 0.80, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_KNEE] = { x: 0.54, y: 0.80, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.LEFT_ANKLE] = { x: 0.46, y: 0.95, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_ANKLE] = { x: 0.54, y: 0.95, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.LEFT_FOOT_INDEX] = { x: 0.46, y: 0.98, z: 0, visibility: 0.95, presence: 0.95 };
  lm[LANDMARK_INDEX.RIGHT_FOOT_INDEX] = { x: 0.54, y: 0.98, z: 0, visibility: 0.95, presence: 0.95 };

  return lm;
}

export interface SyntheticSwingOptions {
  fps?: number;
  addressDurationMs?: number;
  backswingDurationMs?: number;
  pauseAtTopMs?: number;
  downswingDurationMs?: number;
  followThroughDurationMs?: number;
  finishDurationMs?: number;
  waggle?: {
    displacementS: number;
    durationMs: number;
    returnsToAddress: boolean;
  };
  injectIdentitySwap?: {
    around: 'P5';
    durationMs: number;
  };
  jitterTimestamps?: boolean;
}

/**
 * Builds a realistic synthetic golf swing sequence of PoseFrames.
 */
export function generateSyntheticSwing(options: SyntheticSwingOptions = {}): {
  frames: PoseFrame[];
  keyTimes: {
    addressEndMs: number;
    takeawayMs: number;
    topMs: number;
    downswingStartMs: number;
    impactMs: number;
    finishStartMs: number;
  };
  context: CaptureContext;
} {
  const fps = options.fps ?? 120;
  const frameIntervalMs = 1000 / fps;

  const addrDur = options.addressDurationMs ?? 400;
  const backDur = options.backswingDurationMs ?? 800;
  const pauseDur = options.pauseAtTopMs ?? 0;
  const downDur = options.downswingDurationMs ?? 250;
  const throughDur = options.followThroughDurationMs ?? 400;
  const finishDur = options.finishDurationMs ?? 500;

  const frames: PoseFrame[] = [];
  let currentMs = 0;
  let frameIdx = 0;

  function addFrame(lmModifier?: (lms: Landmark[], tMs: number) => void) {
    const lms = createBaseAddressLandmarks();
    if (lmModifier) {
      lmModifier(lms, currentMs);
    }
    const world = lms.map(p => ({
      x: (p.x - 0.5) * 1.8,
      y: (p.y - 0.5) * 1.8,
      z: (p.z ?? 0) * 1.8,
      visibility: p.visibility,
      presence: p.presence,
    }));

    frames.push({
      frameIndex: frameIdx++,
      timestampUs: Math.round(currentMs * 1000),
      image: lms,
      world,
      sourceSizePx: { width: 1080, height: 1920 },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    });

    const stepMs = options.jitterTimestamps
      ? frameIntervalMs * (0.95 + Math.random() * 0.10)
      : frameIntervalMs;
    currentMs += stepMs;
  }

  // 1. Address Phase (with optional Waggle)
  const addrFrames = Math.round(addrDur / frameIntervalMs);
  let takeawayMs = addrDur;

  if (options.waggle) {
    const waggleFrames = Math.round(options.waggle.durationMs / frameIntervalMs);
    const waggleDisp = options.waggle.displacementS * 0.30; // 0.30 is approx S2D

    for (let i = 0; i < addrFrames; i++) {
      addFrame();
    }
    const waggleStartMs = currentMs;
    for (let i = 0; i < waggleFrames; i++) {
      const progress = Math.sin((i / waggleFrames) * Math.PI);
      addFrame((lms) => {
        lms[LANDMARK_INDEX.LEFT_WRIST].x += waggleDisp * progress;
        lms[LANDMARK_INDEX.RIGHT_WRIST].x += waggleDisp * progress;
      });
    }
    // Post-waggle stable address
    for (let i = 0; i < addrFrames; i++) {
      addFrame();
    }
    takeawayMs = currentMs;
  } else {
    for (let i = 0; i < addrFrames; i++) {
      addFrame();
    }
    takeawayMs = currentMs;
  }

  const addressEndMs = takeawayMs;

  // 2. Backswing Phase (Address -> Top)
  const backFrames = Math.round(backDur / frameIntervalMs);
  for (let i = 0; i < backFrames; i++) {
    const p = i / backFrames;
    addFrame((lms) => {
      // Hands move up and back (to right for right-handed player)
      const dx = 0.25 * Math.sin(p * Math.PI * 0.5);
      const dy = -0.40 * Math.sin(p * Math.PI * 0.5); // Upwards in image coordinates (smaller y)

      lms[LANDMARK_INDEX.LEFT_WRIST].x += dx;
      lms[LANDMARK_INDEX.LEFT_WRIST].y += dy;
      lms[LANDMARK_INDEX.RIGHT_WRIST].x += dx;
      lms[LANDMARK_INDEX.RIGHT_WRIST].y += dy;

      lms[LANDMARK_INDEX.LEFT_ELBOW].x += dx * 0.7;
      lms[LANDMARK_INDEX.LEFT_ELBOW].y += dy * 0.7;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].x += dx * 0.7;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].y += dy * 0.7;
    });
  }

  // 3. Pause at the top
  const topMs = currentMs;
  if (pauseDur > 0) {
    const pauseFrames = Math.round(pauseDur / frameIntervalMs);
    for (let i = 0; i < pauseFrames; i++) {
      addFrame((lms) => {
        // Hands hold top position
        lms[LANDMARK_INDEX.LEFT_WRIST].x += 0.25;
        lms[LANDMARK_INDEX.LEFT_WRIST].y -= 0.40;
        lms[LANDMARK_INDEX.RIGHT_WRIST].x += 0.25;
        lms[LANDMARK_INDEX.RIGHT_WRIST].y -= 0.40;
        lms[LANDMARK_INDEX.LEFT_ELBOW].x += 0.175;
        lms[LANDMARK_INDEX.LEFT_ELBOW].y -= 0.28;
        lms[LANDMARK_INDEX.RIGHT_ELBOW].x += 0.175;
        lms[LANDMARK_INDEX.RIGHT_ELBOW].y -= 0.28;
      });
    }
  }
  const downswingStartMs = currentMs;

  // 4. Downswing Phase (Top -> Impact)
  const downFrames = Math.round(downDur / frameIntervalMs);
  for (let i = 0; i < downFrames; i++) {
    const p = i / downFrames;
    addFrame((lms) => {
      // Hands move down and forward
      const dx = 0.25 * (1 - p);
      const dy = -0.40 * (1 - p);

      lms[LANDMARK_INDEX.LEFT_WRIST].x += dx;
      lms[LANDMARK_INDEX.LEFT_WRIST].y += dy;
      lms[LANDMARK_INDEX.RIGHT_WRIST].x += dx;
      lms[LANDMARK_INDEX.RIGHT_WRIST].y += dy;

      lms[LANDMARK_INDEX.LEFT_ELBOW].x += dx * 0.7;
      lms[LANDMARK_INDEX.LEFT_ELBOW].y += dy * 0.7;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].x += dx * 0.7;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].y += dy * 0.7;

      // Optional wrist identity swap around P5 (middle of downswing)
      if (options.injectIdentitySwap && Math.abs(p - 0.5) < 0.2) {
        const temp = { ...lms[LANDMARK_INDEX.LEFT_WRIST] };
        lms[LANDMARK_INDEX.LEFT_WRIST] = { ...lms[LANDMARK_INDEX.RIGHT_WRIST] };
        lms[LANDMARK_INDEX.RIGHT_WRIST] = temp;
      }
    });
  }
  const impactMs = currentMs;

  // 5. Follow Through (Impact -> P9)
  const throughFrames = Math.round(throughDur / frameIntervalMs);
  for (let i = 0; i < throughFrames; i++) {
    const p = i / throughFrames;
    addFrame((lms) => {
      // Hands move up to the target side (left in image)
      const dx = -0.30 * Math.sin(p * Math.PI * 0.5);
      const dy = -0.45 * Math.sin(p * Math.PI * 0.5);

      lms[LANDMARK_INDEX.LEFT_WRIST].x += dx;
      lms[LANDMARK_INDEX.LEFT_WRIST].y += dy;
      lms[LANDMARK_INDEX.RIGHT_WRIST].x += dx;
      lms[LANDMARK_INDEX.RIGHT_WRIST].y += dy;

      lms[LANDMARK_INDEX.LEFT_ELBOW].x += dx * 0.7;
      lms[LANDMARK_INDEX.LEFT_ELBOW].y += dy * 0.7;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].x += dx * 0.7;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].y += dy * 0.7;
    });
  }

  // 6. Finish (P10 plateau)
  const finishStartMs = currentMs;
  const finishFrames = Math.round(finishDur / frameIntervalMs);
  for (let i = 0; i < finishFrames; i++) {
    addFrame((lms) => {
      // Steady hold at finish
      lms[LANDMARK_INDEX.LEFT_WRIST].x -= 0.30;
      lms[LANDMARK_INDEX.LEFT_WRIST].y -= 0.45;
      lms[LANDMARK_INDEX.RIGHT_WRIST].x -= 0.30;
      lms[LANDMARK_INDEX.RIGHT_WRIST].y -= 0.45;
      lms[LANDMARK_INDEX.LEFT_ELBOW].x -= 0.21;
      lms[LANDMARK_INDEX.LEFT_ELBOW].y -= 0.315;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].x -= 0.21;
      lms[LANDMARK_INDEX.RIGHT_ELBOW].y -= 0.315;
    });
  }

  return {
    frames,
    keyTimes: {
      addressEndMs,
      takeawayMs,
      topMs,
      downswingStartMs,
      impactMs,
      finishStartMs,
    },
    context: {
      view: 'FACE_ON',
      handedness: 'RIGHT',
      mode: 'VIDEO',
      nominalFps: fps,
    },
  };
}
