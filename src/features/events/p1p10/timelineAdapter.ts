/**
 * timelineAdapter.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Adapter bridging PoseTimeline and the normative P1–P10 engine.
 * Implements SwingEventDetector to seamlessly plug into analysisPipeline.ts
 * while producing both the canonical 8-event contract for downstream metrics
 * and the full 10-position P1–P10 result with trace and proxy caps.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import {
  SwingEvent as LegacySwingEvent,
  SwingEventDetector,
  SwingEventResult,
  SwingEventType,
  SWING_EVENT_ORDER,
} from '../types';
import {
  CaptureContext,
  PoseFrame as P1P10PoseFrame,
  Landmark as P1P10Landmark,
  SequenceResult as P1P10SequenceResult,
  SwingEvent as P1P10SwingEvent,
  PipelineTrace as P1P10PipelineTrace,
  PPosition,
} from './types';
import { P1P10EventDetector } from './P1P10EventDetector';

/** Mapping of COCO 17 keypoint indices to MediaPipe 33 landmark positions. */
const COCO_TO_MEDIAPIPE_MAP: LandmarkID[] = [
  LandmarkID.nose,          // 0: NOSE
  LandmarkID.leftEye,       // 1: LEFT_EYE_INNER
  LandmarkID.leftEye,       // 2: LEFT_EYE
  LandmarkID.leftEye,       // 3: LEFT_EYE_OUTER
  LandmarkID.rightEye,      // 4: RIGHT_EYE_INNER
  LandmarkID.rightEye,      // 5: RIGHT_EYE
  LandmarkID.rightEye,      // 6: RIGHT_EYE_OUTER
  LandmarkID.leftEar,       // 7: LEFT_EAR
  LandmarkID.rightEar,      // 8: RIGHT_EAR
  LandmarkID.nose,          // 9: MOUTH_LEFT
  LandmarkID.nose,          // 10: MOUTH_RIGHT
  LandmarkID.leftShoulder,  // 11: LEFT_SHOULDER
  LandmarkID.rightShoulder, // 12: RIGHT_SHOULDER
  LandmarkID.leftElbow,     // 13: LEFT_ELBOW
  LandmarkID.rightElbow,    // 14: RIGHT_ELBOW
  LandmarkID.leftWrist,     // 15: LEFT_WRIST
  LandmarkID.rightWrist,    // 16: RIGHT_WRIST
  LandmarkID.leftWrist,     // 17: LEFT_PINKY
  LandmarkID.rightWrist,    // 18: RIGHT_PINKY
  LandmarkID.leftWrist,     // 19: LEFT_INDEX
  LandmarkID.rightWrist,    // 20: RIGHT_INDEX
  LandmarkID.leftWrist,     // 21: LEFT_THUMB
  LandmarkID.rightWrist,    // 22: RIGHT_THUMB
  LandmarkID.leftHip,       // 23: LEFT_HIP
  LandmarkID.rightHip,      // 24: RIGHT_HIP
  LandmarkID.leftKnee,      // 25: LEFT_KNEE
  LandmarkID.rightKnee,     // 26: RIGHT_KNEE
  LandmarkID.leftAnkle,     // 27: LEFT_ANKLE
  LandmarkID.rightAnkle,    // 28: RIGHT_ANKLE
  LandmarkID.leftAnkle,     // 29: LEFT_HEEL
  LandmarkID.rightAnkle,    // 30: RIGHT_HEEL
  LandmarkID.leftAnkle,     // 31: LEFT_FOOT_INDEX
  LandmarkID.rightAnkle,    // 32: RIGHT_FOOT_INDEX
];

/** Extended SwingEventResult returning both legacy 8-event and full P1–P10 data. */
export interface P1P10SwingEventResult extends SwingEventResult {
  readonly p1p10Result: P1P10SequenceResult;
  readonly p1p10Events: Record<PPosition, P1P10SwingEvent>;
  readonly p1p10Trace: P1P10PipelineTrace;
}

/**
 * Maps COCO 17 landmarks map to 33 MediaPipe-compatible landmarks.
 */
export function mapCocoToMediaPipe33(
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): P1P10Landmark[] {
  return COCO_TO_MEDIAPIPE_MAP.map((cocoId) => {
    const lm = landmarks.get(cocoId);
    if (!lm) {
      return { x: 0, y: 0, z: 0, visibility: 0, presence: 0 };
    }
    const conf = lm.confidence ?? 1.0;
    const vis = lm.visibility ?? conf;
    return {
      x: lm.x,
      y: lm.y,
      z: 0,
      visibility: vis,
      presence: conf,
    };
  });
}

/**
 * Converts a PoseTimeline into an array of P1P10PoseFrame objects with PTS in microseconds.
 */
export function timelineToP1P10Frames(
  timeline: PoseTimeline,
  context: CaptureContext,
): P1P10PoseFrame[] {
  return timeline.frames.map((f, idx) => {
    // Always use stabilized COCO-17 landmarks mapped to 33-point format.
    // The stabilization pipeline (PoseStabilizer) applies outlier filtering,
    // gap interpolation, and EMA smoothing to f.landmarks but leaves
    // f.extendedLandmarks completely raw. Using raw extendedLandmarks causes
    // velocity calculations to exceed address quiescence thresholds due to
    // natural MediaPipe frame-to-frame jitter (1-4 px on stationary subjects).
    const imageLandmarks: P1P10Landmark[] = mapCocoToMediaPipe33(f.landmarks);

    const worldLandmarks: P1P10Landmark[] = imageLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility,
      presence: lm.presence,
    }));

    // Use physical realTimestamp if available for physical velocity and duration priors.
    // If not supplied, detect if timeline represents retimed slow-motion playback (> 4s for high frame count)
    let timeSec = f.realTimestamp !== undefined && f.realTimestamp !== null
      ? f.realTimestamp
      : f.timestamp;

    if ((f.realTimestamp === undefined || f.realTimestamp === f.timestamp) && timeline.frames.length >= 100) {
      const totalDur = timeline.endTime - timeline.startTime;
      if (totalDur > 4.0) {
        const inferredFps = timeline.frames.length >= 220 ? 240 : 120;
        timeSec = idx / inferredFps;
      }
    }

    const timestampUs = Math.round(timeSec * 1_000_000);

    return {
      frameIndex: idx,
      timestampUs,
      image: imageLandmarks,
      world: worldLandmarks,
      sourceSizePx: {
        width: f.sourceWidth || 1080,
        height: f.sourceHeight || 1920,
      },
      rotationAppliedDeg: 0,
      inputWasMirrored: false,
    };
  });
}

/**
 * Constructs an unreliable legacy swing event.
 */
function createUnreliableEvent(eventType: SwingEventType): LegacySwingEvent {
  return {
    event: eventType,
    timestampMs: null,
    frameIndex: null,
    confidence: 0,
    status: 'NOT_RELIABLE',
    signals: {},
  };
}

/**
 * Maps a single P-position event to a legacy swing event.
 */
function mapPPositionToLegacy(
  eventType: SwingEventType,
  pEvent: P1P10SwingEvent | undefined,
  timeline: PoseTimeline,
): LegacySwingEvent {
  if (!pEvent || pEvent.status === 'ABSTAIN' || pEvent.frameIndex === null) {
    return createUnreliableEvent(eventType);
  }

  const frameIdx = pEvent.frameIndex;
  const frame = timeline.frames[frameIdx];
  const timestampMs = frame ? Math.round(frame.timestamp * 1000) : pEvent.timestampMs;
  const confidence = pEvent.qualityScore ?? 0.5;

  return {
    event: eventType,
    timestampMs,
    frameIndex: frameIdx,
    confidence: Math.max(0, Math.min(1, confidence)),
    status: 'RELIABLE',
    signals: {
      qualityScore: confidence,
      proxy: pEvent.status === 'DETECTED_PROXY',
      positionIndex: parseInt(pEvent.position.replace('P', ''), 10),
      ...Object.fromEntries(
        Object.entries(pEvent.evidence).filter(
          ([_, v]) => typeof v === 'number' || typeof v === 'boolean',
        ),
      ),
    },
  };
}

/**
 * Maps full P1–P10 SequenceResult to the canonical 8-event SwingEventResult.
 */
export function p1p10ToSwingEventResult(
  p1p10Result: P1P10SequenceResult,
  timeline: PoseTimeline,
): P1P10SwingEventResult {
  const warnings: string[] = [];

  // 1. ADDRESS (P1)
  const address = mapPPositionToLegacy('ADDRESS', p1p10Result.events.P1, timeline);

  // 2. TAKEAWAY (from trace phases)
  let takeaway: LegacySwingEvent;
  const { phases } = p1p10Result.trace;
  if (phases.hasTakeaway && phases.takeawayTimestampMs !== undefined) {
    // Find closest frame in timeline
    let bestIdx: number | null = null;
    let minDiff = Infinity;
    const targetMs = phases.takeawayTimestampMs;

    for (let i = 0; i < timeline.frames.length; i++) {
      const f = timeline.frames[i];
      const timeSec = f.realTimestamp ?? f.timestamp;
      const fMs = timeSec * 1000;
      const diff = Math.abs(fMs - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx !== null) {
      // Ensure takeaway comes strictly after address
      if (address.frameIndex !== null && bestIdx <= address.frameIndex) {
        bestIdx = Math.min(timeline.frames.length - 1, address.frameIndex + 1);
      }

      const frame = timeline.frames[bestIdx];
      takeaway = {
        event: 'TAKEAWAY',
        timestampMs: Math.round(frame.timestamp * 1000),
        frameIndex: bestIdx,
        confidence: Math.min(0.85, address.confidence > 0 ? address.confidence : 0.7),
        status: 'RELIABLE',
        signals: {
          hasTakeaway: true,
          takeawayTimestampMs: targetMs,
        },
      };
    } else {
      takeaway = createUnreliableEvent('TAKEAWAY');
    }
  } else {
    takeaway = createUnreliableEvent('TAKEAWAY');
  }

  // 3. MID_BACKSWING (P2 preferred, fallback to P3)
  const p2 = p1p10Result.events.P2;
  const p3 = p1p10Result.events.P3;
  const midBackswingSource = p2 && p2.status !== 'ABSTAIN' ? p2 : p3;
  const midBackswing = mapPPositionToLegacy('MID_BACKSWING', midBackswingSource, timeline);

  // 4. TOP (P4)
  const top = mapPPositionToLegacy('TOP', p1p10Result.events.P4, timeline);

  // 5. MID_DOWNSWING (P6 preferred, fallback to P5)
  const p6 = p1p10Result.events.P6;
  const p5 = p1p10Result.events.P5;
  const midDownswingSource = p6 && p6.status !== 'ABSTAIN' ? p6 : p5;
  const midDownswing = mapPPositionToLegacy('MID_DOWNSWING', midDownswingSource, timeline);

  // 6. IMPACT_PROXY (P7)
  const impact = mapPPositionToLegacy('IMPACT_PROXY', p1p10Result.events.P7, timeline);

  // 7. MID_FOLLOW_THROUGH (P8 preferred, fallback to P9)
  const p8 = p1p10Result.events.P8;
  const p9 = p1p10Result.events.P9;
  const midFollowThroughSource = p8 && p8.status !== 'ABSTAIN' ? p8 : p9;
  const midFollowThrough = mapPPositionToLegacy('MID_FOLLOW_THROUGH', midFollowThroughSource, timeline);

  // 8. FINISH (P10)
  const finish = mapPPositionToLegacy('FINISH', p1p10Result.events.P10, timeline);

  const events: LegacySwingEvent[] = [
    address,
    takeaway,
    midBackswing,
    top,
    midDownswing,
    impact,
    midFollowThrough,
    finish,
  ];

  // Check temporal ordering
  let temporalOrderValid = true;
  let lastIndex = -1;
  for (const e of events) {
    if (e.frameIndex !== null) {
      if (e.frameIndex < lastIndex) {
        temporalOrderValid = false;
        break;
      }
      lastIndex = e.frameIndex;
    }
  }

  // Count detected & reliable
  let detectedCount = 0;
  let reliableCount = 0;
  for (const e of events) {
    if (e.frameIndex !== null) {
      detectedCount++;
      if (e.status === 'RELIABLE') {
        reliableCount++;
      }
    }
  }

  // Collect warnings
  for (const abst of p1p10Result.trace.abstentions) {
    warnings.push(`Position ${abst.position} abstained: ${abst.reasonCode}`);
  }
  for (const p of Object.values(p1p10Result.events)) {
    for (const w of p.warnings) {
      if (!warnings.includes(w)) {
        warnings.push(w);
      }
    }
  }

  return {
    events,
    detectedCount,
    reliableCount,
    temporalOrderValid,
    warnings,
    p1p10Result,
    p1p10Events: p1p10Result.events,
    p1p10Trace: p1p10Result.trace,
  };
}

/**
 * P1P10TimelineAdapter
 * Adapter class implementing SwingEventDetector using P1P10EventDetector.
 */
export class P1P10TimelineAdapter implements SwingEventDetector {
  readonly name = 'P1P10TimelineAdapter';
  readonly version = '1.0.0';
  private readonly detector: P1P10EventDetector;

  constructor(detector?: P1P10EventDetector) {
    this.detector = detector ?? new P1P10EventDetector();
  }

  detect(timeline: PoseTimeline, config: SwingConfig): P1P10SwingEventResult {
    const totalDur = timeline.endTime - timeline.startTime;
    const nominalFps = timeline.analyzedFPS >= 60
      ? timeline.analyzedFPS
      : (timeline.frames.length >= 220 && totalDur > 4.0 ? 240 : (timeline.frames.length >= 100 && totalDur > 3.0 ? 120 : (timeline.analyzedFPS > 0 ? timeline.analyzedFPS : 30)));

    const context: CaptureContext = {
      view: config.cameraView === 'DTL' ? 'DTL' : 'FACE_ON',
      handedness: config.handedness === 'LEFT' ? 'LEFT' : 'RIGHT',
      mode: 'VIDEO',
      nominalFps,
    };

    if (timeline.frames.length < 5) {
      const emptyEvents = SWING_EVENT_ORDER.map(createUnreliableEvent);
      return {
        events: emptyEvents,
        detectedCount: 0,
        reliableCount: 0,
        temporalOrderValid: true,
        warnings: ['Timeline has fewer than 5 frames — cannot detect swing events'],
        p1p10Result: {
          events: {} as any,
          orderedEvents: [],
          sequenceUsable: false,
          trace: {
            rawFramesCount: timeline.frames.length,
            interpolatedGapsCount: 0,
            filterParameters: { maxGapMs: 50, sgWindowMs: 83, sgOrder: 2, s2D: 0.25 },
            phases: { hasTakeaway: false, hasTransition: false },
            view: context.view,
            handedness: context.handedness,
            gaps: [],
            candidateCountsPerPosition: {} as any,
            abstentions: [],
          },
        },
        p1p10Events: {} as any,
        p1p10Trace: {
          rawFramesCount: timeline.frames.length,
          interpolatedGapsCount: 0,
          filterParameters: { maxGapMs: 50, sgWindowMs: 83, sgOrder: 2, s2D: 0.25 },
          phases: { hasTakeaway: false, hasTransition: false },
          view: context.view,
          handedness: context.handedness,
          gaps: [],
          candidateCountsPerPosition: {} as any,
          abstentions: [],
        },
      };
    }

    const p1p10Frames = timelineToP1P10Frames(timeline, context);
    const sequenceResult = this.detector.detect(p1p10Frames, context);
    return p1p10ToSwingEventResult(sequenceResult, timeline);
  }
}
