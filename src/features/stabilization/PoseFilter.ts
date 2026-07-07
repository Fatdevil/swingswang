/**
 * PoseFilter.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Confidence-based filtering: removes individual landmarks whose detection
 * confidence falls below a configurable threshold. Entire frames are never
 * deleted — only individual landmarks within a frame may be removed.
 */

import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';

export interface FilterResult {
  readonly frames: PoseFrame[];
  readonly filteredCount: number;
}

/**
 * Filter out landmarks whose confidence is below `minConfidence`.
 *
 * @param frames      Immutable input frames.
 * @param minConfidence  Minimum confidence to keep a landmark.
 * @returns New frame array with low-confidence landmarks removed, plus count.
 */
export function filterByConfidence(
  frames: readonly PoseFrame[],
  minConfidence: number,
): FilterResult {
  let filteredCount = 0;

  const outputFrames: PoseFrame[] = frames.map((frame) => {
    const newLandmarks = new Map<LandmarkID, PoseLandmark>();
    let removed = 0;

    for (const [id, landmark] of frame.landmarks) {
      if (landmark.confidence >= minConfidence) {
        newLandmarks.set(id, landmark);
      } else {
        removed++;
      }
    }

    filteredCount += removed;

    if (removed === 0) {
      // No changes — return original frame to avoid unnecessary allocations.
      return frame;
    }

    return {
      ...frame,
      landmarks: newLandmarks as ReadonlyMap<LandmarkID, PoseLandmark>,
      detectedCount: newLandmarks.size,
      missingCount: 17 - newLandmarks.size,
      averageConfidence: computeAverageConfidence(newLandmarks),
    };
  });

  return { frames: outputFrames, filteredCount };
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
