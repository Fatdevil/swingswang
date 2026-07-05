/**
 * metrics.ts
 * SwingSwang
 *
 * Metric result types with confidence and reliability.
 */

/** Reliability status derived from confidence score. */
export enum ReliabilityStatus {
  /** Confidence >= 0.7 — measurement is trustworthy. */
  Reliable = 'reliable',
  /** Confidence 0.4–0.7 — measurement exists but use with caution. */
  Marginal = 'marginal',
  /** Confidence < 0.4 — measurement is not reliable enough to use. */
  NotReliable = 'notReliable',
}

/** Derive ReliabilityStatus from a confidence value. */
export function reliabilityFromConfidence(confidence: number): ReliabilityStatus {
  if (confidence >= 0.7) return ReliabilityStatus.Reliable;
  if (confidence >= 0.4) return ReliabilityStatus.Marginal;
  return ReliabilityStatus.NotReliable;
}

/** Display color for a reliability status. */
export function reliabilityColor(status: ReliabilityStatus): string {
  switch (status) {
    case ReliabilityStatus.Reliable: return '#22C55E'; // green
    case ReliabilityStatus.Marginal: return '#EAB308'; // yellow
    case ReliabilityStatus.NotReliable: return '#EF4444'; // red
  }
}

/** Display label for a reliability status. */
export function reliabilityLabel(status: ReliabilityStatus): string {
  switch (status) {
    case ReliabilityStatus.Reliable: return 'Reliable';
    case ReliabilityStatus.Marginal: return 'Marginal';
    case ReliabilityStatus.NotReliable: return 'Not Reliable';
  }
}

/** Complete result of a single metric calculation. */
export interface MetricResult {
  /** Unique identifier for the metric (e.g., "headMovement"). */
  readonly metricId: string;
  /** Human-readable metric name. */
  readonly name: string;
  /** Raw calculated value. null = cannot measure. */
  readonly rawValue: number | null;
  /** Normalized value (body-relative). null = cannot measure. */
  readonly normalizedValue: number | null;
  /** Unit description (e.g., "normalized_displacement", "degrees"). */
  readonly unit: string;
  /** Confidence in this measurement (0–1). */
  readonly confidence: number;
  /** Reliability status derived from confidence. */
  readonly status: ReliabilityStatus;
  /** Number of frames used in calculation. */
  readonly framesUsed: number;
  /** Warnings about data quality. Empty = clean measurement. */
  readonly warnings: string[];
  /** Human-readable calculation explanation. */
  readonly calculationExplanation: string;
  /** Methodology limitations. */
  readonly limitations: string[];
}

/** Six observable factors that determine measurement reliability. */
export interface ConfidenceFactors {
  /** Proportion of required landmarks visible (0–1). */
  readonly landmarkVisibility: number;
  /** Average pose detection confidence (0–1). */
  readonly poseConfidence: number;
  /** Proportion of frames with usable data (0–1). */
  readonly temporalCoverage: number;
  /** Inverse of landmark jitter (0–1). 1 = stable. */
  readonly temporalStability: number;
  /** Normalizer consistency (0–1). 1 = very consistent. */
  readonly normalizerReliability: number;
  /** Golfer size in frame (0–1). Bigger = better. */
  readonly golferSizeInFrame: number;
}

/** Calculate composite confidence from individual factors. */
export function compositeConfidence(factors: ConfidenceFactors): number {
  const weighted =
    factors.landmarkVisibility * 0.25 +
    factors.poseConfidence * 0.25 +
    factors.temporalCoverage * 0.20 +
    factors.temporalStability * 0.15 +
    factors.normalizerReliability * 0.10 +
    factors.golferSizeInFrame * 0.05;

  return Math.min(Math.max(weighted, 0), 1);
}

/** Generate warnings from low confidence factors. */
export function confidenceWarnings(factors: ConfidenceFactors): string[] {
  const warnings: string[] = [];

  if (factors.landmarkVisibility < 0.5) {
    warnings.push(`Required landmarks missing in ${Math.round((1 - factors.landmarkVisibility) * 100)}% of frames.`);
  }
  if (factors.poseConfidence < 0.5) {
    warnings.push(`Average pose detection confidence is low (${Math.round(factors.poseConfidence * 100)}%).`);
  }
  if (factors.temporalCoverage < 0.6) {
    warnings.push(`Valid pose data available for only ${Math.round(factors.temporalCoverage * 100)}% of frames.`);
  }
  if (factors.temporalStability < 0.4) {
    warnings.push('Landmark positions are unstable across frames (jitter detected).');
  }
  if (factors.normalizerReliability < 0.5) {
    warnings.push('Normalization reference varies significantly across frames.');
  }
  if (factors.golferSizeInFrame < 0.1) {
    warnings.push('The golfer appears very small in the frame. Move the camera closer.');
  }

  return warnings;
}

/** Factory for a "cannot measure" result. */
export function notReliableResult(
  metricId: string,
  name: string,
  reason: string
): MetricResult {
  return {
    metricId,
    name,
    rawValue: null,
    normalizedValue: null,
    unit: 'n/a',
    confidence: 0,
    status: ReliabilityStatus.NotReliable,
    framesUsed: 0,
    warnings: [reason],
    calculationExplanation: `Cannot measure: ${reason}`,
    limitations: [],
  };
}
