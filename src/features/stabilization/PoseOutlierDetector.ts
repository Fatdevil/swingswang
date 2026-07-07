/**
 * PoseOutlierDetector.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Velocity-based outlier detection: flags single-frame positional spikes.
 * A landmark is an outlier when it jumps beyond `velocityThreshold` and
 * returns to within `velocityThreshold` of its pre-jump position in the
 * very next frame. This is purely data-cleaning — no golf semantics.
 */

import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';

export interface OutlierResult {
  readonly frames: PoseFrame[];
  readonly outliersDetected: number;
}

/**
 * Detect and remove single-frame spike outliers.
 *
 * @param frames            Immutable input frames.
 * @param velocityThreshold Normalized distance/frame above which a snap-back
 *                          pattern is classified as an outlier.
 * @returns New frame array with outlier landmarks removed, plus count.
 */
export function detectOutliers(
  frames: readonly PoseFrame[],
  velocityThreshold: number,
): OutlierResult {
  if (frames.length < 3) {
    // Need at least 3 frames to detect a jump-and-return pattern.
    return { frames: [...frames], outliersDetected: 0 };
  }

  // Identify all (frameIndex, landmarkId) pairs that are outliers.
  const outlierSet = new Set<string>();
  let outliersDetected = 0;

  for (let i = 1; i < frames.length - 1; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const next = frames[i + 1];

    for (const [id, currLm] of curr.landmarks) {
      const prevLm = prev.landmarks.get(id);
      const nextLm = next.landmarks.get(id);

      if (!prevLm || !nextLm) continue;

      const velIn = normalizedDistance(prevLm, currLm);
      const velOut = normalizedDistance(currLm, nextLm);
      const returnDist = normalizedDistance(prevLm, nextLm);

      // Pattern: big jump IN, big jump OUT, and next frame is close to prev.
      if (
        velIn > velocityThreshold &&
        velOut > velocityThreshold &&
        returnDist <= velocityThreshold
      ) {
        outlierSet.add(`${i}:${id}`);
        outliersDetected++;
      }
    }
  }

  if (outliersDetected === 0) {
    return { frames: [...frames], outliersDetected: 0 };
  }

  // Build output frames with outlier landmarks removed.
  const outputFrames: PoseFrame[] = frames.map((frame, fi) => {
    const removedIds: LandmarkID[] = [];
    for (const [id] of frame.landmarks) {
      if (outlierSet.has(`${fi}:${id}`)) {
        removedIds.push(id);
      }
    }

    if (removedIds.length === 0) return frame;

    const newLandmarks = new Map<LandmarkID, PoseLandmark>();
    for (const [id, lm] of frame.landmarks) {
      if (!outlierSet.has(`${fi}:${id}`)) {
        newLandmarks.set(id, lm);
      }
    }

    return {
      ...frame,
      landmarks: newLandmarks as ReadonlyMap<LandmarkID, PoseLandmark>,
      detectedCount: newLandmarks.size,
      missingCount: 17 - newLandmarks.size,
      averageConfidence: computeAverageConfidence(newLandmarks),
    };
  });

  return { frames: outputFrames, outliersDetected };
}

/** Euclidean distance between two landmarks in normalized coordinates. */
function normalizedDistance(a: PoseLandmark, b: PoseLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
