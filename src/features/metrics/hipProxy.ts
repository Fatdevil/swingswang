/**
 * hipProxy.ts
 * SwingSwang
 *
 * Hip movement proxy metric — normalized lateral hip displacement.
 */

import { LandmarkID, HIP_LANDMARKS } from '../../types/landmarks';
import { MetricResult, reliabilityFromConfidence, notReliableResult } from '../../types/metrics';
import { PoseTimeline } from '../timeline/PoseTimeline';
import { calculateConfidence } from '../confidence/ConfidenceEngine';
import { Point2D, midpoint, distance, referencePosition, maximumDisplacement } from '../../utils/geometry';
import { roundTo } from '../../utils/math';
import { Logger } from '../../utils/logger';
import { REFERENCE_FRAME_RATIO, MIN_REFERENCE_FRAMES, MAX_REFERENCE_FRAMES } from '../../constants/config';

const METRIC_ID = 'hipMovementProxy';
const METRIC_NAME = 'Hip Movement Proxy';

/** Calculate lateral hip movement, normalized by hip width. */
export function calculateHipMovementProxy(timeline: PoseTimeline): MetricResult {
  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < 3) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Not enough reliable frames for hip movement analysis.');
  }

  // Extract hip midpoint positions and hip widths
  const hipPositions: Point2D[] = [];
  const hipWidths: number[] = [];

  for (const frame of reliableFrames) {
    const leftHip = frame.landmarks.get(LandmarkID.leftHip);
    const rightHip = frame.landmarks.get(LandmarkID.rightHip);

    if (!leftHip || !rightHip) continue;
    if (leftHip.confidence < 0.3 || rightHip.confidence < 0.3) continue;

    const leftPoint = { x: leftHip.x, y: leftHip.y };
    const rightPoint = { x: rightHip.x, y: rightHip.y };

    hipPositions.push(midpoint(leftPoint, rightPoint));
    hipWidths.push(distance(leftPoint, rightPoint));
  }

  if (hipPositions.length < 3) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Hip landmarks not visible in enough frames.');
  }

  if (hipWidths.length === 0) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Cannot calculate hip width for normalization.');
  }

  // Reference position from first N frames
  const refCount = Math.max(
    MIN_REFERENCE_FRAMES,
    Math.min(MAX_REFERENCE_FRAMES, Math.floor(hipPositions.length * REFERENCE_FRAME_RATIO))
  );
  const refPos = referencePosition(hipPositions, refCount);
  if (!refPos) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Cannot establish reference hip position.');
  }

  // Raw max displacement
  const rawDisplacement = maximumDisplacement(hipPositions, refPos);

  // Average hip width for normalization
  const avgHipWidth = hipWidths.reduce((s, w) => s + w, 0) / hipWidths.length;

  if (avgHipWidth < 0.01) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Hip width too small for reliable normalization.');
  }

  const normalizedDisplacement = rawDisplacement / avgHipWidth;

  // Confidence
  const factors = calculateConfidence(timeline, HIP_LANDMARKS, hipWidths);
  const confidence = factors.composite;

  // Always add camera-angle warning for hip proxy
  const warnings = [...factors.warnings];
  if (!warnings.some(w => w.includes('camera'))) {
    warnings.push('Hip movement is a 2D proxy. Actual measurement depends on camera angle relative to the golfer.');
  }

  Logger.metrics.info('Hip movement proxy calculated', {
    raw: roundTo(rawDisplacement, 4),
    normalized: roundTo(normalizedDisplacement, 4),
    hipWidth: roundTo(avgHipWidth, 4),
    confidence: roundTo(confidence, 3),
    framesUsed: hipPositions.length,
  });

  return {
    metricId: METRIC_ID,
    name: METRIC_NAME,
    rawValue: roundTo(rawDisplacement, 4),
    normalizedValue: roundTo(normalizedDisplacement, 4),
    unit: 'hip_widths',
    confidence,
    status: reliabilityFromConfidence(confidence),
    framesUsed: hipPositions.length,
    warnings,
    calculationExplanation:
      `Maximum hip midpoint displacement from address position: ${roundTo(rawDisplacement, 4)} normalized units. ` +
      `Normalized by average hip width (${roundTo(avgHipWidth, 3)}): ${roundTo(normalizedDisplacement, 3)} hip widths. ` +
      `Reference position calculated from first ${refCount} frames.`,
    limitations: [
      'Cannot measure true 3D pelvis translation from normal phone video.',
      '2D proxy depends on camera angle relative to the golfer.',
      'Face-on view: primarily measures lateral sway.',
      'Down-the-line view: primarily measures forward/back movement projected to 2D.',
      'Oblique camera angles make this metric less reliable.',
    ],
  };
}
