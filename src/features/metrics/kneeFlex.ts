/**
 * kneeFlex.ts
 * SwingSwang – Metrics
 *
 * Knee flex pattern metric — approximate lead/trail knee angles
 * at key swing positions using hip-knee-ankle angle.
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
import { jointAngle, Point2D } from '@/utils/geometry';
import {
  getLeadLandmarkId,
  getTrailLandmarkId,
} from '@/utils/handedness';
import { roundTo } from '@/utils/math';
import { Logger } from '@/utils/logger';
import {
  REFERENCE_FRAME_RATIO,
  MIN_REFERENCE_FRAMES,
  MAX_REFERENCE_FRAMES,
} from '@/constants/config';

const METRIC_ID = 'kneeFlex';
const METRIC_NAME = 'Knee Flex Pattern';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEWS: readonly ('DTL' | 'FO')[] = ['DTL', 'FO'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftHip,
  LandmarkID.rightHip,
  LandmarkID.leftKnee,
  LandmarkID.rightKnee,
  LandmarkID.leftAnkle,
  LandmarkID.rightAnkle,
];

/** Minimum frames for meaningful knee flex analysis. */
const MIN_FRAMES = 5; // PROVISIONAL

/** Minimum landmark confidence. */
const MIN_CONF = 0.3;

/** Calculate knee angle (hip → knee → ankle) for one side. */
function getKneeAngle(
  landmarks: ReadonlyMap<LandmarkID, import('@/types/landmarks').PoseLandmark>,
  hipId: LandmarkID,
  kneeId: LandmarkID,
  ankleId: LandmarkID,
): number | null {
  const hip = landmarks.get(hipId);
  const knee = landmarks.get(kneeId);
  const ankle = landmarks.get(ankleId);

  if (!hip || !knee || !ankle) return null;
  if (hip.confidence < MIN_CONF || knee.confidence < MIN_CONF || ankle.confidence < MIN_CONF) {
    return null;
  }

  const hipPt: Point2D = { x: hip.x, y: hip.y };
  const kneePt: Point2D = { x: knee.x, y: knee.y };
  const anklePt: Point2D = { x: ankle.x, y: ankle.y };

  return jointAngle(hipPt, kneePt, anklePt);
}

/** Calculate knee flex metric. */
function calculateKneeFlex(
  timeline: PoseTimeline,
  config: SwingConfig,
  events?: SwingEventResult,
): MetricResultV1 {
  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      `Not enough reliable frames (${reliableFrames.length} < ${MIN_FRAMES}).`,
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Resolve lead/trail landmark IDs based on handedness
  const leadHipId = getLeadLandmarkId(config.handedness, LandmarkID.leftHip, LandmarkID.rightHip);
  const leadKneeId = getLeadLandmarkId(config.handedness, LandmarkID.leftKnee, LandmarkID.rightKnee);
  const leadAnkleId = getLeadLandmarkId(config.handedness, LandmarkID.leftAnkle, LandmarkID.rightAnkle);
  const trailHipId = getTrailLandmarkId(config.handedness, LandmarkID.leftHip, LandmarkID.rightHip);
  const trailKneeId = getTrailLandmarkId(config.handedness, LandmarkID.leftKnee, LandmarkID.rightKnee);
  const trailAnkleId = getTrailLandmarkId(config.handedness, LandmarkID.leftAnkle, LandmarkID.rightAnkle);

  // Collect knee angles per frame
  const leadAngles: number[] = [];
  const trailAngles: number[] = [];

  for (const frame of reliableFrames) {
    const leadAngle = getKneeAngle(frame.landmarks, leadHipId, leadKneeId, leadAnkleId);
    const trailAngle = getKneeAngle(frame.landmarks, trailHipId, trailKneeId, trailAnkleId);

    if (leadAngle !== null) leadAngles.push(leadAngle);
    if (trailAngle !== null) trailAngles.push(trailAngle);
  }

  if (leadAngles.length < MIN_FRAMES && trailAngles.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Knee/hip/ankle landmarks not visible in enough frames.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Address angle (first ~10% of frames)
  const leadRefCount = Math.max(
    MIN_REFERENCE_FRAMES,
    Math.min(MAX_REFERENCE_FRAMES, Math.floor(leadAngles.length * REFERENCE_FRAME_RATIO)),
  );
  const trailRefCount = Math.max(
    MIN_REFERENCE_FRAMES,
    Math.min(MAX_REFERENCE_FRAMES, Math.floor(trailAngles.length * REFERENCE_FRAME_RATIO)),
  );

  const leadAddressAngle = leadAngles.length >= leadRefCount
    ? leadAngles.slice(0, leadRefCount).reduce((s, a) => s + a, 0) / leadRefCount
    : null;

  const trailAddressAngle = trailAngles.length >= trailRefCount
    ? trailAngles.slice(0, trailRefCount).reduce((s, a) => s + a, 0) / trailRefCount
    : null;

  // Max angle change from address
  let leadMaxChange = 0;
  if (leadAddressAngle !== null) {
    for (const angle of leadAngles) {
      const change = Math.abs(angle - leadAddressAngle);
      if (change > leadMaxChange) leadMaxChange = change;
    }
  }

  let trailMaxChange = 0;
  if (trailAddressAngle !== null) {
    for (const angle of trailAngles) {
      const change = Math.abs(angle - trailAddressAngle);
      if (change > trailMaxChange) trailMaxChange = change;
    }
  }

  // Overall max knee angle change
  const maxAngleChange = Math.max(leadMaxChange, trailMaxChange);
  const dominantSide = leadMaxChange >= trailMaxChange ? 'lead' : 'trail';

  // Event-aware angle snapshots
  let angleAtTop: number | null = null;
  let angleAtImpact: number | null = null;

  if (events && events.detectedCount > 0) {
    const topEvent = events.events.find(e => e.event === 'TOP' && e.timestampMs !== null);
    const impactEvent = events.events.find(e => e.event === 'IMPACT_PROXY' && e.timestampMs !== null);

    if (topEvent?.timestampMs !== undefined && topEvent.timestampMs !== null) {
      const topFrame = timeline.frameAtTime(topEvent.timestampMs / 1000);
      if (topFrame) {
        angleAtTop = getKneeAngle(topFrame.landmarks, leadHipId, leadKneeId, leadAnkleId);
      }
    }
    if (impactEvent?.timestampMs !== undefined && impactEvent.timestampMs !== null) {
      const impactFrame = timeline.frameAtTime(impactEvent.timestampMs / 1000);
      if (impactFrame) {
        angleAtImpact = getKneeAngle(impactFrame.landmarks, leadHipId, leadKneeId, leadAnkleId);
      }
    }
  }

  // Confidence
  const normalizerValues = leadAngles.length > 0 ? leadAngles : trailAngles;
  const confResult = calculateConfidence(timeline, [...REQUIRED_LANDMARKS], normalizerValues);
  let confidence = confResult.composite;

  // FO view is more reliable for knee flex — slight penalty for DTL
  if (config.cameraView === 'DTL') {
    confidence *= 0.85; // PROVISIONAL
  }
  confidence = Math.min(Math.max(confidence, 0), 1);

  const warnings = [...confResult.warnings];
  if (config.cameraView === 'DTL') {
    warnings.push('Knee flex is less reliable from Down-the-Line view.');
  }

  const framesUsed = Math.max(leadAngles.length, trailAngles.length);

  Logger.metrics.info('Knee flex calculated', {
    leadMaxChange: roundTo(leadMaxChange, 1),
    trailMaxChange: roundTo(trailMaxChange, 1),
    dominantSide,
    confidence: roundTo(confidence, 3),
    framesUsed,
  });

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(maxAngleChange, 2),
    normalizedValue: roundTo(maxAngleChange, 2),
    unit: 'degrees',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'BOTH',
    warnings,
    evidence: {
      leadAddressAngle: leadAddressAngle !== null ? roundTo(leadAddressAngle, 1) : null,
      trailAddressAngle: trailAddressAngle !== null ? roundTo(trailAddressAngle, 1) : null,
      leadMaxChange: roundTo(leadMaxChange, 1),
      trailMaxChange: roundTo(trailMaxChange, 1),
      dominantSide,
      angleAtTop: angleAtTop !== null ? roundTo(angleAtTop, 1) : null,
      angleAtImpact: angleAtImpact !== null ? roundTo(angleAtImpact, 1) : null,
      handedness: config.handedness,
      cameraView: config.cameraView,
    },
    calculationExplanation:
      `Knee angle (hip→knee→ankle) measured across swing. ` +
      `Lead knee: address ${leadAddressAngle !== null ? roundTo(leadAddressAngle, 1) + '°' : 'N/A'}, ` +
      `max change ${roundTo(leadMaxChange, 1)}°. ` +
      `Trail knee: address ${trailAddressAngle !== null ? roundTo(trailAddressAngle, 1) + '°' : 'N/A'}, ` +
      `max change ${roundTo(trailMaxChange, 1)}°. ` +
      `Dominant change on ${dominantSide} side: ${roundTo(maxAngleChange, 1)}°.`,
    limitations: [
      '2D projected knee angle from monocular camera.',
      'Ankle/knee detection accuracy varies with clothing.',
      'More reliable from Face-On than Down-the-Line view.',
      'This is NOT a clinical joint-angle measurement.',
    ],
    framesUsed,
    version: METRIC_VERSION,
  };
}

/** Registry entry for the knee flex metric. */
export const kneeFlexMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEWS,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculateKneeFlex,
};
