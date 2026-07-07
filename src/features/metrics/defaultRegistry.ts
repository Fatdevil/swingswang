/**
 * defaultRegistry.ts
 * SwingSwang – Metrics
 *
 * Factory for the default MetricRegistry populated with all available metrics.
 */

import { MetricRegistry } from './registry';
import { headMovementEntry, torsoAngleEntry, hipProxyEntry } from './phaseZeroAdapters';
import { tempoMetric } from './tempo';
import { pelvisSwayMetric } from './pelvisSway';
import { kneeFlexMetric } from './kneeFlex';
import { handDepthMetric } from './handDepth';

/** Create a MetricRegistry populated with all available V1 metrics. */
export function createDefaultRegistry(): MetricRegistry {
  const registry = new MetricRegistry();

  // Phase 0 adapted metrics (work with both views)
  registry.register(headMovementEntry);
  registry.register(torsoAngleEntry);
  registry.register(hipProxyEntry);

  // V1 native metrics
  registry.register(tempoMetric);
  registry.register(pelvisSwayMetric);
  registry.register(kneeFlexMetric);
  registry.register(handDepthMetric);

  return registry;
}
