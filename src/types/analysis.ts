/**
 * analysis.ts
 * SwingSwang
 *
 * Structured analysis result (schema v0.1).
 */

import { MetricResult } from './metrics';
import { ProcessingStats } from './pose';
import { VideoMetadata } from './video';

/** Complete analysis result — the final output of Phase 0. */
export interface AnalysisResult {
  /** Schema version for forward compatibility. */
  readonly schemaVersion: '0.1';
  /** Timestamp when the analysis was performed. */
  readonly timestamp: string; // ISO 8601
  /** Video metadata. */
  readonly video: VideoMetadata;
  /** Processing statistics. */
  readonly processing: ProcessingStats;
  /** Pose detection summary. */
  readonly pose: PoseSummary;
  /** Metric results. */
  readonly metrics: MetricsBundle;
  /** Global warnings. */
  readonly warnings: string[];
}

/** Summary of pose detection quality. */
export interface PoseSummary {
  /** Pose engine name (e.g., "ExecuTorch"). */
  readonly providerName: string;
  /** Pose engine version. */
  readonly providerVersion: string;
  /** Number of landmarks per frame. */
  readonly landmarkCount: number;
  /** Total frames analyzed. */
  readonly framesAnalyzed: number;
  /** Frames with confidence > 0.5. */
  readonly framesReliable: number;
  /** Average confidence across all frames. */
  readonly averageConfidence: number;
}

/** Bundle of all Phase 0 metrics. */
export interface MetricsBundle {
  readonly headMovement: MetricResult;
  readonly torsoAngleChange: MetricResult;
  readonly hipMovementProxy: MetricResult;
}

/** Build a complete AnalysisResult from all pieces. */
export function buildAnalysisResult(
  video: VideoMetadata,
  processing: ProcessingStats,
  pose: PoseSummary,
  metrics: MetricsBundle
): AnalysisResult {
  // Collect all warnings from metrics + add global warnings
  const allWarnings: string[] = [];

  const metricList = [metrics.headMovement, metrics.torsoAngleChange, metrics.hipMovementProxy];

  for (const metric of metricList) {
    for (const warning of metric.warnings) {
      if (!allWarnings.includes(warning)) {
        allWarnings.push(warning);
      }
    }
  }

  // Add global warning if any metric is not reliable
  const unreliableMetrics = metricList.filter(m => m.status === 'notReliable');
  if (unreliableMetrics.length > 0) {
    allWarnings.push(
      `${unreliableMetrics.length} of ${metricList.length} metrics could not be measured reliably.`
    );
  }

  // Add warning if low frame count
  if (processing.framesReliable < 10) {
    allWarnings.push(
      `Only ${processing.framesReliable} reliable frames detected. Results may be inaccurate.`
    );
  }

  return {
    schemaVersion: '0.1',
    timestamp: new Date().toISOString(),
    video,
    processing,
    pose,
    metrics,
    warnings: allWarnings,
  };
}
