/**
 * pelvisSway.ts
 * SwingSwang – Metrics
 *
 * Pelvis sway proxy — lateral hip center displacement from address.
 * Face-On view only. Normalized by hip width. Accounts for handedness.
 */

import { LandmarkID, HIP_LANDMARKS } from '@/types/landmarks';
import { SwingConfig } from '@/types/swing';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingEventResult } from '@/features/events/types';
import {
  MetricRegistryEntry,
  MetricResultV1,
  statusFromConfidence,
  notReliableResultV1,
} from './registry';
import { calculateConfidence } from '@/features/confidence/ConfidenceEngine';
import { Point2D, midpoint, distance } from '@/utils/geometry';
import { roundTo } from '@/utils/math';
import { Logger } from '@/utils/logger';
import {
  REFERENCE_FRAME_RATIO,
  MIN_REFERENCE_FRAMES,
  MAX_REFERENCE_FRAMES,
} from '@/constants/config';

const METRIC_ID = 'pelvisSway';
const METRIC_NAME = 'Pelvis Sway';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEWS: readonly ('DTL' | 'FO')[] = ['FO'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftHip,
  LandmarkID.rightHip,
];

/** Minimum frames for meaningful sway analysis. */
const MIN_FRAMES = 5; // PROVISIONAL

/** Calculate pelvis sway metric. */
function calculatePelvisSway(
  timeline: PoseTimeline,
  config: SwingConfig,
  _events?: SwingEventResult,
): MetricResultV1 {
  // Only supported from Face-On view
  if (config.cameraView !== 'FO') {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Pelvis sway measurement requires Face-On (FO) camera view.',
      'FO',
      METRIC_VERSION,
    );
  }

  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      `Not enough reliable frames (${reliableFrames.length} < ${MIN_FRAMES}).`,
      'FO',
      METRIC_VERSION,
    );
  }

  // Extract hip midpoint X-coordinates and hip widths
  const hipMidpoints: Point2D[] = [];
  const hipWidths: number[] = [];

  for (const frame of reliableFrames) {
    const leftHip = frame.landmarks.get(LandmarkID.leftHip);
    const rightHip = frame.landmarks.get(LandmarkID.rightHip);

    if (!leftHip || !rightHip) continue;
    if (leftHip.confidence < 0.3 || rightHip.confidence < 0.3) continue;

    const leftPoint: Point2D = { x: leftHip.x, y: leftHip.y };
    const rightPoint: Point2D = { x: rightHip.x, y: rightHip.y };

    hipMidpoints.push(midpoint(leftPoint, rightPoint));
    hipWidths.push(distance(leftPoint, rightPoint));
  }

  if (hipMidpoints.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Hip landmarks not visible in enough frames.',
      'FO',
      METRIC_VERSION,
    );
  }

  if (hipWidths.length === 0) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Cannot calculate hip width for normalization.',
      'FO',
      METRIC_VERSION,
    );
  }

  // Average hip width for normalization
  const avgHipWidth = hipWidths.reduce((s, w) => s + w, 0) / hipWidths.length;

  if (avgHipWidth < 0.01) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Hip width too small for reliable normalization.',
      'FO',
      METRIC_VERSION,
    );
  }

  // Reference X position from first N frames (address position)
  const refCount = Math.max(
    MIN_REFERENCE_FRAMES,
    Math.min(MAX_REFERENCE_FRAMES, Math.floor(hipMidpoints.length * REFERENCE_FRAME_RATIO)),
  );
  const refXPositions = hipMidpoints.slice(0, refCount).map((p) => p.x);
  const addressX = refXPositions.reduce((s, x) => s + x, 0) / refXPositions.length;

  // Calculate max lateral displacement from address (X-axis only)
  let maxLateralDisplacement = 0;
  let maxSwayDirection: 'lead' | 'trail' | 'none' = 'none';

  // For RIGHT-handed: lead side = left (smaller X in normal view), trail = right (larger X)
  // For LEFT-handed: lead side = right, trail = left
  const leadDirection = config.handedness === 'RIGHT' ? -1 : 1; // lead side X delta sign

  for (const point of hipMidpoints) {
    const lateralDisplacement = Math.abs(point.x - addressX);
    if (lateralDisplacement > maxLateralDisplacement) {
      maxLateralDisplacement = lateralDisplacement;
      const delta = point.x - addressX;
      maxSwayDirection =
        delta * leadDirection > 0 ? 'lead' : delta * leadDirection < 0 ? 'trail' : 'none';
    }
  }

  // Normalize by hip width
  const normalizedSway = maxLateralDisplacement / avgHipWidth;

  // Confidence
  const confResult = calculateConfidence(timeline, [...HIP_LANDMARKS], hipWidths);
  const confidence = confResult.composite;

  const warnings = [...confResult.warnings];
  if (!warnings.some((w) => w.includes('camera'))) {
    warnings.push('Pelvis sway is a 2D proxy from Face-On view. Actual 3D movement may differ.');
  }

  Logger.metrics.info('Pelvis sway calculated', {
    rawDisplacement: roundTo(maxLateralDisplacement, 4),
    normalized: roundTo(normalizedSway, 4),
    hipWidth: roundTo(avgHipWidth, 4),
    direction: maxSwayDirection,
    confidence: roundTo(confidence, 3),
    framesUsed: hipMidpoints.length,
  });

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(normalizedSway, 4),
    normalizedValue: roundTo(normalizedSway, 4),
    unit: 'hip_widths',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'FO',
    warnings,
    evidence: {
      rawLateralDisplacement: roundTo(maxLateralDisplacement, 4),
      avgHipWidth: roundTo(avgHipWidth, 4),
      swayDirection: maxSwayDirection,
      addressX: roundTo(addressX, 4),
      handedness: config.handedness,
    },
    calculationExplanation:
      `Maximum lateral hip center displacement from address: ` +
      `${roundTo(maxLateralDisplacement, 4)} normalized units. ` +
      `Normalized by average hip width (${roundTo(avgHipWidth, 3)}): ` +
      `${roundTo(normalizedSway, 3)} hip widths. ` +
      `Direction: toward ${maxSwayDirection} side. ` +
      `Reference position from first ${refCount} frames.`,
    limitations: [
      '2D measurement from Face-On camera view only.',
      'Cannot distinguish pelvic rotation from lateral sway.',
      'Camera must be roughly perpendicular to the golfer.',
      'Hip center is approximated from visible hip landmarks.',
    ],
    framesUsed: hipMidpoints.length,
    version: METRIC_VERSION,
  };
}

/** Registry entry for the pelvis sway metric. */
export const pelvisSwayMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEWS,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculatePelvisSway,
};
