/**
 * ConfidenceEngine.ts
 * SwingSwang
 *
 * Six-factor confidence scoring for measurement reliability.
 */

import { LandmarkID } from '../../types/landmarks';
import { ConfidenceFactors, compositeConfidence, confidenceWarnings } from '../../types/metrics';
import { PoseTimeline } from '../timeline/PoseTimeline';
import { positionalJitter, golferSizeRatio, coefficientOfVariation, mean } from '../../utils/geometry';
import { clamp } from '../../utils/math';
import { JITTER_THRESHOLD, NORMALIZER_CV_THRESHOLD } from '../../constants/config';
import { Logger } from '../../utils/logger';

/** Result of confidence calculation including composite score and warnings. */
export interface ConfidenceResult {
  readonly factors: ConfidenceFactors;
  readonly composite: number;
  readonly warnings: string[];
}

/**
 * Calculate composite confidence for a metric.
 *
 * @param timeline - The pose timeline.
 * @param requiredLandmarks - Landmarks needed for this metric.
 * @param normalizerValues - Values used for normalization (e.g., shoulder widths).
 * @returns Confidence result with factors, composite score, and warnings.
 */
export function calculateConfidence(
  timeline: PoseTimeline,
  requiredLandmarks: readonly LandmarkID[],
  normalizerValues: readonly number[]
): ConfidenceResult {
  const factors: ConfidenceFactors = {
    landmarkVisibility: calcLandmarkVisibility(timeline, requiredLandmarks),
    poseConfidence: timeline.averageConfidence,
    temporalCoverage: calcTemporalCoverage(timeline),
    temporalStability: calcTemporalStability(timeline),
    normalizerReliability: calcNormalizerReliability(normalizerValues),
    golferSizeInFrame: calcGolferSize(timeline),
  };

  const composite = compositeConfidence(factors);
  const warnings = confidenceWarnings(factors);

  Logger.confidence.debug('Confidence calculated', {
    composite: composite.toFixed(3),
    factors: {
      visibility: factors.landmarkVisibility.toFixed(3),
      pose: factors.poseConfidence.toFixed(3),
      coverage: factors.temporalCoverage.toFixed(3),
      stability: factors.temporalStability.toFixed(3),
      normalizer: factors.normalizerReliability.toFixed(3),
      size: factors.golferSizeInFrame.toFixed(3),
    },
  });

  return { factors, composite, warnings };
}

/** Average landmark availability for required landmarks. */
function calcLandmarkVisibility(
  timeline: PoseTimeline,
  requiredLandmarks: readonly LandmarkID[]
): number {
  if (requiredLandmarks.length === 0) return 1.0;

  let totalAvailability = 0;
  for (const id of requiredLandmarks) {
    totalAvailability += timeline.landmarkAvailability(id);
  }
  return totalAvailability / requiredLandmarks.length;
}

/** Ratio of reliable frames to total frames. */
function calcTemporalCoverage(timeline: PoseTimeline): number {
  if (timeline.analyzedFrameCount === 0) return 0;
  return Math.min(1, timeline.reliableFrameCount / Math.max(timeline.analyzedFrameCount, 1));
}

/** Temporal stability based on head/shoulder jitter. */
function calcTemporalStability(timeline: PoseTimeline): number {
  // Measure jitter on nose (most stable reference point)
  const trajectory = timeline.trajectory(LandmarkID.nose);
  const positions = trajectory
    .filter(t => t.point !== null)
    .map(t => t.point!);

  if (positions.length < 2) return 0.5; // insufficient data, assume moderate

  const jitter = positionalJitter(positions);

  // Map jitter to stability: low jitter = high stability
  // JITTER_THRESHOLD (0.02) = boundary where stability drops to 0.5
  const stability = clamp(1 - (jitter / (JITTER_THRESHOLD * 2)), 0, 1);

  return stability;
}

/** Normalizer consistency (1 - coefficient of variation). */
function calcNormalizerReliability(values: readonly number[]): number {
  if (values.length < 2) return 0.5; // insufficient data

  const cv = coefficientOfVariation(values as number[]);

  // Map CV to reliability: low CV = high reliability
  const reliability = clamp(1 - (cv / NORMALIZER_CV_THRESHOLD), 0, 1);

  return reliability;
}

/** Golfer size in frame. */
function calcGolferSize(timeline: PoseTimeline): number {
  const sizes: number[] = [];

  for (const frame of timeline.reliableFrames) {
    const points = Array.from(frame.landmarks.values())
      .filter(l => l.confidence > 0.3)
      .map(l => ({ x: l.x, y: l.y }));

    if (points.length >= 5) {
      sizes.push(golferSizeRatio(points));
    }
  }

  if (sizes.length === 0) return 0.1;

  const avgSize = mean(sizes);

  // Map to 0–1: 0.3+ = full score, below 0.1 = very small
  return clamp(avgSize / 0.3, 0, 1);
}
