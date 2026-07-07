/**
 * handDepth.ts
 * SwingSwang – Metrics
 *
 * Hand depth proxy — hand position relative to body (DTL view only).
 * Measures the range of hand center X relative to shoulder center X.
 */

import { LandmarkID, SHOULDER_LANDMARKS } from '@/types/landmarks';
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
import { distance, Point2D } from '@/utils/geometry';
import { roundTo } from '@/utils/math';
import { Logger } from '@/utils/logger';

const METRIC_ID = 'handDepth';
const METRIC_NAME = 'Hand Depth';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEWS: readonly ('DTL' | 'FO')[] = ['DTL'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftWrist,
  LandmarkID.rightWrist,
  LandmarkID.leftShoulder,
  LandmarkID.rightShoulder,
];

/** Minimum frames for meaningful hand depth analysis. */
const MIN_FRAMES = 5; // PROVISIONAL

/** Minimum landmark confidence. */
const MIN_CONF = 0.3;

/** Calculate hand depth metric. */
function calculateHandDepth(
  timeline: PoseTimeline,
  config: SwingConfig,
  _events?: SwingEventResult,
): MetricResultV1 {
  // Only supported from DTL view
  if (config.cameraView !== 'DTL') {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Hand depth measurement requires Down-the-Line (DTL) camera view.',
      'DTL',
      METRIC_VERSION,
    );
  }

  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      `Not enough reliable frames (${reliableFrames.length} < ${MIN_FRAMES}).`,
      'DTL',
      METRIC_VERSION,
    );
  }

  // Track hand center X relative to shoulder center X
  const relativeDepths: number[] = [];
  const shoulderWidths: number[] = [];

  for (const frame of reliableFrames) {
    const lw = frame.landmarks.get(LandmarkID.leftWrist);
    const rw = frame.landmarks.get(LandmarkID.rightWrist);
    const ls = frame.landmarks.get(LandmarkID.leftShoulder);
    const rs = frame.landmarks.get(LandmarkID.rightShoulder);

    if (!lw || !rw || !ls || !rs) continue;
    if (lw.confidence < MIN_CONF || rw.confidence < MIN_CONF) continue;
    if (ls.confidence < MIN_CONF || rs.confidence < MIN_CONF) continue;

    const handCenterX = (lw.x + rw.x) / 2;
    const shoulderCenterX = (ls.x + rs.x) / 2;

    // Positive = hands forward of (to right of in DTL) shoulders
    // Negative = hands behind shoulders
    const relativeX = handCenterX - shoulderCenterX;
    relativeDepths.push(relativeX);

    // Shoulder width for normalization
    const sw = distance(
      { x: ls.x, y: ls.y },
      { x: rs.x, y: rs.y },
    );
    shoulderWidths.push(sw);
  }

  if (relativeDepths.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Hand and shoulder landmarks not visible in enough frames.',
      'DTL',
      METRIC_VERSION,
    );
  }

  if (shoulderWidths.length === 0) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Cannot calculate shoulder width for normalization.',
      'DTL',
      METRIC_VERSION,
    );
  }

  const avgShoulderWidth = shoulderWidths.reduce((s, w) => s + w, 0) / shoulderWidths.length;

  if (avgShoulderWidth < 0.01) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Shoulder width too small for reliable normalization.',
      'DTL',
      METRIC_VERSION,
    );
  }

  // Calculate range of hand depth
  const minDepth = Math.min(...relativeDepths);
  const maxDepth = Math.max(...relativeDepths);
  const depthRange = maxDepth - minDepth;

  // Normalize by shoulder width
  const normalizedRange = depthRange / avgShoulderWidth;

  // Confidence
  const confResult = calculateConfidence(timeline, [...REQUIRED_LANDMARKS], shoulderWidths);
  const confidence = confResult.composite;

  const warnings = [...confResult.warnings];

  Logger.metrics.info('Hand depth calculated', {
    minDepth: roundTo(minDepth, 4),
    maxDepth: roundTo(maxDepth, 4),
    depthRange: roundTo(depthRange, 4),
    normalized: roundTo(normalizedRange, 4),
    shoulderWidth: roundTo(avgShoulderWidth, 4),
    confidence: roundTo(confidence, 3),
    framesUsed: relativeDepths.length,
  });

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(normalizedRange, 4),
    normalizedValue: roundTo(normalizedRange, 4),
    unit: 'shoulder_widths',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'DTL',
    warnings,
    evidence: {
      minRelativeDepth: roundTo(minDepth, 4),
      maxRelativeDepth: roundTo(maxDepth, 4),
      rawDepthRange: roundTo(depthRange, 4),
      avgShoulderWidth: roundTo(avgShoulderWidth, 4),
    },
    calculationExplanation:
      `Hand center X position relative to shoulder center X across the swing. ` +
      `Range: ${roundTo(minDepth, 4)} to ${roundTo(maxDepth, 4)} (raw). ` +
      `Depth range ${roundTo(depthRange, 4)} normalized by shoulder width ` +
      `(${roundTo(avgShoulderWidth, 3)}): ${roundTo(normalizedRange, 3)} shoulder widths.`,
    limitations: [
      'DTL view only — hand depth is meaningless from Face-On.',
      '2D measurement from monocular camera.',
      'Wrist position is a proxy for actual hand position.',
      'In-out hand path cannot be distinguished from depth vs. width motion.',
      'Overlapping hands may confuse wrist detection.',
    ],
    framesUsed: relativeDepths.length,
    version: METRIC_VERSION,
  };
}

/** Registry entry for the hand depth metric. */
export const handDepthMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEWS,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculateHandDepth,
};
