/**
 * leadArmExtension.ts
 * SwingSwang – Metrics
 *
 * Lead arm extension metric — evaluates elbow flexion/extension angle
 * at P7 (IMPACT_PROXY) to detect early breakdown ("chicken wing").
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
import { jointAngle, Point2D, distance } from '@/utils/geometry';
import { getLeadLandmarkId } from '@/utils/handedness';
import { roundTo } from '@/utils/math';
import { Logger } from '@/utils/logger';

const METRIC_ID = 'leadArmExtension';
const METRIC_NAME = 'Lead Arm Extension';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEWS: readonly ('DTL' | 'FO')[] = ['FO', 'DTL'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftShoulder,
  LandmarkID.rightShoulder,
  LandmarkID.leftElbow,
  LandmarkID.rightElbow,
  LandmarkID.leftWrist,
  LandmarkID.rightWrist,
];

const MIN_CONF = 0.3;
const OPTIMAL_MIN_ANGLE = 165; // degrees (straight arm)
const BREAKDOWN_THRESHOLD = 150; // degrees (chicken wing warning threshold)

/** Calculate lead arm extension at P7 (impact proxy). */
export function calculateLeadArmExtension(
  timeline: PoseTimeline,
  config: SwingConfig,
  events?: SwingEventResult,
): MetricResultV1 {
  // Check view support
  if (!SUPPORTED_VIEWS.includes(config.cameraView)) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      `Lead arm extension is not supported for ${config.cameraView} view.`,
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Truth Gate: Require detected impact event (P7 / IMPACT_PROXY)
  const p1p10Events = (events as any)?.p1p10Events;
  const p7Event = p1p10Events?.P7;
  const impactLegacyEvent = events?.events?.find((e) => e.event === 'IMPACT_PROXY');

  let targetFrameIndex: number | null = null;
  let targetTimestampMs: number | null = null;

  if (p7Event && p7Event.status !== 'ABSTAIN') {
    targetFrameIndex = p7Event.frameIndex;
    targetTimestampMs = p7Event.timestampMs;
  } else if (impactLegacyEvent && impactLegacyEvent.status === 'RELIABLE' && impactLegacyEvent.timestampMs !== null) {
    targetFrameIndex = impactLegacyEvent.frameIndex;
    targetTimestampMs = impactLegacyEvent.timestampMs;
  }

  if (targetFrameIndex === null && targetTimestampMs === null) {
    Logger.metrics.warn('Lead arm extension abstained: no reliable P7 / impact event found');
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Lead arm extension kräver en detekterad träffposition (P7 / IMPACT_PROXY).',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Find impact frame
  let impactFrame = targetFrameIndex !== null
    ? timeline.frames.find((f) => f.frameIndex === targetFrameIndex) ?? null
    : null;

  if (!impactFrame && targetTimestampMs !== null) {
    impactFrame = timeline.frameAtTime(targetTimestampMs / 1000);
  }

  if (!impactFrame) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Kunde inte hitta bildruta för träffpositionen.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Resolve lead arm landmark IDs based on handedness
  const leadShoulderId = getLeadLandmarkId(
    config.handedness,
    LandmarkID.leftShoulder,
    LandmarkID.rightShoulder,
  );
  const leadElbowId = getLeadLandmarkId(
    config.handedness,
    LandmarkID.leftElbow,
    LandmarkID.rightElbow,
  );
  const leadWristId = getLeadLandmarkId(
    config.handedness,
    LandmarkID.leftWrist,
    LandmarkID.rightWrist,
  );

  const shoulder = impactFrame.landmarks.get(leadShoulderId);
  const elbow = impactFrame.landmarks.get(leadElbowId);
  const wrist = impactFrame.landmarks.get(leadWristId);

  if (
    !shoulder ||
    !elbow ||
    !wrist ||
    shoulder.confidence < MIN_CONF ||
    elbow.confidence < MIN_CONF ||
    wrist.confidence < MIN_CONF
  ) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Främre armens landmärken (axel, armbåge, handled) är inte tillräckligt synliga vid P7.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  const shoulderPt: Point2D = { x: shoulder.x, y: shoulder.y };
  const elbowPt: Point2D = { x: elbow.x, y: elbow.y };
  const wristPt: Point2D = { x: wrist.x, y: wrist.y };

  const elbowAngle = jointAngle(shoulderPt, elbowPt, wristPt);

  // Address and Top context if available
  let addressElbowAngle: number | null = null;
  let topElbowAngle: number | null = null;

  const p1Event = p1p10Events?.P1 ?? events?.events?.find((e) => e.event === 'ADDRESS');
  if (p1Event && p1Event.timestampMs !== null) {
    const addressFrame = timeline.frameAtTime(p1Event.timestampMs / 1000);
    if (addressFrame) {
      const as = addressFrame.landmarks.get(leadShoulderId);
      const ae = addressFrame.landmarks.get(leadElbowId);
      const aw = addressFrame.landmarks.get(leadWristId);
      if (as && ae && aw && as.confidence >= MIN_CONF && ae.confidence >= MIN_CONF && aw.confidence >= MIN_CONF) {
        addressElbowAngle = jointAngle({ x: as.x, y: as.y }, { x: ae.x, y: ae.y }, { x: aw.x, y: aw.y });
      }
    }
  }

  const p4Event = p1p10Events?.P4 ?? events?.events?.find((e) => e.event === 'TOP');
  if (p4Event && p4Event.timestampMs !== null) {
    const topFrame = timeline.frameAtTime(p4Event.timestampMs / 1000);
    if (topFrame) {
      const ts = topFrame.landmarks.get(leadShoulderId);
      const te = topFrame.landmarks.get(leadElbowId);
      const tw = topFrame.landmarks.get(leadWristId);
      if (ts && te && tw && ts.confidence >= MIN_CONF && te.confidence >= MIN_CONF && tw.confidence >= MIN_CONF) {
        topElbowAngle = jointAngle({ x: ts.x, y: ts.y }, { x: te.x, y: te.y }, { x: tw.x, y: tw.y });
      }
    }
  }

  // Normalizer: Arm segment lengths across reliable frames
  const reliableFrames = timeline.reliableFrames;
  const armLengths: number[] = [];
  for (const f of reliableFrames) {
    const s = f.landmarks.get(leadShoulderId);
    const e = f.landmarks.get(leadElbowId);
    const w = f.landmarks.get(leadWristId);
    if (s && e && w && s.confidence >= MIN_CONF && e.confidence >= MIN_CONF && w.confidence >= MIN_CONF) {
      armLengths.push(distance({ x: s.x, y: s.y }, { x: e.x, y: e.y }) + distance({ x: e.x, y: e.y }, { x: w.x, y: w.y }));
    }
  }

  const confResult = calculateConfidence(
    timeline,
    REQUIRED_LANDMARKS,
    armLengths.length > 0 ? armLengths : [0.5],
  );
  let confidence = confResult.composite;

  if (config.cameraView === 'DTL') {
    confidence *= 0.85;
  }
  confidence = Math.min(Math.max(confidence, 0), 1);

  const warnings: string[] = [...confResult.warnings];
  if (config.cameraView === 'DTL') {
    warnings.push('Lead arm extension is less reliable from Down-the-Line view.');
  }

  const chickenWingDetected = elbowAngle < BREAKDOWN_THRESHOLD;
  if (chickenWingDetected) {
    warnings.push('Lead arm flexion indicates early breakdown (chicken wing) through impact zone.');
  }

  const calculationExplanation = elbowAngle >= OPTIMAL_MIN_ANGLE
    ? `Optimal armsträckning vid träffproxy (${roundTo(elbowAngle, 1)}°). Främre armen bibehåller rak struktur genom träffzonen.`
    : elbowAngle >= BREAKDOWN_THRESHOLD
    ? `Måttlig armsträckning vid träffproxy (${roundTo(elbowAngle, 1)}°). Främre armen uppvisar en svag böjning vid träffen.`
    : `Tidig armbågsböjning (chicken wing) detekterad vid träffproxy (${roundTo(elbowAngle, 1)}° < ${BREAKDOWN_THRESHOLD}°). Främre armen kollapsar genom träffzonen.`;

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(elbowAngle, 1),
    normalizedValue: roundTo(elbowAngle, 1),
    unit: 'degrees',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'BOTH',
    warnings,
    evidence: {
      impactFrameIndex: impactFrame.frameIndex,
      impactTimestampMs: targetTimestampMs !== null ? roundTo(targetTimestampMs, 1) : null,
      leadElbowAngleAtImpact: roundTo(elbowAngle, 1),
      leadElbowAngleAtAddress: addressElbowAngle !== null ? roundTo(addressElbowAngle, 1) : null,
      leadElbowAngleAtTop: topElbowAngle !== null ? roundTo(topElbowAngle, 1) : null,
      chickenWingDetected,
      isProxy: true,
      cameraView: config.cameraView,
      handedness: config.handedness,
    },
    calculationExplanation,
    limitations: [
      'Evaluated at IMPACT_PROXY (P7). Pose-only model does not track club-ball contact directly.',
      '2D projected angle from monocular camera; out-of-plane flexion may affect absolute degrees.',
      `Optimal extension is ≥ ${OPTIMAL_MIN_ANGLE}°. Chicken wing alert triggers below ${BREAKDOWN_THRESHOLD}°.`,
      'Wrist landmark tracking uncertainty increases during rapid impact zone motion.',
      'This is a biomechanical kinematic metric, not a clinical measurement.',
    ],
    framesUsed: 1,
    version: METRIC_VERSION,
  };
}

/** Registry entry for the lead arm extension metric. */
export const leadArmExtensionMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEWS,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculateLeadArmExtension,
};
