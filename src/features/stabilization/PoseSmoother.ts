/**
 * PoseSmoother.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Velocity-adaptive exponential moving average (EMA) smoother.
 *
 * For each landmark independently across time:
 *   alpha = max(minAlpha, baseFactor * exp(-velocityScale * velocity))
 *
 * - High velocity → alpha → minAlpha (less smoothing, preserve fast motion)
 * - Low velocity  → alpha → baseFactor (more smoothing, reduce jitter)
 * - smoothed = alpha * current + (1 - alpha) * previousSmoothed
 *
 * This module has NO knowledge of swing phases — it operates purely on
 * observed frame-to-frame velocity.
 */

import { LandmarkID, LANDMARK_COUNT, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';

/**
 * Apply velocity-adaptive EMA smoothing to landmarks across a timeline.
 *
 * @param frames        Immutable input frames.
 * @param baseFactor    Base alpha (used at zero velocity, maximum smoothing).
 * @param velocityScale Controls how quickly alpha drops with velocity.
 * @param minFactor     Floor for alpha (fastest motion still gets this much smoothing).
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

  // Track the previous smoothed position for each landmark.
  const prevSmoothed = new Map<LandmarkID, PoseLandmark>();

  return frames.map((frame, frameIdx) => {
    const newLandmarks = new Map<LandmarkID, PoseLandmark>();
    let changed = false;

    for (const [id, landmark] of frame.landmarks) {
      const prev = prevSmoothed.get(id);

      if (!prev || frameIdx === 0) {
        // First occurrence — use raw position as initial state.
        newLandmarks.set(id, landmark);
        prevSmoothed.set(id, landmark);
        continue;
      }

      // Compute frame-to-frame velocity (normalized Euclidean distance).
      const velocity = normalizedDistance(prev, landmark);

      // Adaptive alpha: high velocity → small alpha, low velocity → large alpha.
      const alpha = Math.max(minFactor, baseFactor * Math.exp(-velocityScale * velocity));

      // EMA: smoothed = alpha * current + (1 - alpha) * previousSmoothed
      const smoothed: PoseLandmark = {
        id: landmark.id,
        x: alpha * landmark.x + (1 - alpha) * prev.x,
        y: alpha * landmark.y + (1 - alpha) * prev.y,
        z: smoothOptional(landmark.z, prev.z, alpha),
        visibility: landmark.visibility,
        confidence: landmark.confidence,
      };

      newLandmarks.set(id, smoothed);
      prevSmoothed.set(id, smoothed);
      changed = true;
    }

    // Remove entries from prevSmoothed for landmarks that disappeared.
    for (const id of prevSmoothed.keys()) {
      if (!frame.landmarks.has(id)) {
        prevSmoothed.delete(id);
      }
    }

    if (!changed) return frame;

    return {
      ...frame,
      landmarks: newLandmarks as ReadonlyMap<LandmarkID, PoseLandmark>,
      averageConfidence: computeAverageConfidence(newLandmarks),
    };
  });
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
