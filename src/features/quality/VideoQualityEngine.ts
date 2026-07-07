/**
 * VideoQualityEngine.ts
 * SwingSwang – Quality Gate
 *
 * Orchestrator that runs all quality checks and produces a composite result.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { VideoMetadata } from '@/types/video';
import { QualityCheckResult, QualityStatus, QualityWarning } from '@/features/quality/types';
import { checkBodyVisibility } from '@/features/quality/checks/bodyVisibilityCheck';
import { checkGolferSize } from '@/features/quality/checks/golferSizeCheck';
import { checkPoseCoverage } from '@/features/quality/checks/poseCoverageCheck';
import { checkVideoSuitability } from '@/features/quality/checks/videoSuitabilityCheck';

// ─── Confidence Weights ─────────────────────────────────────────────

/** Weights for computing the overall confidence score. */
const CHECK_WEIGHTS = {
  bodyVisibility: 0.30,
  golferSize: 0.15,
  poseCoverage: 0.35,
  videoSuitability: 0.20,
} as const;

// ─── Status Resolution ──────────────────────────────────────────────

function resolveOverallStatus(statuses: QualityStatus[]): QualityStatus {
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('WARNING')) return 'WARNING';
  return 'PASS';
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Run the full video quality evaluation.
 *
 * 1. Runs all four quality checks independently.
 * 2. Combines results into a single QualityCheckResult.
 * 3. Overall status = FAIL if any FAIL, WARNING if any WARNING, else PASS.
 * 4. `analysisRecommended` = true unless overall status is FAIL.
 * 5. `confidence` = weighted average of individual check confidences.
 */
export function evaluateVideoQuality(
  timeline: PoseTimeline,
  metadata: VideoMetadata,
): QualityCheckResult {
  // Run individual checks
  const bodyVisibility = checkBodyVisibility(timeline);
  const golferSize = checkGolferSize(timeline);
  const poseCoverage = checkPoseCoverage(timeline);
  const videoSuitability = checkVideoSuitability(metadata);

  // Resolve overall status
  const overallStatus = resolveOverallStatus([
    bodyVisibility.status,
    golferSize.status,
    poseCoverage.status,
    videoSuitability.status,
  ]);

  // Weighted confidence
  const confidence =
    bodyVisibility.confidence * CHECK_WEIGHTS.bodyVisibility +
    golferSize.confidence * CHECK_WEIGHTS.golferSize +
    poseCoverage.confidence * CHECK_WEIGHTS.poseCoverage +
    videoSuitability.confidence * CHECK_WEIGHTS.videoSuitability;

  // Aggregate all warnings
  const warnings: QualityWarning[] = [
    ...bodyVisibility.warnings,
    ...golferSize.warnings,
    ...poseCoverage.warnings,
    ...videoSuitability.warnings,
  ];

  return {
    overallStatus,
    confidence: Math.min(1, confidence),
    checks: {
      bodyVisibility,
      golferSize,
      poseCoverage,
      videoSuitability,
    },
    warnings,
    analysisRecommended: overallStatus !== 'FAIL',
  };
}
