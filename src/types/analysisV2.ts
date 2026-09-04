import { VideoMetadata } from './video';
import { SwingConfig } from './swing';
import { MetricResultV1 } from '@/features/metrics/registry';
import { SwingEventResult } from '@/features/events/types';
import { QualityCheckResult } from '@/features/quality/types';
import { StabilizationReport } from '@/features/stabilization/types';
import { WarningCollection } from './warnings';

import {
  PoseSummaryV1,
  ProcessingStatsV1,
  VersionMetadata,
  ConfidenceSummary,
} from './analysisV1';

// Re-exports / Re-definitions
export type PoseSummaryV2 = PoseSummaryV1;
export type ProcessingStatsV2 = ProcessingStatsV1;
export { ConfidenceSummary };

export interface VersionMetadataV2 extends Omit<VersionMetadata, 'schemaVersion'> {
  readonly schemaVersion: '2.0.0';
}

/** Who is being analyzed. */
export type AnalysisSubject = 'SELF_ADULT' | 'DEPENDENT_MINOR';

/** Audience policy controlling what results can be shown. */
export type AudiencePolicyType = 'ADULT_SELF' | 'GUARDIAN_MANAGED_MINOR';

export interface AudiencePolicy {
  readonly type: AudiencePolicyType;
  readonly policyVersion: string;
}

/** Individual policy decision for a metric/fault/drill. */
export interface PolicyDecision {
  readonly rule: string;
  readonly decision: 'ALLOW' | 'ABSTAIN' | 'BLOCK';
  readonly reason: string;
  readonly targetPopulation?: string;
}

/** Single pipeline stage trace entry. */
export interface PipelineStageTrace {
  readonly name: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly status: 'OK' | 'WARN' | 'ERROR';
  readonly inputSummary: Record<string, unknown>;
  readonly outputSummary: Record<string, unknown>;
}

/** Complete pipeline execution trace. */
export interface PipelineTrace {
  readonly stages: readonly PipelineStageTrace[];
  readonly totalDurationMs: number;
  readonly engineProvider: string;
  readonly engineVersion: string;
}

export interface AnalysisResultV2 {
  readonly schemaVersion: '2.0.0';
  readonly analysisId: string;
  readonly timestamp: string; // ISO 8601
  
  // New R0 fields
  readonly subject: AnalysisSubject;
  readonly audiencePolicy: AudiencePolicy;
  readonly pipelineTrace: PipelineTrace;
  
  // Existing fields (from V1)
  readonly video: VideoMetadata;
  readonly swingConfig: SwingConfig;
  readonly processing: ProcessingStatsV2;
  readonly pose: PoseSummaryV2;
  readonly quality: QualityCheckResult | null;
  readonly stabilization: StabilizationReport | null;
  readonly events: SwingEventResult | null;
  readonly metrics: Record<string, MetricResultV1>;
  readonly confidence: ConfidenceSummary;
  readonly warnings: WarningCollection;
  readonly version: VersionMetadataV2;
  
  // Migration metadata (only present on migrated records)
  readonly migratedFrom?: {
    readonly schemaVersion: string;
    readonly migratedAt: string; // ISO 8601
  };
}

/** Generate a unique analysis ID. */
export function generateAnalysisId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6);
  return `SS-${datePart}-${timePart}-${randomPart}`;
}

/** Type guard: is this a V2 result? */
export function isAnalysisResultV2(result: unknown): result is AnalysisResultV2 {
  return (
    typeof result === 'object' &&
    result !== null &&
    'schemaVersion' in result &&
    (result as { schemaVersion: string }).schemaVersion === '2.0.0'
  );
}
