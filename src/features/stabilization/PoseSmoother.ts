/**
 * PoseSmoother.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Zero-phase, velocity-adaptive exponential smoother.
 *
 * For each landmark independently across time:
 *   velocity_i = max(|raw_i - raw_{i-1}|, |raw_{i+1} - raw_i|)   (raw, not smoothed)
 *   alpha_i    = 1.0 - (1.0 - minFactor) * exp(-velocityScale * velocity_i)
 *
 * - High velocity → alpha → 1.0 (no smoothing, preserve fast motion)
 * - Low velocity  → alpha → minFactor (heavy smoothing, reduce jitter)
 *
 * The EMA runs once forward and once backward over the whole clip and the two
 * passes are averaged. A forward-only EMA lags behind fast motion (the wrist
 * was drawn ~15 % of the frame height behind the real hands in the downswing);
 * the backward pass leads by the same amount, so the average has no net lag.
 * Offline analysis has the whole clip available, so this costs no latency.
 *
 * This module has NO knowledge of swing phases — it operates purely on
 * observed frame-to-frame velocity.
 */

import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';

/**
 * Apply zero-phase velocity-adaptive smoothing to landmarks across a timeline.
 *
 * A landmark missing in a frame splits its track: each contiguous run of
 * frames where it is present is smoothed independently.
 *
 * @param frames        Immutable input frames.
 * @param baseFactor    Kept for API compatibility (alpha is driven by velocity).
 * @param velocityScale Controls how quickly alpha rises with velocity.
 * @param minFactor     Alpha at zero velocity (maximum smoothing).
 * @returns New frame array with smoothed landmark positions.
 */
export function smoothLandmarks(
  frames: readonly PoseFrame[],
  baseFactor: number,
  velocityScale: number,
  minFactor: number,
): PoseFrame[] {
  if (frames.length <= 1) {
    return [...frames];
  }

  const ids = new Set<LandmarkID>();
  for (const frame of frames) {
    for (const id of frame.landmarks.keys()) ids.add(id);
  }

  // smoothedByFrame[i] holds smoothed landmarks for frame i.
  const smoothedByFrame: Map<LandmarkID, PoseLandmark>[] = frames.map(() => new Map());

  for (const id of ids) {
    let runStart = -1;
    for (let i = 0; i <= frames.length; i++) {
      const present = i < frames.length && frames[i].landmarks.has(id);
      if (present && runStart < 0) runStart = i;
      if (!present && runStart >= 0) {
        smoothRun(frames, id, runStart, i - 1, velocityScale, minFactor, smoothedByFrame);
        runStart = -1;
      }
    }
  }

  return frames.map((frame, i) => {
    const newLandmarks = smoothedByFrame[i];
    if (newLandmarks.size === 0) return frame;
    return {
      ...frame,
      landmarks: newLandmarks as ReadonlyMap<LandmarkID, PoseLandmark>,
      averageConfidence: computeAverageConfidence(newLandmarks),
    };
  });
}

/** Smooth one contiguous run [start, end] of a landmark with a forward + backward EMA. */
function smoothRun(
  frames: readonly PoseFrame[],
  id: LandmarkID,
  start: number,
  end: number,
  velocityScale: number,
  minFactor: number,
  out: Map<LandmarkID, PoseLandmark>[],
): void {
  const raw: PoseLandmark[] = [];
  for (let i = start; i <= end; i++) raw.push(frames[i].landmarks.get(id)!);
  const n = raw.length;

  if (n === 1) {
    out[start].set(id, raw[0]);
    return;
  }

  const alphas = raw.map((lm, k) => {
    const vIn = k > 0 ? normalizedDistance(raw[k - 1], lm) : 0;
    const vOut = k < n - 1 ? normalizedDistance(lm, raw[k + 1]) : 0;
    const velocity = Math.max(vIn, vOut);
    return 1.0 - (1.0 - minFactor) * Math.exp(-velocityScale * velocity);
  });

  const fwd = emaPass(raw, alphas, 0, n, 1);
  const bwd = emaPass(raw, alphas, n - 1, -1, -1);

  for (let k = 0; k < n; k++) {
    const lm = raw[k];
    out[start + k].set(id, {
      id: lm.id,
      x: (fwd[k].x + bwd[k].x) * 0.5,
      y: (fwd[k].y + bwd[k].y) * 0.5,
      z: fwd[k].z === undefined || bwd[k].z === undefined ? lm.z : (fwd[k].z! + bwd[k].z!) * 0.5,
      visibility: lm.visibility,
      confidence: lm.confidence,
    });
  }
}

/** One directional EMA pass. Returns smoothed values indexed like `raw`. */
function emaPass(
  raw: readonly PoseLandmark[],
  alphas: readonly number[],
  from: number,
  to: number,
  step: 1 | -1,
): { x: number; y: number; z: number | undefined }[] {
  const result: { x: number; y: number; z: number | undefined }[] = new Array(raw.length);
  let prev = { x: raw[from].x, y: raw[from].y, z: raw[from].z };
  result[from] = prev;
  for (let k = from + step; k !== to; k += step) {
    const a = alphas[k];
    const lm = raw[k];
    prev = {
      x: a * lm.x + (1 - a) * prev.x,
      y: a * lm.y + (1 - a) * prev.y,
      z: smoothOptional(lm.z, prev.z, a),
    };
    result[k] = prev;
  }
  return result;
}

// ── Internal helpers ───────────────────────────────────────────────────

/** Euclidean distance in normalized coordinate space. */
function normalizedDistance(a: PoseLandmark, b: PoseLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Smooth an optional numeric value; returns undefined if either is missing. */
function smoothOptional(
  curr: number | undefined,
  prev: number | undefined,
  alpha: number,
): number | undefined {
  if (curr === undefined || prev === undefined) return curr;
  return alpha * curr + (1 - alpha) * prev;
}

/** Compute average confidence across a landmarks map. Returns 0 if empty. */
function computeAverageConfidence(
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): number {
  if (landmarks.size === 0) return 0;
  let sum = 0;
  for (const lm of landmarks.values()) {
    sum += lm.confidence;
  }
  return sum / landmarks.size;
}
