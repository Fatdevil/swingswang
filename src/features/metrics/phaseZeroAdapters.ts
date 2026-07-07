/**
 * phaseZeroAdapters.ts
 * SwingSwang – Metrics
 *
 * Adapts Phase 0 metrics (headMovement, torsoAngle, hipProxy)
 * to V1 MetricRegistryEntry format so they can live in the
 * central MetricRegistry alongside native V1 metrics.
 */

import { MetricRegistryEntry, MetricResultV1, statusFromConfidence } from './registry';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig, CameraView } from '@/types/swing';
import { LandmarkID } from '@/types/landmarks';
import { MetricResult } from '@/types/metrics';
import { calculateHeadMovement } from './headMovement';
import { calculateTorsoAngleChange } from './torsoAngle';
import { calculateHipMovementProxy } from './hipProxy';

/** Convert a Phase 0 MetricResult to V1 format. */
function adaptMetricResult(
  result: MetricResult,
  supportedView: CameraView | 'BOTH',
  version: string,
): MetricResultV1 {
  return {
    id: result.metricId,
    name: result.name,
    value: result.rawValue,
    normalizedValue: result.normalizedValue,
    unit: result.unit,
    confidence: result.confidence,
    status: statusFromConfidence(result.confidence),
    supportedView,
    warnings: [...result.warnings],
    evidence: {},
    calculationExplanation: result.calculationExplanation,
    limitations: [...result.limitations],
    framesUsed: result.framesUsed,
    version,
  };
}

export const headMovementEntry: MetricRegistryEntry = {
  id: 'headMovement',
  displayName: 'Head Movement',
  version: '0.1.0',
  supportedViews: ['DTL', 'FO'],
  requiredLandmarks: [
    LandmarkID.nose,
    LandmarkID.leftEye,
    LandmarkID.rightEye,
    LandmarkID.leftShoulder,
    LandmarkID.rightShoulder,
  ],
  requiredConfidence: 0.3,
  calculate(timeline: PoseTimeline, _config: SwingConfig): MetricResultV1 {
    const result = calculateHeadMovement(timeline);
    return adaptMetricResult(result, 'BOTH', this.version);
  },
};

export const torsoAngleEntry: MetricRegistryEntry = {
  id: 'torsoAngleChange',
  displayName: 'Torso Angle Change',
  version: '0.1.0',
  supportedViews: ['DTL', 'FO'],
  requiredLandmarks: [
    LandmarkID.leftShoulder,
    LandmarkID.rightShoulder,
    LandmarkID.leftHip,
    LandmarkID.rightHip,
  ],
  requiredConfidence: 0.3,
  calculate(timeline: PoseTimeline, _config: SwingConfig): MetricResultV1 {
    const result = calculateTorsoAngleChange(timeline);
    return adaptMetricResult(result, 'BOTH', this.version);
  },
};

export const hipProxyEntry: MetricRegistryEntry = {
  id: 'hipMovementProxy',
  displayName: 'Hip Movement Proxy',
  version: '0.1.0',
  supportedViews: ['DTL', 'FO'],
  requiredLandmarks: [
    LandmarkID.leftHip,
    LandmarkID.rightHip,
  ],
  requiredConfidence: 0.3,
  calculate(timeline: PoseTimeline, _config: SwingConfig): MetricResultV1 {
    const result = calculateHipMovementProxy(timeline);
    return adaptMetricResult(result, 'BOTH', this.version);
  },
};
