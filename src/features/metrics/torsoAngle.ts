/**
 * torsoAngle.ts
 * SwingSwang
 *
 * Torso angle change metric — maximum change in shoulder-to-hip angle from address.
 */

import { LandmarkID, SHOULDER_LANDMARKS, HIP_LANDMARKS } from '../../types/landmarks';
import { MetricResult, reliabilityFromConfidence, notReliableResult } from '../../types/metrics';
import { PoseTimeline } from '../timeline/PoseTimeline';
import { calculateConfidence } from '../confidence/ConfidenceEngine';
import { midpoint, angleFromVertical } from '../../utils/geometry';
import { roundTo } from '../../utils/math';
import { Logger } from '../../utils/logger';

const METRIC_ID = 'torsoAngleChange';
const METRIC_NAME = 'Torso Angle Change';

/** Calculate the maximum torso angle change from the address position. */
export function calculateTorsoAngleChange(timeline: PoseTimeline): MetricResult {
  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < 3) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Not enough reliable frames for torso angle analysis.');
  }

  // Extract torso angles
  const angles: number[] = [];
  const shoulderWidths: number[] = [];

  for (const frame of reliableFrames) {
    const leftShoulder = frame.landmarks.get(LandmarkID.leftShoulder);
    const rightShoulder = frame.landmarks.get(LandmarkID.rightShoulder);
    const leftHip = frame.landmarks.get(LandmarkID.leftHip);
    const rightHip = frame.landmarks.get(LandmarkID.rightHip);

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;
    if (leftShoulder.confidence < 0.3 || rightShoulder.confidence < 0.3) continue;
    if (leftHip.confidence < 0.3 || rightHip.confidence < 0.3) continue;

    const shoulderMid = midpoint(
      { x: leftShoulder.x, y: leftShoulder.y },
      { x: rightShoulder.x, y: rightShoulder.y }
    );
    const hipMid = midpoint(
      { x: leftHip.x, y: leftHip.y },
      { x: rightHip.x, y: rightHip.y }
    );

    const angle = angleFromVertical(hipMid, shoulderMid);
    angles.push(angle);

    const sw = Math.sqrt(
      Math.pow(leftShoulder.x - rightShoulder.x, 2) +
      Math.pow(leftShoulder.y - rightShoulder.y, 2)
    );
    shoulderWidths.push(sw);
  }

  if (angles.length < 3) {
    return notReliableResult(METRIC_ID, METRIC_NAME, 'Shoulder and hip landmarks not visible in enough frames.');
  }

  // Address angle (average of first ~10% of frames)
  const refCount = Math.max(2, Math.floor(angles.length * 0.1));
  const addressAngle = angles.slice(0, refCount).reduce((s, a) => s + a, 0) / refCount;

  // Maximum absolute change from address
  let maxChange = 0;
  for (const angle of angles) {
    const change = Math.abs(angle - addressAngle);
    if (change > maxChange) maxChange = change;
  }

  // Confidence
  const factors = calculateConfidence(timeline, [...SHOULDER_LANDMARKS, ...HIP_LANDMARKS], shoulderWidths);
  const confidence = factors.composite;

  Logger.metrics.info('Torso angle change calculated', {
    addressAngle: roundTo(addressAngle, 2),
    maxChange: roundTo(maxChange, 2),
    framesUsed: angles.length,
    confidence: roundTo(confidence, 3),
  });

  return {
    metricId: METRIC_ID,
    name: METRIC_NAME,
    rawValue: roundTo(maxChange, 2),
    normalizedValue: roundTo(maxChange, 2),
    unit: 'degrees',
    confidence,
    status: reliabilityFromConfidence(confidence),
    framesUsed: angles.length,
    warnings: factors.warnings,
    calculationExplanation:
      `Torso angle measured from hip midpoint to shoulder midpoint relative to vertical. ` +
      `Address angle: ${roundTo(addressAngle, 1)}°. Maximum change: ${roundTo(maxChange, 1)}°. ` +
      `Based on ${angles.length} frames.`,
    limitations: [
      '2D projected measurement from monocular camera.',
      'Camera should be roughly perpendicular to the golfer for best accuracy.',
      'This is NOT a lab-grade 3D measurement.',
      'Occluded shoulders or hips reduce accuracy.',
    ],
  };
}
