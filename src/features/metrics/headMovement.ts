/**
 * headMovement.ts
 * SwingSwang
 *
 * Head movement metric — normalized head displacement from address position.
 */

import { LandmarkID, HEAD_LANDMARKS, SHOULDER_LANDMARKS } from '../../types/landmarks';
import { MetricResult, reliabilityFromConfidence, notReliableResult } from '../../types/metrics';
import { PoseTimeline } from '../timeline/PoseTimeline';
import { calculateConfidence } from '../confidence/ConfidenceEngine';
import {
  Point2D,
  midpoint,
  distance,
  referencePosition,
  maximumDisplacement,
} from '../../utils/geometry';
import { REFERENCE_FRAME_RATIO, MIN_REFERENCE_FRAMES, MAX_REFERENCE_FRAMES } from '../../constants/config';
import { Logger } from '../../utils/logger';
import { roundTo } from '../../utils/math';

const METRIC_ID = 'headMovement';
const METRIC_NAME = 'Head Movement';

/** Calculate head displacement from address position, normalized by shoulder width. */
export function calculateHeadMovement(timeline: PoseTimeline): MetricResult {
  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < 3) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Not enough reliable frames for head movement analysis.');
  }

  // Extract head positions (midpoint of ears, fallback to nose)
  const headPositions: Point2D[] = [];
  const shoulderWidths: number[] = [];

  for (const frame of reliableFrames) {
    const headPoint = getHeadCenter(frame.landmarks);
    if (!headPoint) continue;

    headPositions.push(headPoint);

    // Shoulder width for normalization
    const leftShoulder = frame.landmarks.get(LandmarkID.leftShoulder);
    const rightShoulder = frame.landmarks.get(LandmarkID.rightShoulder);
    if (leftShoulder && rightShoulder && leftShoulder.confidence > 0.3 && rightShoulder.confidence > 0.3) {
      shoulderWidths.push(distance(
        { x: leftShoulder.x, y: leftShoulder.y },
        { x: rightShoulder.x, y: rightShoulder.y }
      ));
    }
  }

  if (headPositions.length < 3) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Head landmarks not visible in enough frames.');
  }

  if (shoulderWidths.length === 0) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Shoulder landmarks unavailable for normalization.');
  }

  // Reference position from first N frames
  const refCount = Math.max(
    MIN_REFERENCE_FRAMES,
    Math.min(MAX_REFERENCE_FRAMES, Math.floor(headPositions.length * REFERENCE_FRAME_RATIO))
  );
  const refPos = referencePosition(headPositions, refCount);
  if (!refPos) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Cannot establish reference head position.');
  }

  // Raw max displacement
  const rawDisplacement = maximumDisplacement(headPositions, refPos);

  // Average shoulder width for normalization
  const avgShoulderWidth = shoulderWidths.reduce((s, w) => s + w, 0) / shoulderWidths.length;

  if (avgShoulderWidth < 0.01) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Shoulder width too small for reliable normalization.');
  }

  const normalizedDisplacement = rawDisplacement / avgShoulderWidth;

  // Confidence
  const factors = calculateConfidence(timeline, [...HEAD_LANDMARKS, ...SHOULDER_LANDMARKS], shoulderWidths);
  const confidence = factors.composite;

  Logger.metrics.info('Head movement calculated', {
    raw: roundTo(rawDisplacement, 4),
    normalized: roundTo(normalizedDisplacement, 4),
    shoulderWidth: roundTo(avgShoulderWidth, 4),
    confidence: roundTo(confidence, 3),
    framesUsed: headPositions.length,
  });

  return {
    metricId: METRIC_ID,
    name: METRIC_NAME,
    rawValue: roundTo(rawDisplacement, 4),
    normalizedValue: roundTo(normalizedDisplacement, 4),
    unit: 'shoulder_widths',
    confidence,
    status: reliabilityFromConfidence(confidence),
    framesUsed: headPositions.length,
    warnings: factors.warnings,
    calculationExplanation:
      `Maximum head displacement from address position: ${roundTo(rawDisplacement, 4)} normalized units. ` +
      `Normalized by average shoulder width (${roundTo(avgShoulderWidth, 3)}): ${roundTo(normalizedDisplacement, 3)} shoulder widths. ` +
      `Reference position calculated from first ${refCount} frames.`,
    limitations: [
      '2D measurement from monocular camera only.',
      'Accuracy depends on camera stability (tripod recommended).',
      'This is a movement measurement, not a golf swing fault diagnosis.',
      'Head center approximated from visible head landmarks.',
    ],
  };
}

/** Get the best head center point from available landmarks. */
function getHeadCenter(
  landmarks: ReadonlyMap<LandmarkID, import('../../types/landmarks').PoseLandmark>
): Point2D | null {
  const leftEar = landmarks.get(LandmarkID.leftEar);
  const rightEar = landmarks.get(LandmarkID.rightEar);

  // Prefer ear midpoint
  if (leftEar && rightEar && leftEar.confidence > 0.3 && rightEar.confidence > 0.3) {
    return midpoint({ x: leftEar.x, y: leftEar.y }, { x: rightEar.x, y: rightEar.y });
  }

  // Fallback to eye midpoint
  const leftEye = landmarks.get(LandmarkID.leftEye);
  const rightEye = landmarks.get(LandmarkID.rightEye);
  if (leftEye && rightEye && leftEye.confidence > 0.3 && rightEye.confidence > 0.3) {
    return midpoint({ x: leftEye.x, y: leftEye.y }, { x: rightEye.x, y: rightEye.y });
  }

  // Last fallback: nose
  const nose = landmarks.get(LandmarkID.nose);
  if (nose && nose.confidence > 0.3) {
    return { x: nose.x, y: nose.y };
  }

  return null;
}
