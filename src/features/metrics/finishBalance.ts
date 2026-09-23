/**
 * finishBalance.ts
 * SwingSwang – Metrics
 *
 * Finish Balance metric — evaluates lead-side weight transfer and posting
 * (|midHip - leadAnkle|) and trail heel lift at P10 (FINISH).
 * Face-On view only.
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
import { roundTo, clamp } from '@/utils/math';
import { Logger } from '@/utils/logger';

const METRIC_ID = 'finishBalance';
const METRIC_NAME = 'Finish Balance';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEWS: readonly ('DTL' | 'FO')[] = ['FO'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftHip,
  LandmarkID.rightHip,
  LandmarkID.leftAnkle,
  LandmarkID.rightAnkle,
  LandmarkID.leftKnee,
  LandmarkID.rightKnee,
];

const MIN_CONF = 0.3;
const OPTIMAL_MIN_SCORE = 80; // %
const HANG_BACK_THRESHOLD = 60; // %

/** Calculate finish balance metric at P10 (finish). */
export function calculateFinishBalance(
  timeline: PoseTimeline,
  config: SwingConfig,
  events?: SwingEventResult,
): MetricResultV1 {
  // Face-On view only
  if (config.cameraView !== 'FO') {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Finish balance measurement requires Face-On (FO) camera view.',
      'FO',
      METRIC_VERSION,
    );
  }

  // Truth Gate: Require detected finish event (P10 / FINISH)
  const p1p10Events = (events as any)?.p1p10Events;
  const p10Event = p1p10Events?.P10;
  const finishLegacyEvent = events?.events?.find((e) => e.event === 'FINISH');

  let targetFrameIndex: number | null = null;
  let targetTimestampMs: number | null = null;

  if (p10Event && p10Event.status !== 'ABSTAIN') {
    targetFrameIndex = p10Event.frameIndex;
    targetTimestampMs = p10Event.timestampMs;
  } else if (finishLegacyEvent && finishLegacyEvent.status === 'RELIABLE' && finishLegacyEvent.timestampMs !== null) {
    targetFrameIndex = finishLegacyEvent.frameIndex;
    targetTimestampMs = finishLegacyEvent.timestampMs;
  }

  if (targetFrameIndex === null && targetTimestampMs === null) {
    Logger.metrics.warn('Finish balance abstained: missing finish position (P10 / FINISH)');
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Finish balance kräver en detekterad avslutsposition (P10 / FINISH).',
      'FO',
      METRIC_VERSION,
    );
  }

  // Find finish frame
  let finishFrame = targetFrameIndex !== null
    ? timeline.frames.find((f) => f.frameIndex === targetFrameIndex) ?? null
    : null;
  if (!finishFrame && targetTimestampMs !== null) {
    finishFrame = timeline.frameAtTime(targetTimestampMs / 1000);
  }

  if (!finishFrame) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Kunde inte hitta bildruta för avslutspositionen.',
      'FO',
      METRIC_VERSION,
    );
  }

  // Resolve lead and trail landmarks
  const leadHipId = getLeadLandmarkId(config.handedness, LandmarkID.leftHip, LandmarkID.rightHip);
  const trailHipId = getTrailLandmarkId(config.handedness, LandmarkID.leftHip, LandmarkID.rightHip);
  const leadAnkleId = getLeadLandmarkId(config.handedness, LandmarkID.leftAnkle, LandmarkID.rightAnkle);
  const trailAnkleId = getTrailLandmarkId(config.handedness, LandmarkID.leftAnkle, LandmarkID.rightAnkle);

  const leadHip = finishFrame.landmarks.get(leadHipId);
  const trailHip = finishFrame.landmarks.get(trailHipId);
  const leadAnkle = finishFrame.landmarks.get(leadAnkleId);
  const trailAnkle = finishFrame.landmarks.get(trailAnkleId);

  if (
    !leadHip || !trailHip || !leadAnkle || !trailAnkle ||
    leadHip.confidence < MIN_CONF || trailHip.confidence < MIN_CONF ||
    leadAnkle.confidence < MIN_CONF || trailAnkle.confidence < MIN_CONF
  ) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Höft- eller fotledslandmärken är inte tillräckligt synliga vid P10.',
      'FO',
      METRIC_VERSION,
    );
  }

  // 1. Mid-hip position
  const midHipX = (leadHip.x + trailHip.x) / 2;
  const hipWidth = Math.abs(trailHip.x - leadHip.x);

  // 2. Reference stance width
  let stanceWidth = Math.abs(trailAnkle.x - leadAnkle.x);
  if (stanceWidth < 0.05) {
    stanceWidth = Math.max(0.1, hipWidth * 1.8);
  }

  // 3. Lead-side post stacking
  const dx = Math.abs(midHipX - leadAnkle.x);
  const stackRatio = clamp(1.0 - (dx / stanceWidth), 0, 1);

  // 4. Trail heel elevation (Y increases downwards in normalized screen coords)
  const dyTrailHeel = leadAnkle.y - trailAnkle.y; // Positive if trail ankle is elevated above lead ankle
  const trailElevationRatio = clamp(0.5 + (dyTrailHeel / (stanceWidth * 0.4)), 0, 1);

  // Composite balance score (0–100%)
  const rawScore = (stackRatio * 0.75 + trailElevationRatio * 0.25) * 100;
  const score = clamp(rawScore, 0, 100);

  // Normalizer: Hip widths across reliable frames
  const reliableFrames = timeline.reliableFrames;
  const hipWidths: number[] = [];
  for (const f of reliableFrames) {
    const lh = f.landmarks.get(leadHipId);
    const th = f.landmarks.get(trailHipId);
    if (lh && th && lh.confidence >= MIN_CONF && th.confidence >= MIN_CONF) {
      hipWidths.push(distance({ x: lh.x, y: lh.y }, { x: th.x, y: th.y }));
    }
  }

  const confResult = calculateConfidence(
    timeline,
    REQUIRED_LANDMARKS,
    hipWidths.length > 0 ? hipWidths : [0.15],
  );
  const confidence = confResult.composite;

  const warnings: string[] = [...confResult.warnings];
  const isHangingBack = score < HANG_BACK_THRESHOLD;
  if (isHangingBack) {
    warnings.push(`Weight hanging back on trail side at finish (< ${HANG_BACK_THRESHOLD}% lead-side post).`);
  }

  const calculationExplanation = score >= OPTIMAL_MIN_SCORE
    ? `Utmärkt finishbalans (${roundTo(score, 1)} %). Bäckenet är väl staplat över främre foten med lyft och avlastad bakre häl.`
    : score >= HANG_BACK_THRESHOLD
    ? `Godkänd finishbalans (${roundTo(score, 1)} %). Merparten av vikten är på främre sidan men rotationen kan fullföljas ytterligare.`
    : `Bristfällig viktöverföring vid finish (${roundTo(score, 1)} % < ${HANG_BACK_THRESHOLD} %). Vikten hänger kvar på bakre foten (reverse pivot / hang-back).`;

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(score, 1),
    normalizedValue: roundTo(score, 1),
    unit: '%',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'FO',
    warnings,
    evidence: {
      finishFrameIndex: finishFrame.frameIndex,
      finishTimestampMs: targetTimestampMs !== null ? roundTo(targetTimestampMs, 1) : null,
      leadPostOffsetRatio: roundTo(dx / stanceWidth, 3),
      trailHeelLiftRatio: roundTo(trailElevationRatio, 2),
      stackRatio: roundTo(stackRatio, 2),
      balanceScorePercent: roundTo(score, 1),
      weightTransferComplete: score >= OPTIMAL_MIN_SCORE,
      isHangingBack,
      cameraView: config.cameraView,
      handedness: config.handedness,
    },
    calculationExplanation,
    limitations: [
      'Evaluated at P10 (FINISH). Requires clear Face-On view of both feet and pelvis.',
      'Measures 2D lateral stack and vertical heel differential, not force-plate ground reaction forces.',
      `Optimal balance index is ≥ ${OPTIMAL_MIN_SCORE}%. Alert triggers below ${HANG_BACK_THRESHOLD}%.`,
      'Footwear and loose trousers can affect ankle landmark vertical precision.',
      'This is a kinematic posture estimate, not a ground-force measurement.',
    ],
    framesUsed: 1,
    version: METRIC_VERSION,
  };
}

/** Registry entry for the finish balance metric. */
export const finishBalanceMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEWS,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculateFinishBalance,
};
