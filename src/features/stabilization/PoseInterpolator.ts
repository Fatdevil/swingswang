/**
 * PoseInterpolator.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Short-gap linear interpolation: fills in missing landmarks when the gap
 * is ≤ maxGap consecutive frames. Longer gaps are left as missing.
 * Every interpolated landmark carries InterpolationMetadata.
 */

import { LandmarkID, LANDMARK_COUNT, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';
import { InterpolationMetadata } from './types';

export interface InterpolationResult {
  readonly frames: PoseFrame[];
  readonly interpolatedCount: number;
  readonly rejectedGaps: number;
}

/**
 * Linearly interpolate missing landmarks over short gaps.
 *
 * For each landmark independently:
 *   1. Walk through frames and identify contiguous "gaps" where the landmark
 *      is undefined.
 *   2. If a gap has valid bounding frames on both sides AND gapSize ≤ maxGap,
 *      fill each missing frame with a linearly interpolated position.
 *   3. Otherwise, reject the gap and leave frames unchanged.
 *
 * @param frames  Immutable input frames (may already have missing landmarks).
 * @param maxGap  Maximum gap length eligible for interpolation.
 * @returns New frame array with gaps filled, plus counts.
 */
export function interpolateShortGaps(
  frames: readonly PoseFrame[],
  maxGap: number,
): InterpolationResult {
  if (frames.length < 2) {
    return { frames: [...frames], interpolatedCount: 0, rejectedGaps: 0 };
  }

  // We need to mutate per-frame landmark maps, so build mutable copies upfront.
  const mutableFrames: MutableFrameData[] = frames.map((f) => ({
    original: f,
    landmarks: new Map(f.landmarks),
    interpolatedLandmarks: new Set<LandmarkID>(),
    interpolationMeta: new Map<LandmarkID, InterpolationMetadata>(),
  }));

  let interpolatedCount = 0;
  let rejectedGaps = 0;

  // Process each landmark independently across the timeline.
  for (let lid = 0; lid < LANDMARK_COUNT; lid++) {
    const landmarkId = lid as LandmarkID;
    let i = 0;

    while (i < mutableFrames.length) {
      // Find the start of a gap.
      if (mutableFrames[i].landmarks.has(landmarkId)) {
        i++;
        continue;
      }

      // Found a gap starting at index `i`. Find its end.
      const gapStart = i;
      while (i < mutableFrames.length && !mutableFrames[i].landmarks.has(landmarkId)) {
        i++;
      }
      const gapEnd = i; // First frame AFTER the gap (or past-end).
      const gapSize = gapEnd - gapStart;

      // Need valid bounding frames on both sides.
      const beforeIdx = gapStart - 1;
      const afterIdx = gapEnd;

      if (beforeIdx < 0 || afterIdx >= mutableFrames.length) {
        // Gap at start or end of timeline — cannot interpolate.
        rejectedGaps++;
        continue;
      }

      if (gapSize > maxGap) {
        rejectedGaps++;
        continue;
      }

      const beforeLm = mutableFrames[beforeIdx].landmarks.get(landmarkId)!;
      const afterLm = mutableFrames[afterIdx].landmarks.get(landmarkId)!;

      // Effective confidence = average of bounding confidences × (1 - gapSize/10).
      const avgBoundingConfidence = (beforeLm.confidence + afterLm.confidence) / 2;
      const effectiveConfidence = avgBoundingConfidence * (1 - gapSize / 10);

      // Fill each frame in the gap with a linearly interpolated landmark.
      for (let g = 0; g < gapSize; g++) {
        const frameIdx = gapStart + g;
        const t = (g + 1) / (gapSize + 1); // Parameter: 0 < t < 1

        const interpolatedLm: PoseLandmark = {
          id: landmarkId,
          x: beforeLm.x + t * (afterLm.x - beforeLm.x),
          y: beforeLm.y + t * (afterLm.y - beforeLm.y),
          z: interpolateOptional(beforeLm.z, afterLm.z, t),
          visibility: beforeLm.visibility + t * (afterLm.visibility - beforeLm.visibility),
          confidence: effectiveConfidence,
        };

        const meta: InterpolationMetadata = {
          interpolated: true,
          sourceConfidence: 0.0,
          effectiveConfidence,
          gapSize,
          positionInGap: g + 1,
        };

        mutableFrames[frameIdx].landmarks.set(landmarkId, interpolatedLm);
        mutableFrames[frameIdx].interpolatedLandmarks.add(landmarkId);
        mutableFrames[frameIdx].interpolationMeta.set(landmarkId, meta);
        interpolatedCount++;
      }
    }
  }

  // Rebuild PoseFrames.
  const outputFrames: PoseFrame[] = mutableFrames.map((mf) => {
    if (mf.interpolatedLandmarks.size === 0) {
      return mf.original;
    }

    const landmarks = mf.landmarks as ReadonlyMap<LandmarkID, PoseLandmark>;
    return {
      ...mf.original,
      landmarks,
      detectedCount: landmarks.size,
      missingCount: LANDMARK_COUNT - landmarks.size,
      averageConfidence: computeAverageConfidence(landmarks),
    };
  });

  return { frames: outputFrames, interpolatedCount, rejectedGaps };
}

// ── Internal helpers ───────────────────────────────────────────────────

interface MutableFrameData {
  original: PoseFrame;
  landmarks: Map<LandmarkID, PoseLandmark>;
  interpolatedLandmarks: Set<LandmarkID>;
  interpolationMeta: Map<LandmarkID, InterpolationMetadata>;
}

function interpolateOptional(
  a: number | undefined,
  b: number | undefined,
  t: number,
): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  return a + t * (b - a);
}

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
