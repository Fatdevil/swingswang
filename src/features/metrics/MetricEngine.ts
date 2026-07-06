/**
 * MetricEngine.ts
 * SwingSwang
 *
 * Metric calculator interface and aggregate calculation.
 */

import { LandmarkID } from '../../types/landmarks';
import { MetricResult } from '../../types/metrics';
import { MetricsBundle } from '../../types/analysis';
import { PoseTimeline } from '../timeline/PoseTimeline';
import { calculateHeadMovement } from './headMovement';
import { calculateTorsoAngleChange } from './torsoAngle';
import { calculateHipMovementProxy } from './hipProxy';
import { Logger, PerformanceTimer } from '../../utils/logger';

/** Interface for a metric calculator module. */
export interface MetricCalculator {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredLandmarks: readonly LandmarkID[];
  calculate(timeline: PoseTimeline): MetricResult;
}

/** Calculate all Phase 0 metrics from a timeline. */
export function calculateAllMetrics(timeline: PoseTimeline): MetricsBundle {
  const timer = new PerformanceTimer('calculateAllMetrics');

  Logger.metrics.info('Calculating all metrics...');

  const headMovement = calculateHeadMovement(timeline);
  const torsoAngleChange = calculateTorsoAngleChange(timeline);
  const hipMovementProxy = calculateHipMovementProxy(timeline);

  timer.stop();

  Logger.metrics.info('Metrics calculated', {
    head: { value: headMovement.normalizedValue, confidence: headMovement.confidence },
    torso: { value: torsoAngleChange.normalizedValue, confidence: torsoAngleChange.confidence },
    hip: { value: hipMovementProxy.normalizedValue, confidence: hipMovementProxy.confidence },
  });

  return { headMovement, torsoAngleChange, hipMovementProxy };
}
