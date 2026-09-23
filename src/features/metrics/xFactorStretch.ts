/**
 * xFactorStretch.ts
 * SwingSwang – Metrics
 *
 * X-Factor Stretch metric — evaluates rotational separation between the shoulder
 * axis and pelvic hip axis at P4 (TOP_TRANSITION) relative to P1 (ADDRESS).
 */

import { LandmarkID } from '@/types/landmarks';
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
import { Point2D, distance } from '@/utils/geometry';
import { getLeadLandmarkId, getTrailLandmarkId } from '@/utils/handedness';
import { roundTo } from '@/utils/math';
import { Logger } from '@/utils/logger';

const METRIC_ID = 'xFactorStretch';
const METRIC_NAME = 'X-Factor Stretch';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEWS: readonly ('DTL' | 'FO')[] = ['FO', 'DTL'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftShoulder,
  LandmarkID.rightShoulder,
  LandmarkID.leftHip,
  LandmarkID.rightHip,
];

const MIN_CONF = 0.3;
const OPTIMAL_MIN_SEPARATION = 35; // degrees
const RESTRICTED_TURN_THRESHOLD = 28; // degrees

/** Calculate angle between two 2D vectors in degrees [0, 180]. */
function vectorAngleBetween(v1: Point2D, v2: Point2D): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosVal = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosVal) * (180 / Math.PI);
}

/** Calculate X-Factor stretch metric. */
export function calculateXFactorStretch(
  timeline: PoseTimeline,
  config: SwingConfig,
  events?: SwingEventResult,
): MetricResultV1 {
  if (!SUPPORTED_VIEWS.includes(config.cameraView)) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      `X-Factor stretch is not supported for ${config.cameraView} view.`,
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Truth Gate: Require detected Top (P4) and Address (P1)
  const p1p10Events = (events as any)?.p1p10Events;
  const p4Event = p1p10Events?.P4;
  const topLegacyEvent = events?.events?.find((e) => e.event === 'TOP');

  let topFrameIndex: number | null = null;
  let topTimestampMs: number | null = null;

  if (p4Event && p4Event.status !== 'ABSTAIN') {
    topFrameIndex = p4Event.frameIndex;
    topTimestampMs = p4Event.timestampMs;
  } else if (topLegacyEvent && topLegacyEvent.status === 'RELIABLE' && topLegacyEvent.timestampMs !== null) {
    topFrameIndex = topLegacyEvent.frameIndex;
    topTimestampMs = topLegacyEvent.timestampMs;
  }

  if (topFrameIndex === null && topTimestampMs === null) {
    Logger.metrics.warn('X-Factor stretch abstained: missing top position (P4 / TOP)');
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'X-Factor kräver en detekterad topposition (P4 / TOP).',
      'BOTH',
      METRIC_VERSION,
    );
  }

  const p1Event = p1p10Events?.P1;
  const addressLegacyEvent = events?.events?.find((e) => e.event === 'ADDRESS');

  let addressFrameIndex: number | null = null;
  let addressTimestampMs: number | null = null;

  if (p1Event && p1Event.status !== 'ABSTAIN') {
    addressFrameIndex = p1Event.frameIndex;
    addressTimestampMs = p1Event.timestampMs;
  } else if (addressLegacyEvent && addressLegacyEvent.status === 'RELIABLE' && addressLegacyEvent.timestampMs !== null) {
    addressFrameIndex = addressLegacyEvent.frameIndex;
    addressTimestampMs = addressLegacyEvent.timestampMs;
  }

  if (addressFrameIndex === null && addressTimestampMs === null) {
    Logger.metrics.warn('X-Factor stretch abstained: missing address position (P1 / ADDRESS)');
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'X-Factor kräver en detekterad adressposition (P1 / ADDRESS) som baslinje.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Find frames
  let topFrame = topFrameIndex !== null
    ? timeline.frames.find((f) => f.frameIndex === topFrameIndex) ?? null
    : null;
  if (!topFrame && topTimestampMs !== null) {
    topFrame = timeline.frameAtTime(topTimestampMs / 1000);
  }

  let addressFrame = addressFrameIndex !== null
    ? timeline.frames.find((f) => f.frameIndex === addressFrameIndex) ?? null
    : null;
  if (!addressFrame && addressTimestampMs !== null) {
    addressFrame = timeline.frameAtTime(addressTimestampMs / 1000);
  }

  if (!topFrame || !addressFrame) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Kunde inte hitta bildrutor för topp- eller adressposition.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Resolve lead and trail landmarks
  const leadShoulderId = getLeadLandmarkId(config.handedness, LandmarkID.leftShoulder, LandmarkID.rightShoulder);
  const trailShoulderId = getTrailLandmarkId(config.handedness, LandmarkID.leftShoulder, LandmarkID.rightShoulder);
  const leadHipId = getLeadLandmarkId(config.handedness, LandmarkID.leftHip, LandmarkID.rightHip);
  const trailHipId = getTrailLandmarkId(config.handedness, LandmarkID.leftHip, LandmarkID.rightHip);

  // Address landmarks
  const aLeadShoulder = addressFrame.landmarks.get(leadShoulderId);
  const aTrailShoulder = addressFrame.landmarks.get(trailShoulderId);
  const aLeadHip = addressFrame.landmarks.get(leadHipId);
  const aTrailHip = addressFrame.landmarks.get(trailHipId);

  // Top landmarks
  const tLeadShoulder = topFrame.landmarks.get(leadShoulderId);
  const tTrailShoulder = topFrame.landmarks.get(trailShoulderId);
  const tLeadHip = topFrame.landmarks.get(leadHipId);
  const tTrailHip = topFrame.landmarks.get(trailHipId);

  if (
    !aLeadShoulder || !aTrailShoulder || !aLeadHip || !aTrailHip ||
    !tLeadShoulder || !tTrailShoulder || !tLeadHip || !tTrailHip ||
    aLeadShoulder.confidence < MIN_CONF || aTrailShoulder.confidence < MIN_CONF ||
    aLeadHip.confidence < MIN_CONF || aTrailHip.confidence < MIN_CONF ||
    tLeadShoulder.confidence < MIN_CONF || tTrailShoulder.confidence < MIN_CONF ||
    tLeadHip.confidence < MIN_CONF || tTrailHip.confidence < MIN_CONF
  ) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Axel- eller höftlandmärken är inte tillräckligt synliga vid P4/P1.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Vectors from lead to trail
  const aShoulderVec: Point2D = {
    x: aTrailShoulder.x - aLeadShoulder.x,
    y: aTrailShoulder.y - aLeadShoulder.y,
  };
  const aHipVec: Point2D = {
    x: aTrailHip.x - aLeadHip.x,
    y: aTrailHip.y - aLeadHip.y,
  };

  const tShoulderVec: Point2D = {
    x: tTrailShoulder.x - tLeadShoulder.x,
    y: tTrailShoulder.y - tLeadShoulder.y,
  };
  const tHipVec: Point2D = {
    x: tTrailHip.x - tLeadHip.x,
    y: tTrailHip.y - tLeadHip.y,
  };

  const separationAtAddress = vectorAngleBetween(aShoulderVec, aHipVec);
  const separationAtTop = vectorAngleBetween(tShoulderVec, tHipVec);

  // Dynamic separation stretch (net increase from address baseline)
  const dynamicStretch = Math.max(0, separationAtTop - separationAtAddress);
  const metricValue = separationAtTop;

  // Normalizer: Shoulder widths across reliable frames
  const reliableFrames = timeline.reliableFrames;
  const shoulderWidths: number[] = [];
  for (const f of reliableFrames) {
    const ls = f.landmarks.get(leadShoulderId);
    const ts = f.landmarks.get(trailShoulderId);
    if (ls && ts && ls.confidence >= MIN_CONF && ts.confidence >= MIN_CONF) {
      shoulderWidths.push(distance({ x: ls.x, y: ls.y }, { x: ts.x, y: ts.y }));
    }
  }

  const confResult = calculateConfidence(
    timeline,
    REQUIRED_LANDMARKS,
    shoulderWidths.length > 0 ? shoulderWidths : [0.2],
  );
  let confidence = confResult.composite;

  if (config.cameraView === 'DTL') {
    confidence *= 0.8;
  }
  confidence = Math.min(Math.max(confidence, 0), 1);

  const warnings: string[] = [...confResult.warnings];
  if (config.cameraView === 'DTL') {
    warnings.push('X-Factor separation angle is most accurately measured from Face-On view.');
  }

  const isRestricted = metricValue < RESTRICTED_TURN_THRESHOLD;
  if (isRestricted) {
    warnings.push(`Limited shoulder-to-pelvis coil separation at top (< ${RESTRICTED_TURN_THRESHOLD}°).`);
  }

  const calculationExplanation = metricValue >= OPTIMAL_MIN_SEPARATION
    ? `God separationsvinkel vid toppen (${roundTo(metricValue, 1)}°). Effektiv coil mellan över- och underkropp skapar förutsättningar för kinetisk kraftöverföring.`
    : metricValue >= RESTRICTED_TURN_THRESHOLD
    ? `Måttlig coil vid toppen (${roundTo(metricValue, 1)}°). Axlar och höfter rör sig relativt synkront.`
    : `Begränsad separationsvinkel vid toppen (${roundTo(metricValue, 1)}° < ${RESTRICTED_TURN_THRESHOLD}°). Platt vridning med begränsad torsionsspänning.`;

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(metricValue, 1),
    normalizedValue: roundTo(metricValue, 1),
    unit: 'degrees',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'BOTH',
    warnings,
    evidence: {
      p4FrameIndex: topFrame.frameIndex,
      p4TimestampMs: topTimestampMs !== null ? roundTo(topTimestampMs, 1) : null,
      p1FrameIndex: addressFrame.frameIndex,
      p1TimestampMs: addressTimestampMs !== null ? roundTo(addressTimestampMs, 1) : null,
      separationAtTop: roundTo(separationAtTop, 1),
      separationAtAddress: roundTo(separationAtAddress, 1),
      dynamicStretch: roundTo(dynamicStretch, 1),
      isRestricted,
      cameraView: config.cameraView,
      handedness: config.handedness,
    },
    calculationExplanation,
    limitations: [
      'Evaluated at P4 (TOP_TRANSITION) relative to P1 (ADDRESS).',
      '2D projected angle from monocular video; sagittal/frontal foreshortening affects absolute degrees.',
      `Optimal separation is ${OPTIMAL_MIN_SEPARATION}°–55°. Alert triggers below ${RESTRICTED_TURN_THRESHOLD}°.`,
      'Torso rotation tracking depends on clear visibility of bilateral shoulder and hip joints.',
      'This is a 2D kinematic coil indicator, not a 3D optical motion-capture measurement.',
    ],
    framesUsed: 2,
    version: METRIC_VERSION,
  };
}

/** Registry entry for the X-Factor stretch metric. */
export const xFactorStretchMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEWS,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculateXFactorStretch,
};
