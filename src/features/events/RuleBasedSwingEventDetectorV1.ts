/**
 * RuleBasedSwingEventDetectorV1.ts
 * SwingSwang – Swing Event Detection
 *
 * Rule-based temporal state machine that detects 8 swing events
 * from a PoseTimeline. All thresholds are PROVISIONAL — will be
 * tuned after real pose data.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { CameraView, SwingConfig } from '@/types/swing';
import { LandmarkID, isLandmarkVisible } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';
import {
  SwingEvent,
  SwingEventDetector,
  SwingEventResult,
  SwingEventType,
  SWING_EVENT_ORDER,
} from './types';
import {
  extractHandCenter,
  extractHandVelocity,
  extractHandDirection,
  extractWristHeight,
  extractHandLateralOffset,
  extractTrailHeelLift,
  smoothSignal,
} from './signalExtractors';

// ─── Posture Validation ─────────────────────────────────────────────

export interface PostureCheckResult {
  readonly isValid: boolean;
  readonly isRelaxed: boolean;
  readonly reason?: string;
}

/**
 * Validates that a pose frame corresponds to a plausible golf address setup posture.
 *
 * Strict check:
 *  - Wrists hang down below shoulders (wristY > shoulderY + 0.10 in screen coords).
 *  - Wrists are around hip level or between shoulders and knees.
 *  - Shoulders are above hips (shoulderY < hipY).
 *  - In Face-On (FO): Hands are centered between shoulders (with 0.08 margin).
 *  - Lower body landmarks (knees, ankles) confirm an upright stance (hipY < kneeY < ankleY).
 *
 * Relaxed check (when lower body is cropped or not fully visible):
 *  - Only upper body is verified (wrists hanging well below shoulders, shoulders above hips).
 */
export function checkAddressPosture(
  frame: PoseFrame,
  cameraView: CameraView = 'FO',
): PostureCheckResult {
  const lw = frame.landmarks.get(LandmarkID.leftWrist);
  const rw = frame.landmarks.get(LandmarkID.rightWrist);
  const ls = frame.landmarks.get(LandmarkID.leftShoulder);
  const rs = frame.landmarks.get(LandmarkID.rightShoulder);

  // Upper body landmarks must be visible
  if (!isLandmarkVisible(lw) || !isLandmarkVisible(rw) || !isLandmarkVisible(ls) || !isLandmarkVisible(rs)) {
    return { isValid: false, isRelaxed: false, reason: 'Key upper body landmarks missing or low confidence' };
  }

  const wristY = (lw!.y + rw!.y) / 2;
  const shoulderY = (ls!.y + rs!.y) / 2;
  const wristX = (lw!.x + rw!.x) / 2;

  // Check hips if visible
  const lh = frame.landmarks.get(LandmarkID.leftHip);
  const rh = frame.landmarks.get(LandmarkID.rightHip);
  const hipsVisible = isLandmarkVisible(lh) && isLandmarkVisible(rh);

  if (hipsVisible) {
    const hipY = (lh!.y + rh!.y) / 2;
    // Shoulders must be above hips
    if (shoulderY >= hipY) {
      return { isValid: false, isRelaxed: false, reason: 'Body not upright (shoulders at or below hips)' };
    }
    const torsoLength = Math.max(0.08, hipY - shoulderY);
    // Wrists must hang down significantly below shoulders (scaled to torso length)
    if (wristY <= shoulderY + torsoLength * 0.25) {
      return { isValid: false, isRelaxed: false, reason: 'Hands not hanging down below shoulders' };
    }
    // Wrists should be at least partway down from shoulders toward hips
    if (wristY < shoulderY + torsoLength * 0.35) {
      return { isValid: false, isRelaxed: false, reason: 'Hands too high relative to hips' };
    }
  } else {
    // If hips not visible, fallback to absolute margin
    if (wristY <= shoulderY + 0.08) {
      return { isValid: false, isRelaxed: false, reason: 'Hands not hanging down below shoulders' };
    }
  }

  // Face-On centering check
  if (cameraView === 'FO') {
    const shoulderSpan = Math.abs(rs!.x - ls!.x);
    const centerTolerance = Math.max(0.08, shoulderSpan * 0.6);
    const minShoulderX = Math.min(ls!.x, rs!.x) - centerTolerance;
    const maxShoulderX = Math.max(ls!.x, rs!.x) + centerTolerance;
    if (wristX < minShoulderX || wristX > maxShoulderX) {
      return { isValid: false, isRelaxed: false, reason: 'Hands not centered in front of body for Face-On view' };
    }
  }

  // Check lower body (knees and ankles) for strict posture validation
  const lk = frame.landmarks.get(LandmarkID.leftKnee);
  const rk = frame.landmarks.get(LandmarkID.rightKnee);
  const la = frame.landmarks.get(LandmarkID.leftAnkle);
  const ra = frame.landmarks.get(LandmarkID.rightAnkle);
  const lowerBodyVisible = isLandmarkVisible(lk) && isLandmarkVisible(rk) && isLandmarkVisible(la) && isLandmarkVisible(ra);

  if (lowerBodyVisible && hipsVisible) {
    const hipY = (lh!.y + rh!.y) / 2;
    const kneeY = (lk!.y + rk!.y) / 2;
    const ankleY = (la!.y + ra!.y) / 2;

    // Upright progression: hip < knee < ankle
    if (hipY >= kneeY || kneeY >= ankleY) {
      return { isValid: false, isRelaxed: false, reason: 'Lower body not in upright stance' };
    }

    // Hands must not be hanging below the knees
    if (wristY > kneeY) {
      return { isValid: false, isRelaxed: false, reason: 'Hands positioned below knees' };
    }

    return { isValid: true, isRelaxed: false };
  }

  // If lower body is not visible, but upper body criteria passed, accept as relaxed
  return { isValid: true, isRelaxed: true };
}

export interface AddressCandidate {
  readonly startIdx: number;
  readonly endIdx: number;
  readonly midIdx: number;
  readonly clarity: number;
  readonly avgVelocity: number;
  readonly usedRelaxed: boolean;
  readonly consecutiveFrames: number;
}

// ─── Configuration ──────────────────────────────────────────────────

/** PROVISIONAL thresholds for swing event detection. */
export interface EventDetectionConfig {
  /** PROVISIONAL — max hand velocity to consider "still" */
  readonly stillnessVelocityThreshold: number;
  /** PROVISIONAL — min hand velocity to consider "moving" */
  readonly movementVelocityThreshold: number;
  /** PROVISIONAL — min consecutive still frames for ADDRESS/FINISH */
  readonly stillnessMinFrames: number;
  /** PROVISIONAL — min delta to detect direction reversal */
  readonly directionChangeMinDelta: number;
  /** PROVISIONAL — tolerance when matching wrist height back to address level */
  readonly wristHeightTolerance: number;
}

export const DEFAULT_EVENT_DETECTION_CONFIG: EventDetectionConfig = {
  stillnessVelocityThreshold: 0.15,
  movementVelocityThreshold: 0.25,
  stillnessMinFrames: 3,
  directionChangeMinDelta: 0.003,
  wristHeightTolerance: 0.05,
};

// ─── Helpers ────────────────────────────────────────────────────────

/** Create a NOT_RELIABLE event stub. */
function unreliableEvent(eventType: SwingEventType): SwingEvent {
  return {
    event: eventType,
    timestampMs: null,
    frameIndex: null,
    confidence: 0,
    status: 'NOT_RELIABLE',
    signals: {},
  };
}

/** Create a RELIABLE event. */
function reliableEvent(
  eventType: SwingEventType,
  frameIndex: number,
  timestampMs: number,
  confidence: number,
  signals: Record<string, number | boolean>,
): SwingEvent {
  return {
    event: eventType,
    timestampMs,
    frameIndex,
    confidence: Math.max(0, Math.min(1, confidence)),
    status: 'RELIABLE',
    signals,
  };
}

/** Validate that detected events are in temporal order. */
function validateTemporalOrder(events: SwingEvent[]): boolean {
  let lastIndex = -1;
  for (const e of events) {
    if (e.frameIndex !== null) {
      if (e.frameIndex < lastIndex) return false;
      lastIndex = e.frameIndex;
    }
  }
  return true;
}

// ─── Detector ───────────────────────────────────────────────────────

export class RuleBasedSwingEventDetectorV1 implements SwingEventDetector {
  readonly name = 'RuleBasedSwingEventDetectorV1';
  readonly version = '1.0.0';
  private readonly config: EventDetectionConfig;

  constructor(config: Partial<EventDetectionConfig> = {}) {
    this.config = { ...DEFAULT_EVENT_DETECTION_CONFIG, ...config };
  }

  detect(timeline: PoseTimeline, swingConfig: SwingConfig): SwingEventResult {
    const warnings: string[] = [];

    // Empty timeline — all events unreliable
    if (timeline.frames.length === 0) {
      return {
        events: SWING_EVENT_ORDER.map(unreliableEvent),
        detectedCount: 0,
        reliableCount: 0,
        temporalOrderValid: true,
        warnings: ['Empty timeline — no frames to analyze'],
      };
    }

    const cameraView = swingConfig.cameraView ?? 'FO';
    const handedness = swingConfig.handedness ?? 'RIGHT';

    // Extract signals
    const rawVelocities = extractHandVelocity(timeline);
    const velocities = timeline.analyzedFPS >= 60
      ? smoothSignal(rawVelocities, 3)
      : rawVelocities;
    const directions = extractHandDirection(timeline, handedness, cameraView);
    const wristHeights = extractWristHeight(timeline);
    const lateralOffsets = extractHandLateralOffset(timeline, handedness, cameraView);
    const heelLifts = extractTrailHeelLift(timeline, handedness, cameraView);

    const frameCount = timeline.frames.length;

    // Collect all valid address setup candidates
    const addressCandidates = this.collectAddressCandidates(velocities, timeline, frameCount, cameraView);

    // Locate the candidate downswing peak (kinetic anchor)
    let peakVel = 0;
    let peakIdx = -1;

    for (let i = 1; i < frameCount - 1; i++) {
      const v = velocities[i];
      if (isNaN(v)) continue;

      const prevV = isNaN(velocities[i - 1]) ? 0 : velocities[i - 1];
      const nextV = isNaN(velocities[i + 1]) ? 0 : velocities[i + 1];

      // Filter out isolated 1-frame spikes: require at least one neighbor with some movement
      if (v > peakVel && (prevV > 0.08 || nextV > 0.08 || v < 0.6)) {
        peakVel = v;
        peakIdx = i;
      }
    }

    // Single frame fallback
    if (frameCount === 1) {
      const posture = checkAddressPosture(timeline.frames[0], cameraView);
      if (posture.isValid) {
        const v = isNaN(velocities[0]) ? 0 : velocities[0];
        const clarity = Math.max(0.1, 1 - (v / this.config.stillnessVelocityThreshold));
        const addr = reliableEvent('ADDRESS', 0, timeline.frames[0].timestamp * 1000, clarity, {
          avgVelocity: v,
          stillFrames: 1,
          postureValidated: true,
          relaxedPosture: posture.isRelaxed,
        });
        const events: SwingEvent[] = [
          addr,
          unreliableEvent('TAKEAWAY'),
          unreliableEvent('MID_BACKSWING'),
          unreliableEvent('TOP'),
          unreliableEvent('MID_DOWNSWING'),
          unreliableEvent('IMPACT_PROXY'),
          unreliableEvent('MID_FOLLOW_THROUGH'),
          unreliableEvent('FINISH'),
        ];
        return {
          events,
          detectedCount: 1,
          reliableCount: 1,
          temporalOrderValid: true,
          warnings,
        };
      }
    }

    // If peak velocity is below movement threshold, handle as stationary / sub-threshold timeline
    if (peakIdx === -1 || peakVel < Math.max(0.20, this.config.movementVelocityThreshold)) {
      return this.detectStationaryTimeline(
        velocities,
        timeline,
        frameCount,
        addressCandidates,
        warnings,
        cameraView,
      );
    }

    // ─── ACTIVE SWING DETECTION (Bidirectional Peak Velocity Anchor) ───

    // Step 1: Detect TOP (P4) by searching BACKWARD from the downswing peak
    const topResult = this.detectTopBackward(
      wristHeights,
      velocities,
      lateralOffsets,
      heelLifts,
      timeline,
      peakIdx,
      peakVel,
      cameraView,
      addressCandidates,
    );

    // Step 2: Detect TAKEAWAY (P2) by searching BACKWARD from TOP
    const takeawayResult = this.detectTakeawayBackward(
      velocities,
      directions,
      wristHeights,
      timeline,
      topResult.frameIndex,
      addressCandidates,
      cameraView,
    );

    // Step 3: Detect ADDRESS (P1) immediately preceding TAKEAWAY
    const addressResult = this.detectAddressPrecedingTakeaway(
      addressCandidates,
      timeline,
      takeawayResult.frameIndex,
      warnings,
    );

    // Step 4: Detect MID_BACKSWING (P3) between Takeaway and Top
    const midBackswingResult = this.detectMidBackswing(
      wristHeights,
      timeline,
      takeawayResult.frameIndex,
      topResult.frameIndex,
    );

    // Step 5: Detect IMPACT_PROXY (P7) forward from Top around downswing peak
    const impactResult = this.detectImpactProxyAroundPeak(
      wristHeights,
      velocities,
      timeline,
      topResult.frameIndex,
      peakIdx,
      peakVel,
      frameCount,
      addressResult.event,
    );

    // Step 6: Detect MID_DOWNSWING (P5) between Top and Impact
    const midDownswingResult = this.detectMidDownswing(
      velocities,
      timeline,
      topResult.frameIndex,
      impactResult.frameIndex,
    );

    // Step 7: Detect MID_FOLLOW_THROUGH (P8) after Impact
    const midFollowThroughResult = this.detectMidFollowThrough(
      velocities,
      timeline,
      impactResult.frameIndex,
      frameCount,
    );

    // Step 8: Detect FINISH (P10) after Impact / Follow-through
    const finishResult = this.detectFinishForward(
      velocities,
      lateralOffsets,
      heelLifts,
      wristHeights,
      timeline,
      impactResult.frameIndex,
      frameCount,
      cameraView,
      addressResult.event,
    );

    // Build the events array in canonical order
    const events: SwingEvent[] = [
      addressResult.event,
      takeawayResult,
      midBackswingResult,
      topResult,
      midDownswingResult,
      impactResult,
      midFollowThroughResult,
      finishResult,
    ];

    // Enforce strict temporal ordering (Truth Gate)
    let lastIndex = -1;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.status === 'RELIABLE' && e.frameIndex !== null) {
        if (e.frameIndex < lastIndex) {
          // Out of order event: mark as NOT_RELIABLE to prevent corrupting analytics
          events[i] = unreliableEvent(e.event);
        } else {
          lastIndex = e.frameIndex;
        }
      }
    }

    const temporalOrderValid = validateTemporalOrder(events);
    if (!temporalOrderValid) {
      warnings.push('Detected events are not in valid temporal order');
    }

    const detectedCount = events.filter(e => e.status === 'RELIABLE').length;
    const reliableCount = detectedCount;

    return {
      events,
      detectedCount,
      reliableCount,
      temporalOrderValid,
      warnings,
    };
  }

  // ─── Candidate & Helper Methods ─────────────────────────────────

  private collectAddressCandidates(
    velocities: number[],
    timeline: PoseTimeline,
    frameCount: number,
    cameraView: CameraView = 'FO',
  ): AddressCandidate[] {
    const { stillnessVelocityThreshold, stillnessMinFrames } = this.config;
    let consecutiveStill = 0;
    let runStart = 0;
    let runUsedRelaxed = false;

    const candidates: AddressCandidate[] = [];

    for (let i = 0; i < frameCount; i++) {
      const v = velocities[i];
      const frame = timeline.frames[i];
      const posture = checkAddressPosture(frame, cameraView);

      if (!isNaN(v) && v <= stillnessVelocityThreshold && posture.isValid) {
        if (consecutiveStill === 0) {
          runStart = i;
          runUsedRelaxed = posture.isRelaxed;
        } else if (posture.isRelaxed) {
          runUsedRelaxed = true;
        }
        consecutiveStill++;
      } else {
        if (consecutiveStill >= stillnessMinFrames) {
          const runEnd = i - 1;
          const midIdx = Math.floor((runStart + runEnd) / 2);
          const avgVel = this.averageInRange(velocities, runStart, runEnd);
          const clarity = 1 - (avgVel / stillnessVelocityThreshold);
          candidates.push({
            startIdx: runStart,
            endIdx: runEnd,
            midIdx,
            clarity,
            avgVelocity: avgVel,
            usedRelaxed: runUsedRelaxed,
            consecutiveFrames: consecutiveStill,
          });
        }
        consecutiveStill = 0;
      }
    }

    if (consecutiveStill >= stillnessMinFrames) {
      const runEnd = frameCount - 1;
      const midIdx = Math.floor((runStart + runEnd) / 2);
      const avgVel = this.averageInRange(velocities, runStart, runEnd);
      const clarity = 1 - (avgVel / stillnessVelocityThreshold);
      candidates.push({
        startIdx: runStart,
        endIdx: runEnd,
        midIdx,
        clarity,
        avgVelocity: avgVel,
        usedRelaxed: runUsedRelaxed,
        consecutiveFrames: consecutiveStill,
      });
    }

    return candidates;
  }

  private detectStationaryTimeline(
    velocities: number[],
    timeline: PoseTimeline,
    frameCount: number,
    addressCandidates: AddressCandidate[],
    warnings: string[],
    cameraView: CameraView,
  ): SwingEventResult {
    let addressEvent: SwingEvent;
    let usedRelaxed = false;

    if (addressCandidates.length > 0) {
      const best = addressCandidates[0];
      usedRelaxed = best.usedRelaxed;
      const midFrame = timeline.frames[best.midIdx];
      addressEvent = reliableEvent('ADDRESS', best.midIdx, midFrame.timestamp * 1000, best.clarity, {
        avgVelocity: best.avgVelocity,
        stillFrames: best.consecutiveFrames,
        postureValidated: true,
        relaxedPosture: best.usedRelaxed,
      });
    } else {
      addressEvent = unreliableEvent('ADDRESS');
      warnings.push('No valid golf address posture detected');
    }

    if (usedRelaxed) {
      warnings.push('Relaxed address posture criteria used: lower body landmarks not fully visible');
    }

    let finishEvent = unreliableEvent('FINISH');
    if (frameCount >= 3) {
      finishEvent = this.detectFinish(velocities, timeline, null, frameCount);
    }

    const events: SwingEvent[] = [
      addressEvent,
      unreliableEvent('TAKEAWAY'),
      unreliableEvent('MID_BACKSWING'),
      unreliableEvent('TOP'),
      unreliableEvent('MID_DOWNSWING'),
      unreliableEvent('IMPACT_PROXY'),
      unreliableEvent('MID_FOLLOW_THROUGH'),
      finishEvent,
    ];

    const detectedCount = events.filter(e => e.status === 'RELIABLE').length;
    return {
      events,
      detectedCount,
      reliableCount: detectedCount,
      temporalOrderValid: validateTemporalOrder(events),
      warnings,
    };
  }

  private detectTopBackward(
    wristHeights: number[],
    velocities: number[],
    lateralOffsets: number[],
    heelLifts: number[],
    timeline: PoseTimeline,
    peakIdx: number,
    peakVel: number,
    cameraView: CameraView = 'FO',
    addressCandidates: AddressCandidate[],
  ): SwingEvent {
    const searchStart = Math.max(0, peakIdx - 150);
    let bestTopIdx = -1;
    let bestTopScore = -Infinity;

    const refAddressHeight = addressCandidates.length > 0 && !isNaN(wristHeights[addressCandidates[0].midIdx])
      ? wristHeights[addressCandidates[0].midIdx]
      : -0.2;

    for (let j = peakIdx - 1; j >= searchStart; j--) {
      const h = wristHeights[j];
      const v = velocities[j];
      const offset = lateralOffsets[j];
      const heel = heelLifts[j];

      if (isNaN(h)) continue;

      // Disqualify frames on the lead side (FO view)
      if (!isNaN(offset) && cameraView === 'FO' && offset < -0.06) {
        continue;
      }

      // Disqualify frames with trail heel lifted into finish toe-roll
      if (!isNaN(heel) && heel > 0.08) {
        continue;
      }

      const heightScore = h;
      const trailBonus = (!isNaN(offset) && offset > 0) ? 0.25 : 0;
      const velRatio = !isNaN(v) && peakVel > 0 ? v / peakVel : 0.5;
      const velPenalty = velRatio * 0.4;
      const score = heightScore + trailBonus - velPenalty;

      if (score > bestTopScore) {
        bestTopScore = score;
        bestTopIdx = j;
      }
    }

    if (bestTopIdx === -1) {
      let maxH = -Infinity;
      for (let j = peakIdx - 1; j >= searchStart; j--) {
        const h = wristHeights[j];
        if (!isNaN(h) && h > maxH) {
          maxH = h;
          bestTopIdx = j;
        }
      }
    }

    if (bestTopIdx >= 0) {
      const topHeight = wristHeights[bestTopIdx];
      const minHeightReq = refAddressHeight + 0.08;
      if (topHeight > 0 || topHeight > minHeightReq) {
        const frame = timeline.frames[bestTopIdx];
        const confidence = Math.min(1, Math.max(0.4, (topHeight - refAddressHeight) * 3));
        return reliableEvent('TOP', bestTopIdx, frame.timestamp * 1000, confidence, {
          wristHeight: topHeight,
          frameIndex: bestTopIdx,
          isDTL: cameraView === 'DTL',
        });
      }
    }

    return unreliableEvent('TOP');
  }

  private detectTakeawayBackward(
    velocities: number[],
    directions: number[],
    wristHeights: number[],
    timeline: PoseTimeline,
    topFrame: number | null,
    addressCandidates: AddressCandidate[],
    cameraView: CameraView = 'FO',
  ): SwingEvent {
    if (topFrame === null || topFrame <= 0) {
      return unreliableEvent('TAKEAWAY');
    }

    const refAddressHeight = addressCandidates.length > 0 && !isNaN(wristHeights[addressCandidates[0].midIdx])
      ? wristHeights[addressCandidates[0].midIdx]
      : -0.2;

    const searchStart = Math.max(0, topFrame - 120);
    let takeawayIdx = -1;

    for (let k = topFrame - 1; k >= searchStart; k--) {
      const v = velocities[k];
      const h = wristHeights[k];
      const d = directions[k];

      const isNearAddressHeight = Math.abs(h - refAddressHeight) < 0.15 || h <= refAddressHeight + 0.06;
      const isSlow = !isNaN(v) && v <= Math.max(0.12, this.config.movementVelocityThreshold * 0.8);

      if (isNearAddressHeight && isSlow) {
        takeawayIdx = Math.min(topFrame - 1, k + 1);
        break;
      }

      if (!isNaN(d) && d < 0 && !isNaN(v) && v > 0.15) {
        takeawayIdx = k;
      }
    }

    if (takeawayIdx === -1) {
      takeawayIdx = Math.max(0, Math.floor(topFrame / 2));
    }

    const frame = timeline.frames[takeawayIdx];
    const v = isNaN(velocities[takeawayIdx]) ? 0.3 : velocities[takeawayIdx];
    const confidence = Math.min(1, Math.max(0.3, v / (this.config.movementVelocityThreshold * 2)));

    return reliableEvent('TAKEAWAY', takeawayIdx, frame.timestamp * 1000, confidence, {
      velocity: v,
      direction: isNaN(directions[takeawayIdx]) ? -1 : directions[takeawayIdx],
      isAwayFromTarget: true,
      isDTL: cameraView === 'DTL',
    });
  }

  private detectAddressPrecedingTakeaway(
    addressCandidates: AddressCandidate[],
    timeline: PoseTimeline,
    takeawayIdx: number | null,
    warnings: string[],
  ): { event: SwingEvent; usedRelaxed: boolean } {
    if (addressCandidates.length === 0) {
      warnings.push('No valid golf address posture detected');
      return { event: unreliableEvent('ADDRESS'), usedRelaxed: false };
    }

    let bestCand = addressCandidates[0];
    let minGap = Infinity;

    for (const cand of addressCandidates) {
      if (takeawayIdx !== null && cand.endIdx <= takeawayIdx) {
        const gap = takeawayIdx - cand.endIdx;
        if (gap < minGap) {
          minGap = gap;
          bestCand = cand;
        }
      }
    }

    if (bestCand.usedRelaxed) {
      warnings.push('Relaxed address posture criteria used: lower body landmarks not fully visible');
    }

    const midFrame = timeline.frames[bestCand.midIdx];
    return {
      event: reliableEvent('ADDRESS', bestCand.midIdx, midFrame.timestamp * 1000, bestCand.clarity, {
        avgVelocity: bestCand.avgVelocity,
        stillFrames: bestCand.consecutiveFrames,
        postureValidated: true,
        relaxedPosture: bestCand.usedRelaxed,
      }),
      usedRelaxed: bestCand.usedRelaxed,
    };
  }

  private detectImpactProxyAroundPeak(
    wristHeights: number[],
    velocities: number[],
    timeline: PoseTimeline,
    topFrame: number | null,
    peakIdx: number,
    peakVel: number,
    frameCount: number,
    addressEvent: SwingEvent,
  ): SwingEvent {
    const addressWristHeight = addressEvent.frameIndex !== null && !isNaN(wristHeights[addressEvent.frameIndex])
      ? wristHeights[addressEvent.frameIndex]
      : -0.2;

    const startSearch = topFrame !== null ? topFrame + 1 : Math.max(0, peakIdx - 5);
    const endSearch = Math.min(frameCount - 1, peakIdx + 15);

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = startSearch; i <= endSearch; i++) {
      const h = wristHeights[i];
      const v = velocities[i];
      if (isNaN(h) || isNaN(v)) continue;

      const heightMatch = Math.abs(h - addressWristHeight);
      const maxTol = 0.25;
      if (heightMatch > maxTol) continue;

      const heightScore = 1 - (heightMatch / maxTol);
      const velocityScore = peakVel > 0 ? v / peakVel : 0;
      const score = heightScore * 0.4 + velocityScore * 0.6;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx === -1 && peakIdx > (topFrame ?? 0)) {
      bestIdx = peakIdx;
      bestScore = 0.7;
    }

    if (bestIdx >= 0) {
      const frame = timeline.frames[bestIdx];
      const confidence = Math.min(1, Math.max(0.4, bestScore));
      return reliableEvent('IMPACT_PROXY', bestIdx, frame.timestamp * 1000, confidence, {
        wristHeight: wristHeights[bestIdx],
        addressWristHeight,
        velocity: velocities[bestIdx],
        heightMatch: Math.abs(wristHeights[bestIdx] - addressWristHeight),
      });
    }

    return unreliableEvent('IMPACT_PROXY');
  }

  private detectFinishForward(
    velocities: number[],
    lateralOffsets: number[],
    heelLifts: number[],
    wristHeights: number[],
    timeline: PoseTimeline,
    impactFrame: number | null,
    frameCount: number,
    cameraView: CameraView = 'FO',
    addressEvent: SwingEvent,
  ): SwingEvent {
    const { stillnessVelocityThreshold, stillnessMinFrames } = this.config;
    const startSearch = impactFrame !== null ? impactFrame + 1 : Math.floor(frameCount / 2);
    const addressWristHeight = addressEvent.frameIndex !== null && !isNaN(wristHeights[addressEvent.frameIndex])
      ? wristHeights[addressEvent.frameIndex]
      : -0.2;

    let consecutiveStill = 0;
    let runStart = 0;
    let bestFinishIdx = -1;
    let finishClarity = 0.8;
    let finishStillFrames = 0;
    let finishAvgVel = 0;

    for (let i = startSearch; i < frameCount; i++) {
      const v = velocities[i];
      const offset = lateralOffsets[i];
      const heel = heelLifts[i];
      const h = wristHeights[i];

      if (!isNaN(v) && v <= stillnessVelocityThreshold) {
        if (consecutiveStill === 0) runStart = i;
        consecutiveStill++;

        if (consecutiveStill >= stillnessMinFrames) {
          const midIdx = Math.floor((runStart + i) / 2);
          const avgVel = this.averageInRange(velocities, runStart, i);
          const clarity = 1 - (avgVel / stillnessVelocityThreshold);

          // In FO view: verify finish posture (hands on lead side, heel lifted, or wrists above address)
          const isLeadSide = isNaN(offset) || cameraView !== 'FO' || offset < 0.08;
          const isHeelLifted = !isNaN(heel) && heel > 0.03;
          const isWristsHigh = !isNaN(h) && h > addressWristHeight + 0.05;

          if (isLeadSide || isHeelLifted || isWristsHigh) {
            bestFinishIdx = midIdx;
            finishClarity = clarity;
            finishStillFrames = consecutiveStill;
            finishAvgVel = avgVel;
            break;
          }
        }
      } else {
        consecutiveStill = 0;
      }
    }

    if (bestFinishIdx === -1) {
      consecutiveStill = 0;
      for (let i = startSearch; i < frameCount; i++) {
        const v = velocities[i];
        if (!isNaN(v) && v <= stillnessVelocityThreshold) {
          if (consecutiveStill === 0) runStart = i;
          consecutiveStill++;
          if (consecutiveStill >= stillnessMinFrames) {
            bestFinishIdx = Math.floor((runStart + i) / 2);
            finishAvgVel = this.averageInRange(velocities, runStart, i);
            finishClarity = 1 - (finishAvgVel / stillnessVelocityThreshold);
            finishStillFrames = consecutiveStill;
            break;
          }
        } else {
          consecutiveStill = 0;
        }
      }
    }

    if (bestFinishIdx >= 0) {
      const frame = timeline.frames[bestFinishIdx];
      return reliableEvent('FINISH', bestFinishIdx, frame.timestamp * 1000, finishClarity, {
        avgVelocity: finishAvgVel,
        stillFrames: finishStillFrames,
      });
    }

    return unreliableEvent('FINISH');
  }

  // ─── MID_BACKSWING Detection ────────────────────────────────────

  /**
   * MID_BACKSWING: Frame between TAKEAWAY and TOP where wrist height reaches
   * approximately half of its maximum (at TOP) during the backswing.
   */
  private detectMidBackswing(
    wristHeights: number[],
    timeline: PoseTimeline,
    takeawayFrame: number | null,
    topFrame: number | null,
  ): SwingEvent {
    if (takeawayFrame === null || topFrame === null || topFrame <= takeawayFrame) {
      return unreliableEvent('MID_BACKSWING');
    }

    const topHeight = wristHeights[topFrame];
    if (isNaN(topHeight)) return unreliableEvent('MID_BACKSWING');

    // Find the starting height (at takeaway)
    const takeawayHeight = isNaN(wristHeights[takeawayFrame]) ? 0 : wristHeights[takeawayFrame];
    const midTarget = (takeawayHeight + topHeight) / 2;

    let bestIdx = -1;
    let bestDiff = Infinity;

    for (let i = takeawayFrame; i <= topFrame; i++) {
      const h = wristHeights[i];
      if (isNaN(h)) continue;
      const diff = Math.abs(h - midTarget);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const frame = timeline.frames[bestIdx];
      const confidence = bestDiff < 0.05 ? 0.9 : bestDiff < 0.1 ? 0.7 : 0.5;
      return reliableEvent('MID_BACKSWING', bestIdx, frame.timestamp * 1000, confidence, {
        wristHeight: wristHeights[bestIdx],
        targetHeight: midTarget,
        deviation: bestDiff,
      });
    }

    return unreliableEvent('MID_BACKSWING');
  }

  // ─── IMPACT_PROXY Detection ─────────────────────────────────────

  /**
   * IMPACT_PROXY: Frame after TOP where wrist height returns to approximately
   * the ADDRESS wrist height AND hand velocity is near peak.
   */
  private detectImpactProxy(
    wristHeights: number[],
    velocities: number[],
    timeline: PoseTimeline,
    topFrame: number | null,
    frameCount: number,
    addressEvent: SwingEvent,
  ): SwingEvent {
    if (topFrame === null) return unreliableEvent('IMPACT_PROXY');

    // Get address wrist height as reference
    const addressIdx = addressEvent.frameIndex;
    const addressWristHeight = addressIdx !== null && !isNaN(wristHeights[addressIdx])
      ? wristHeights[addressIdx]
      : 0;

    const { wristHeightTolerance } = this.config;

    // Find peak velocity after TOP to scale our search
    let peakVelocity = 0;
    for (let i = topFrame + 1; i < frameCount; i++) {
      const v = velocities[i];
      if (!isNaN(v) && v > peakVelocity) peakVelocity = v;
    }

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = topFrame + 1; i < frameCount; i++) {
      const h = wristHeights[i];
      const v = velocities[i];
      if (isNaN(h) || isNaN(v)) continue;

      const heightMatch = Math.abs(h - addressWristHeight);
      const maxTolerance = Math.max(0.20, wristHeightTolerance * 4);
      if (heightMatch > maxTolerance) continue; // too far from address height

      // Score: higher velocity + closer to address height = better (velocity is primary)
      const heightScore = 1 - (heightMatch / maxTolerance);
      const velocityScore = peakVelocity > 0 ? v / peakVelocity : 0;
      const score = heightScore * 0.4 + velocityScore * 0.6;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const frame = timeline.frames[bestIdx];
      const confidence = Math.min(1, Math.max(0, bestScore));
      return reliableEvent('IMPACT_PROXY', bestIdx, frame.timestamp * 1000, confidence, {
        wristHeight: wristHeights[bestIdx],
        addressWristHeight,
        velocity: velocities[bestIdx],
        heightMatch: Math.abs(wristHeights[bestIdx] - addressWristHeight),
      });
    }

    return unreliableEvent('IMPACT_PROXY');
  }

  // ─── MID_DOWNSWING Detection ────────────────────────────────────

  /**
   * MID_DOWNSWING: Frame between TOP and IMPACT_PROXY where hand velocity
   * reaches approximately half of its maximum downswing velocity.
   */
  private detectMidDownswing(
    velocities: number[],
    timeline: PoseTimeline,
    topFrame: number | null,
    impactFrame: number | null,
  ): SwingEvent {
    if (topFrame === null || impactFrame === null || impactFrame <= topFrame) {
      return unreliableEvent('MID_DOWNSWING');
    }

    // Find peak velocity in this range
    let peakVel = 0;
    for (let i = topFrame + 1; i <= impactFrame; i++) {
      const v = velocities[i];
      if (!isNaN(v) && v > peakVel) peakVel = v;
    }

    if (peakVel === 0) return unreliableEvent('MID_DOWNSWING');

    const halfPeak = peakVel / 2;
    let bestIdx = -1;
    let bestDiff = Infinity;

    for (let i = topFrame + 1; i <= impactFrame; i++) {
      const v = velocities[i];
      if (isNaN(v)) continue;
      const diff = Math.abs(v - halfPeak);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const frame = timeline.frames[bestIdx];
      const confidence = bestDiff < peakVel * 0.1 ? 0.9 : bestDiff < peakVel * 0.3 ? 0.7 : 0.5;
      return reliableEvent('MID_DOWNSWING', bestIdx, frame.timestamp * 1000, confidence, {
        velocity: velocities[bestIdx],
        halfPeakTarget: halfPeak,
        peakVelocity: peakVel,
      });
    }

    return unreliableEvent('MID_DOWNSWING');
  }

  // ─── MID_FOLLOW_THROUGH Detection ──────────────────────────────

  /**
   * MID_FOLLOW_THROUGH: Frame after IMPACT_PROXY where hand velocity
   * has decelerated to approximately half of its peak velocity.
   */
  private detectMidFollowThrough(
    velocities: number[],
    timeline: PoseTimeline,
    impactFrame: number | null,
    frameCount: number,
  ): SwingEvent {
    if (impactFrame === null) return unreliableEvent('MID_FOLLOW_THROUGH');

    // Find peak velocity around impact
    let peakVel = 0;
    const searchStart = Math.max(0, impactFrame - 3);
    const searchEnd = Math.min(frameCount - 1, impactFrame + 3);
    for (let i = searchStart; i <= searchEnd; i++) {
      const v = velocities[i];
      if (!isNaN(v) && v > peakVel) peakVel = v;
    }

    if (peakVel === 0) return unreliableEvent('MID_FOLLOW_THROUGH');

    const halfPeak = peakVel / 2;
    let bestIdx = -1;
    let bestDiff = Infinity;

    // Search after impact for deceleration to half-peak
    for (let i = impactFrame + 1; i < frameCount; i++) {
      const v = velocities[i];
      if (isNaN(v)) continue;

      // We want the first frame where velocity drops to near half-peak
      const diff = Math.abs(v - halfPeak);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const frame = timeline.frames[bestIdx];
      const confidence = bestDiff < peakVel * 0.1 ? 0.9 : bestDiff < peakVel * 0.3 ? 0.7 : 0.5;
      return reliableEvent('MID_FOLLOW_THROUGH', bestIdx, frame.timestamp * 1000, confidence, {
        velocity: velocities[bestIdx],
        halfPeakTarget: halfPeak,
        peakVelocity: peakVel,
      });
    }

    return unreliableEvent('MID_FOLLOW_THROUGH');
  }

  // ─── FINISH Detection ───────────────────────────────────────────

  /**
   * FINISH: Frame where hand velocity drops below the stillness threshold
   * again after the swing (searching backward from end of timeline).
   */
  private detectFinish(
    velocities: number[],
    timeline: PoseTimeline,
    impactFrame: number | null,
    frameCount: number,
  ): SwingEvent {
    const { stillnessVelocityThreshold, stillnessMinFrames } = this.config;
    const startSearch = impactFrame !== null ? impactFrame + 1 : Math.floor(frameCount / 2);

    // Search forward from impact for a stillness run
    let consecutiveStill = 0;
    let runStart = 0;

    for (let i = startSearch; i < frameCount; i++) {
      const v = velocities[i];
      if (!isNaN(v) && v <= stillnessVelocityThreshold) {
        if (consecutiveStill === 0) runStart = i;
        consecutiveStill++;
        if (consecutiveStill >= stillnessMinFrames) {
          const midIdx = Math.floor((runStart + i) / 2);
          const frame = timeline.frames[midIdx];
          const avgVel = this.averageInRange(velocities, runStart, i);
          const clarity = 1 - (avgVel / stillnessVelocityThreshold);
          return reliableEvent('FINISH', midIdx, frame.timestamp * 1000, clarity, {
            avgVelocity: avgVel,
            stillFrames: consecutiveStill,
          });
        }
      } else {
        consecutiveStill = 0;
      }
    }

    return unreliableEvent('FINISH');
  }

  // ─── Utilities ──────────────────────────────────────────────────

  /** Average of non-NaN values in a range [start, end] inclusive. */
  private averageInRange(arr: number[], start: number, end: number): number {
    let sum = 0;
    let count = 0;
    for (let i = start; i <= end; i++) {
      if (!isNaN(arr[i])) {
        sum += arr[i];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }
}
