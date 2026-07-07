/**
 * registry.ts
 * SwingSwang – Metrics
 *
 * Central metric registry with view-awareness and event-awareness.
 * Replaces the hardcoded direct-call pattern from Phase 0.
 */

import { CameraView, SwingConfig } from '@/types/swing';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { LandmarkID } from '@/types/landmarks';
import { SwingEventResult } from '@/features/events/types';
import { Logger } from '@/utils/logger';

// ─── MetricResultV1 ─────────────────────────────────────────────────

/** Extended metric result for V1 — adds evidence, supported-view, and version. */
export interface MetricResultV1 {
  readonly id: string;
  readonly name: string;
  readonly value: number | null;
  readonly normalizedValue: number | null;
  readonly unit: string;
  readonly confidence: number;
  readonly status: 'RELIABLE' | 'MARGINAL' | 'NOT_RELIABLE';
  readonly supportedView: CameraView | 'BOTH';
  readonly warnings: string[];
  readonly evidence: Record<string, number | string | boolean | null>;
  readonly calculationExplanation: string;
  readonly limitations: string[];
  readonly framesUsed: number;
  readonly version: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Map a confidence score to a V1 status string. */
export function statusFromConfidence(
  confidence: number,
): 'RELIABLE' | 'MARGINAL' | 'NOT_RELIABLE' {
  if (confidence >= 0.7) return 'RELIABLE';
  if (confidence >= 0.4) return 'MARGINAL';
  return 'NOT_RELIABLE';
}

/** Factory for a "cannot measure" MetricResultV1. */
export function notReliableResultV1(
  id: string,
  name: string,
  reason: string,
  supportedView: CameraView | 'BOTH',
  version: string,
): MetricResultV1 {
  return {
    id,
    name,
    value: null,
    normalizedValue: null,
    unit: 'n/a',
    confidence: 0,
    status: 'NOT_RELIABLE',
    supportedView,
    warnings: [reason],
    evidence: {},
    calculationExplanation: `Cannot measure: ${reason}`,
    limitations: [],
    framesUsed: 0,
    version,
  };
}

// ─── Registry Entry ─────────────────────────────────────────────────

/** Metric calculator registration entry. */
export interface MetricRegistryEntry {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly supportedViews: readonly CameraView[];
  readonly requiredLandmarks: readonly LandmarkID[];
  readonly requiredConfidence: number;
  calculate(
    timeline: PoseTimeline,
    config: SwingConfig,
    events?: SwingEventResult,
  ): MetricResultV1;
}

// ─── MetricRegistry ─────────────────────────────────────────────────

/** Central registry for all metric calculators. */
export class MetricRegistry {
  private entries = new Map<string, MetricRegistryEntry>();

  /** Register a metric calculator. Overwrites any previous entry with the same id. */
  register(entry: MetricRegistryEntry): void {
    if (this.entries.has(entry.id)) {
      Logger.metrics.warn(`Overwriting metric registration: ${entry.id}`);
    }
    this.entries.set(entry.id, entry);
    Logger.metrics.info(`Registered metric: ${entry.id} v${entry.version}`);
  }

  /** Get all metrics that support a given camera view. */
  getMetricsForView(view: CameraView): MetricRegistryEntry[] {
    return Array.from(this.entries.values()).filter((entry) =>
      entry.supportedViews.includes(view),
    );
  }

  /**
   * Calculate all metrics that support the current camera view.
   *
   * Filters by `config.cameraView`, calls each metric's `calculate()`,
   * and returns results keyed by metric ID.
   */
  calculateAvailable(
    timeline: PoseTimeline,
    config: SwingConfig,
    events?: SwingEventResult,
  ): Map<string, MetricResultV1> {
    const results = new Map<string, MetricResultV1>();
    const all = this.getAll();
    const compatible = this.getMetricsForView(config.cameraView);

    const skipped = all.filter(
      (e) => !e.supportedViews.includes(config.cameraView),
    );

    Logger.metrics.info('Calculating available metrics', {
      view: config.cameraView,
      totalRegistered: all.length,
      compatible: compatible.length,
      skipped: skipped.map((e) => e.id),
    });

    for (const entry of compatible) {
      try {
        const result = entry.calculate(timeline, config, events);
        results.set(entry.id, result);
        Logger.metrics.info(`Metric calculated: ${entry.id}`, {
          value: result.value,
          confidence: result.confidence,
          status: result.status,
        });
      } catch (error) {
        Logger.metrics.error(`Metric calculation failed: ${entry.id}`, {
          error: String(error),
        });
        results.set(
          entry.id,
          notReliableResultV1(
            entry.id,
            entry.displayName,
            `Calculation error: ${String(error)}`,
            entry.supportedViews.length === 1
              ? entry.supportedViews[0]
              : 'BOTH',
            entry.version,
          ),
        );
      }
    }

    return results;
  }

  /** Get all registered metric entries. */
  getAll(): MetricRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /** Get a single metric entry by ID. */
  get(id: string): MetricRegistryEntry | undefined {
    return this.entries.get(id);
  }
}
