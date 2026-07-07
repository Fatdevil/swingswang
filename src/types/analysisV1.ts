/**
 * analysisV1.ts
 * SwingSwang
 *
 * V1 analysis result types — the complete output of the Sprint A/B pipeline.
 * Replaces the fixed 3-metric MetricsBundle with a scalable metric registry.
 * Includes quality gate, stabilization, event detection, and confidence data.
 */

import { VideoMetadata } from './video';
import { SwingConfig } from './swing';
import { MetricResultV1 } from '@/features/metrics/registry';
import { SwingEventResult } from '@/features/events/types';
import { QualityCheckResult } from '@/features/quality/types';
import { StabilizationReport } from '@/features/stabilization/types';
import { WarningCollection } from './warnings';

// ─── Pose Summary V1 ────────────────────────────────────────────────

/** Pose detection summary V1 — includes engine mode transparency. */
export interface PoseSummaryV1 {
  readonly providerName: string;
  readonly providerVersion: string;
  readonly landmarkCount: number;
  readonly framesAnalyzed: number;
  readonly framesReliable: number;
  readonly framesEmpty: number;
  readonly averageConfidence: number;
  /** Explicit engine mode — REAL or MOCK. Never hidden. */
  readonly engineMode: 'REAL' | 'MOCK';
}

// ─── Processing Stats V1 ────────────────────────────────────────────

/** Processing statistics V1 — includes per-stage timing. */
export interface ProcessingStatsV1 {
  readonly totalTimeMs: number;
  readonly framesExtracted: number;
  readonly framesAnalyzed: number;
  readonly framesEmpty: number;
  readonly framesReliable: number;
  readonly averageFrameTimeMs: number;
  readonly analysisFrameRate: number;
  /** Per-stage timing in milliseconds. */
  readonly pipelineStages: Record<string, number>;
}

// ─── Confidence Summary ─────────────────────────────────────────────

/** Confidence summary across all pipeline stages. */
export interface ConfidenceSummary {
  readonly video: number;
  readonly pose: number;
  readonly events: number;
  readonly metrics: number;
  readonly overall: number;
}

// ─── Version Metadata ───────────────────────────────────────────────

/** Version metadata for reproducibility. */
export interface VersionMetadata {
  readonly appVersion: string;
  readonly schemaVersion: '1.0';
  readonly poseEngineVersion: string;
  readonly eventDetectorVersion: string;
}

// ─── Analysis Result V1 ─────────────────────────────────────────────

/** Complete V1 analysis result — the full output of Sprint A/B pipeline. */
export interface AnalysisResultV1 {
  readonly schemaVersion: '1.0';
  readonly analysisId: string;
  readonly timestamp: string; // ISO 8601
  readonly video: VideoMetadata;
  readonly swingConfig: SwingConfig;
  readonly processing: ProcessingStatsV1;
  readonly pose: PoseSummaryV1;
  readonly quality: QualityCheckResult | null;
  readonly stabilization: StabilizationReport | null;
  readonly events: SwingEventResult | null;
  readonly metrics: Record<string, MetricResultV1>;
  readonly confidence: ConfidenceSummary;
  readonly warnings: WarningCollection;
  readonly version: VersionMetadata;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Generate a unique analysis ID. */
export function generateAnalysisId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6);
  return `SS-${datePart}-${timePart}-${randomPart}`;
}

/** Type guard: is this a V1 result? */
export function isAnalysisResultV1(result: unknown): result is AnalysisResultV1 {
  return (
    typeof result === 'object' &&
    result !== null &&
    'schemaVersion' in result &&
    (result as { schemaVersion: string }).schemaVersion === '1.0'
  );
}
