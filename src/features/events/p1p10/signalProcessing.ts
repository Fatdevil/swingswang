/**
 * signalProcessing.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Preprocessing, quality masking, gap interpolation (<= 50 ms),
 * Hampel outlier filtering, centered Savitzky–Golay smoothing (order 2),
 * and analytical PTS-based derivatives.
 */

import { Vec3, Landmark, PoseFrame, CaptureContext } from './types';
import { CanonicalFrame, canonicalizeFrame } from './canonicalize';

export interface ProcessedSequence {
  readonly frames: readonly ProcessedFrame[];
  readonly gaps: readonly DetectedGap[];
  readonly s2D: number;
  readonly context: CaptureContext;
}

export interface ProcessedFrame extends CanonicalFrame {
  readonly smoothedGrip2D: Vec3;
  readonly gripVelocity: Vec3;       // Normalized by S2D, in torso-lengths/s
  readonly gripSpeed: number;        // Norm of gripVelocity in S/s
  readonly gripAcceleration: Vec3;   // Normalized by S2D, in S/s^2
  readonly gripAccel: number;        // Norm of gripAcceleration in S/s^2
  readonly leadArmVelocity: Vec3;
  readonly trailArmVelocity: Vec3;
  readonly midHipVelocity: Vec3;
  readonly midHipSpeed: number;
  readonly interpolatedMask: boolean[]; // per-landmark interpolation flag (length 33)
}

export interface DetectedGap {
  readonly landmarkIndex: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly interpolated: boolean;
  readonly reason: string;
}

/**
 * Validates and sorts raw frames on timestampUs.
 * Rejects duplicate or backwards timestamps.
 */
export function validateAndSortFrames(rawFrames: readonly PoseFrame[]): PoseFrame[] {
  if (rawFrames.length === 0) return [];
  const sorted = [...rawFrames].sort((a, b) => a.timestampUs - b.timestampUs);
  const clean: PoseFrame[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    if (clean.length > 0) {
      const prev = clean[clean.length - 1];
      // Reject non-monotonically increasing timestamps:
      if (curr.timestampUs <= prev.timestampUs) {
        continue;
      }
    }
    clean.push(curr);
  }
  return clean;
}

/**
 * Handles landmark quality thresholding and gap interpolation:
 * - q < 0.50: mark invalid
 * - internal gap <= 50 ms with endpoints q >= 0.75: linearly interpolate
 * - internal gap > 50 ms: do not interpolate, record gap
 */
export function handleGapsAndQuality(
  frames: readonly CanonicalFrame[],
): {
  interpolatedFrames: CanonicalFrame[];
  interpolatedMasks: boolean[][];
  gaps: DetectedGap[];
} {
  const n = frames.length;
  const masks: boolean[][] = Array.from({ length: n }, () => new Array(33).fill(false));
  const gaps: DetectedGap[] = [];

  // Deep clone image landmarks so we can interpolate
  const clonedFrames: CanonicalFrame[] = frames.map(f => ({
    ...f,
    image: f.image.map(pt => ({ ...pt })),
    quality: [...f.quality],
  }));

  for (let lm = 0; lm < 33; lm++) {
    let inGap = false;
    let gapStartIdx = -1;

    for (let i = 0; i < n; i++) {
      const q = clonedFrames[i].quality[lm];
      const isInvalid = q < 0.50;

      if (isInvalid) {
        if (!inGap) {
          inGap = true;
          gapStartIdx = i;
        }
      } else {
        if (inGap) {
          // Gap ended at index i - 1, bounded by gapStartIdx - 1 and i
          const beforeIdx = gapStartIdx - 1;
          const afterIdx = i;

          if (beforeIdx >= 0 && afterIdx < n) {
            const tStartMs = clonedFrames[beforeIdx].timestampMs;
            const tEndMs = clonedFrames[afterIdx].timestampMs;
            const durationMs = tEndMs - tStartMs;
            const qBefore = clonedFrames[beforeIdx].quality[lm];
            const qAfter = clonedFrames[afterIdx].quality[lm];

            if (durationMs <= 50.0 && qBefore >= 0.75 && qAfter >= 0.75) {
              // Interpolate gap linearly
              const pBefore = clonedFrames[beforeIdx].image[lm];
              const pAfter = clonedFrames[afterIdx].image[lm];

              for (let k = gapStartIdx; k < afterIdx; k++) {
                const alpha = (clonedFrames[k].timestampMs - tStartMs) / (tEndMs - tStartMs);
                (clonedFrames[k].image as Vec3[])[lm] = {
                  x: pBefore.x + (pAfter.x - pBefore.x) * alpha,
                  y: pBefore.y + (pAfter.y - pBefore.y) * alpha,
                  z: (pBefore.z ?? 0) + ((pAfter.z ?? 0) - (pBefore.z ?? 0)) * alpha,
                };
                masks[k][lm] = true;
              }
              gaps.push({
                landmarkIndex: lm,
                startMs: tStartMs,
                endMs: tEndMs,
                durationMs,
                interpolated: true,
                reason: 'INTERPOLATED_SHORT_GAP',
              });
            } else {
              gaps.push({
                landmarkIndex: lm,
                startMs: tStartMs,
                endMs: tEndMs,
                durationMs,
                interpolated: false,
                reason: durationMs > 50.0 ? 'GAP_EXCEEDS_50MS' : 'LOW_ENDPOINT_QUALITY',
              });
            }
          }
          inGap = false;
          gapStartIdx = -1;
        }
      }
    }

    if (inGap) {
      // Gap runs to the end of the clip (no extrapolation allowed)
      const beforeIdx = gapStartIdx - 1;
      const tStartMs = beforeIdx >= 0 ? clonedFrames[beforeIdx].timestampMs : clonedFrames[0].timestampMs;
      const tEndMs = clonedFrames[n - 1].timestampMs;
      gaps.push({
        landmarkIndex: lm,
        startMs: tStartMs,
        endMs: tEndMs,
        durationMs: tEndMs - tStartMs,
        interpolated: false,
        reason: 'CLIP_EDGE_GAP',
      });
    }
  }

  return {
    interpolatedFrames: clonedFrames,
    interpolatedMasks: masks,
    gaps,
  };
}

/**
 * Fits a local 2nd order polynomial y(tau) = a0 + a1 * tau + a2 * tau^2
 * using least squares around center index i over a symmetric window of 2m + 1 points.
 * Returns:
 *   a0 = smoothed value at tau = 0
 *   a1 = 1st derivative at tau = 0 (per second)
 *   a2 = 2nd derivative at tau = 0 (per second^2, where d^2y/dt^2 = 2 * a2)
 */
export function fitLocalQuadratic(
  timestampsSec: readonly number[],
  values: readonly number[],
  centerIdx: number,
  halfWindow: number,
): { val: number; deriv1: number; deriv2: number } {
  const n = timestampsSec.length;
  const t0 = timestampsSec[centerIdx];
  const start = Math.max(0, centerIdx - halfWindow);
  const end = Math.min(n - 1, centerIdx + halfWindow);

  let s0 = 0; // sum tau^0
  let s1 = 0; // sum tau^1
  let s2 = 0; // sum tau^2
  let s3 = 0; // sum tau^3
  let s4 = 0; // sum tau^4

  let b0 = 0; // sum y
  let b1 = 0; // sum y * tau
  let b2 = 0; // sum y * tau^2

  for (let k = start; k <= end; k++) {
    const tau = timestampsSec[k] - t0;
    const tau2 = tau * tau;
    const y = values[k];

    s0 += 1;
    s1 += tau;
    s2 += tau2;
    s3 += tau2 * tau;
    s4 += tau2 * tau2;

    b0 += y;
    b1 += y * tau;
    b2 += y * tau2;
  }

  // Solve 3x3 normal equations: [S] * [a] = [b]
  // Using Cramer's rule:
  const detS =
    s0 * (s2 * s4 - s3 * s3) -
    s1 * (s1 * s4 - s3 * s2) +
    s2 * (s1 * s3 - s2 * s2);

  if (Math.abs(detS) < 1e-12) {
    return {
      val: values[centerIdx],
      deriv1: 0,
      deriv2: 0,
    };
  }

  const detA0 =
    b0 * (s2 * s4 - s3 * s3) -
    s1 * (b1 * s4 - s3 * b2) +
    s2 * (b1 * s3 - s2 * b2);

  const detA1 =
    s0 * (b1 * s4 - s3 * b2) -
    b0 * (s1 * s4 - s3 * s2) +
    s2 * (s1 * b2 - b1 * s2);

  const detA2 =
    s0 * (s2 * b2 - b1 * s3) -
    s1 * (s1 * b2 - b1 * s2) +
    b0 * (s1 * s3 - s2 * s2);

  const a0 = detA0 / detS;
  const a1 = detA1 / detS;
  const a2 = detA2 / detS;

  return {
    val: a0,
    deriv1: a1,
    deriv2: 2.0 * a2,
  };
}

/**
 * Runs Savitzky–Golay smoothing (order 2) and derivative extraction on a time-series of Vec3 points.
 */
export function smoothAndDeriveVec3(
  timestampsSec: readonly number[],
  points: readonly Vec3[],
  halfWindow: number,
): {
  smoothed: Vec3[];
  velocity: Vec3[];
  acceleration: Vec3[];
} {
  const n = points.length;
  const smoothed: Vec3[] = new Array(n);
  const velocity: Vec3[] = new Array(n);
  const acceleration: Vec3[] = new Array(n);

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => p.z ?? 0);

  for (let i = 0; i < n; i++) {
    const fitX = fitLocalQuadratic(timestampsSec, xs, i, halfWindow);
    const fitY = fitLocalQuadratic(timestampsSec, ys, i, halfWindow);
    const fitZ = fitLocalQuadratic(timestampsSec, zs, i, halfWindow);

    smoothed[i] = { x: fitX.val, y: fitY.val, z: fitZ.val };
    velocity[i] = { x: fitX.deriv1, y: fitY.deriv1, z: fitZ.deriv1 };
    acceleration[i] = { x: fitX.deriv2, y: fitY.deriv2, z: fitZ.deriv2 };
  }

  return { smoothed, velocity, acceleration };
}

/**
 * Full preprocessing pipeline according to Section 5.1:
 * - Sort and deduplicate timestamps
 * - Canonicalize raw frames
 * - Handle quality thresholding (q < 0.50) and internal gap interpolation (<= 50 ms)
 * - Savitzky–Golay smoothing (9 samples @ 120 fps, 5 samples @ 60 fps)
 * - Derive normalized velocities and accelerations using real PTS and S2D
 */
export function processSignals(
  rawFrames: readonly PoseFrame[],
  context: CaptureContext,
  s2DScale?: number,
): ProcessedSequence {
  const validRaw = validateAndSortFrames(rawFrames);
  const canonicalFrames = validRaw.map(f => canonicalizeFrame(f, context));

  // Determine S2D from address frames if not supplied:
  const s2D = s2DScale && s2DScale > 0 ? s2DScale : estimateInitialS2D(canonicalFrames);

  // Quality masks & gap handling:
  const { interpolatedFrames, interpolatedMasks, gaps } = handleGapsAndQuality(canonicalFrames);

  const n = interpolatedFrames.length;
  if (n === 0) {
    return { frames: [], gaps: [], s2D, context };
  }

  const timestampsSec = interpolatedFrames.map(f => f.timestampUs / 1_000_000);

  // Choose half window based on nominal FPS:
  // 120 fps -> 9 samples total (halfWindow = 4)
  // 60 fps  -> 5 samples total (halfWindow = 2)
  const halfWindow = context.nominalFps >= 100 ? 4 : 2;

  // Extract key point series:
  const gripPoints = interpolatedFrames.map(f => f.grip2D);
  const hipPoints = interpolatedFrames.map(f => f.midHip);
  const leadArmPoints = interpolatedFrames.map(f => f.leadArm);
  const trailArmPoints = interpolatedFrames.map(f => f.trailArm);

  const gripFit = smoothAndDeriveVec3(timestampsSec, gripPoints, halfWindow);
  const hipFit = smoothAndDeriveVec3(timestampsSec, hipPoints, halfWindow);
  const leadArmFit = smoothAndDeriveVec3(timestampsSec, leadArmPoints, halfWindow);
  const trailArmFit = smoothAndDeriveVec3(timestampsSec, trailArmPoints, halfWindow);

  const processedFrames: ProcessedFrame[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const base = interpolatedFrames[i];

    // Normalize velocities and accelerations by torso length s2D:
    const gripVelNorm: Vec3 = {
      x: gripFit.velocity[i].x / s2D,
      y: gripFit.velocity[i].y / s2D,
      z: gripFit.velocity[i].z / s2D,
    };
    const gripSpeed = Math.hypot(gripVelNorm.x, gripVelNorm.y);

    const gripAccNorm: Vec3 = {
      x: gripFit.acceleration[i].x / s2D,
      y: gripFit.acceleration[i].y / s2D,
      z: gripFit.acceleration[i].z / s2D,
    };
    const gripAccel = Math.hypot(gripAccNorm.x, gripAccNorm.y);

    const hipVelNorm: Vec3 = {
      x: hipFit.velocity[i].x / s2D,
      y: hipFit.velocity[i].y / s2D,
      z: hipFit.velocity[i].z / s2D,
    };
    const midHipSpeed = Math.hypot(hipVelNorm.x, hipVelNorm.y);

    processedFrames[i] = {
      ...base,
      smoothedGrip2D: gripFit.smoothed[i],
      gripVelocity: gripVelNorm,
      gripSpeed,
      gripAcceleration: gripAccNorm,
      gripAccel,
      leadArmVelocity: leadArmFit.velocity[i],
      trailArmVelocity: trailArmFit.velocity[i],
      midHipVelocity: hipVelNorm,
      midHipSpeed,
      interpolatedMask: interpolatedMasks[i],
    };
  }

  return {
    frames: processedFrames,
    gaps,
    s2D,
    context,
  };
}

function estimateInitialS2D(frames: readonly CanonicalFrame[]): number {
  if (frames.length === 0) return 0.25;
  const heights: number[] = [];
  const limit = Math.min(frames.length, 30);
  for (let i = 0; i < limit; i++) {
    const f = frames[i];
    const dx = f.midShoulder.x - f.midHip.x;
    const dy = f.midShoulder.y - f.midHip.y;
    heights.push(Math.hypot(dx, dy));
  }
  heights.sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  const val = heights[mid] ?? 0.25;
  return Math.max(0.05, val);
}
