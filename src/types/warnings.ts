/**
 * warnings.ts
 * SwingSwang
 *
 * Structured warning types for the analysis pipeline.
 * Every stage can emit warnings that are aggregated into
 * the final AnalysisResultV1.
 */

/** Source of a pipeline warning. */
export type WarningSource =
  | 'VIDEO_QUALITY'
  | 'POSE_ENGINE'
  | 'STABILIZATION'
  | 'EVENT_DETECTION'
  | 'METRIC'
  | 'CONFIDENCE'
  | 'PIPELINE';

/** Severity levels. */
export type WarningSeverity = 'info' | 'warning' | 'error';

/** A structured pipeline warning. */
export interface AnalysisWarning {
  readonly code: string;
  readonly source: WarningSource;
  readonly severity: WarningSeverity;
  readonly message: string;
  readonly userMessage?: string;
}

/** Aggregated warnings from all pipeline stages. */
export interface WarningCollection {
  /** All technical warnings (for debug). */
  readonly technical: readonly AnalysisWarning[];
  /** Simplified user-facing warning messages. */
  readonly userFacing: readonly string[];
}

/** Aggregate warnings from multiple sources into a single collection. */
export function aggregateWarnings(
  ...sources: readonly AnalysisWarning[][]
): WarningCollection {
  const technical: AnalysisWarning[] = [];
  const userFacing: string[] = [];

  for (const source of sources) {
    for (const warning of source) {
      technical.push(warning);
      if (warning.userMessage && !userFacing.includes(warning.userMessage)) {
        userFacing.push(warning.userMessage);
      }
    }
  }

  return { technical, userFacing };
}
