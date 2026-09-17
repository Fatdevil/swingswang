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
    const handCenters = extractHandCenter(timeline);

    const frameCount = timeline.frames.length;

    // Detect each event
    const addressResult = this.detectAddress(velocities, wristHeights, timeline, frameCount, cameraView);
    if (addressResult.usedRelaxed) {
      warnings.push('Relaxed address posture criteria used: lower body landmarks not fully visible');
    }
    if (addressResult.event.status !== 'RELIABLE') {
      warnings.push('No valid golf address posture detected');
    }

    const takeawayResult = this.detectTakeaway(
      velocities,
      directions,
      timeline,
      addressResult.event.frameIndex,
      frameCount,
      cameraView,
    );
    const addressWristHeight =
      addressResult.event.frameIndex !== null && !isNaN(wristHeights[addressResult.event.frameIndex])
        ? wristHeights[addressResult.event.frameIndex]
        : -0.2;
    const topResult = this.detectTop(
      wristHeights,
      directions,
      timeline,
      takeawayResult.frameIndex,
      frameCount,
      cameraView,
      addressWristHeight,
    );
    const midBackswingResult = this.detectMidBackswing(wristHeights, timeline, takeawayResult.frameIndex, topResult.frameIndex);
    const impactResult = this.detectImpactProxy(wristHeights, velocities, timeline, topResult.frameIndex, frameCount, addressResult.event);
    const midDownswingResult = this.detectMidDownswing(velocities, timeline, topResult.frameIndex, impactResult.frameIndex);
    const midFollowThroughResult = this.detectMidFollowThrough(velocities, timeline, impactResult.frameIndex, frameCount);
    const finishResult = this.detectFinish(velocities, timeline, impactResult.frameIndex, frameCount);

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

    // Validate temporal order
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

  // ─── ADDRESS Detection ──────────────────────────────────────────

  /**
   * ADDRESS: Run of consecutive frames where hand velocity is below stillness threshold
   * AND body posture matches golf setup. When multiple stillness runs are found (e.g. in long
   * untrimmed video), selects the candidate that immediately precedes the actual swing.
   */
  private detectAddress(
    velocities: number[],
    wristHeights: number[],
    timeline: PoseTimeline,
    frameCount: number,
    cameraView: CameraView = 'FO',
  ): { event: SwingEvent; usedRelaxed: boolean } {
    const { stillnessVelocityThreshold, stillnessMinFrames, movementVelocityThreshold } = this.config;
    let consecutiveStill = 0;
    let runStart = 0;
    let runUsedRelaxed = false;

    const candidates: Array<{
      startIdx: number;
      endIdx: number;
      midIdx: number;
      clarity: number;
      avgVelocity: number;
      usedRelaxed: boolean;
      consecutiveFrames: number;
    }> = [];

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

    if (candidates.length > 0) {
      let bestCandidate = candidates[0];

      // If multiple candidates exist, find the one that is followed by the actual swing!
      if (candidates.length > 1) {
        let bestSwingScore = -1;
        const fps = timeline.analyzedFPS > 0 ? timeline.analyzedFPS : 30;
        const windowLookahead = Math.round(fps * 2.5); // look up to 2.5s ahead

        for (const cand of candidates) {
          let swingScore = 0;
          const searchLimit = Math.min(frameCount, cand.endIdx + windowLookahead);

          for (let j = cand.endIdx + 1; j < searchLimit; j++) {
            const v = velocities[j];
            const h = wristHeights[j];
            if (!isNaN(v) && v > movementVelocityThreshold) {
              swingScore += v;
            }
            if (!isNaN(h) && h > 0) {
              swingScore += 2;
            }
          }

          if (swingScore > bestSwingScore) {
            bestSwingScore = swingScore;
            bestCandidate = cand;
          }
        }
      }

      const midFrame = timeline.frames[bestCandidate.midIdx];
      return {
        event: reliableEvent('ADDRESS', bestCandidate.midIdx, midFrame.timestamp * 1000, bestCandidate.clarity, {
          avgVelocity: bestCandidate.avgVelocity,
          stillFrames: bestCandidate.consecutiveFrames,
          postureValidated: true,
          relaxedPosture: bestCandidate.usedRelaxed,
        }),
        usedRelaxed: bestCandidate.usedRelaxed,
      };
    }

    // Single frame fallback
    if (frameCount === 1) {
      const v = velocities[0];
      const posture = checkAddressPosture(timeline.frames[0], cameraView);
      if (!isNaN(v) && v <= stillnessVelocityThreshold && posture.isValid) {
        const clarity = 1 - (v / stillnessVelocityThreshold);
        return {
          event: reliableEvent('ADDRESS', 0, timeline.frames[0].timestamp * 1000, clarity, {
            avgVelocity: v,
            stillFrames: 1,
            postureValidated: true,
            relaxedPosture: posture.isRelaxed,
          }),
          usedRelaxed: posture.isRelaxed,
        };
      }
    }

    return {
      event: unreliableEvent('ADDRESS'),
      usedRelaxed: false,
    };
  }

  // ─── TAKEAWAY Detection ─────────────────────────────────────────

  /**
   * TAKEAWAY: First frame after ADDRESS where hand velocity exceeds the
   * movement threshold AND hand direction is away from target / into backswing.
   */
  private detectTakeaway(
    velocities: number[],
    directions: number[],
    timeline: PoseTimeline,
    addressFrame: number | null,
    frameCount: number,
    cameraView: CameraView = 'FO',
  ): SwingEvent {
    if (addressFrame === null) {
      return unreliableEvent('TAKEAWAY');
    }

    const { movementVelocityThreshold } = this.config;
    const startSearch = addressFrame + 1;

    for (let i = startSearch; i < frameCount; i++) {
      const v = velocities[i];
      const d = directions[i];

      if (!isNaN(v) && !isNaN(d) && v > movementVelocityThreshold && d < 0) {
        const frame = timeline.frames[i];
        const confidence = Math.min(1, v / (movementVelocityThreshold * 3));
        return reliableEvent('TAKEAWAY', i, frame.timestamp * 1000, confidence, {
          velocity: v,
          direction: d,
          isAwayFromTarget: true,
          isDTL: cameraView === 'DTL',
        });
      }
    }

    return unreliableEvent('TAKEAWAY');
  }

  // ─── TOP Detection ──────────────────────────────────────────────

  /**
   * TOP: Frame where wrist height reaches its maximum after takeaway.
   * This approximates the top of the backswing where direction reverses.
   */
  private detectTop(
    wristHeights: number[],
    directions: number[],
    timeline: PoseTimeline,
    takeawayFrame: number | null,
    frameCount: number,
    cameraView: CameraView = 'FO',
    addressWristHeight: number = -0.2,
  ): SwingEvent {
    if (takeawayFrame === null) {
      return unreliableEvent('TOP');
    }

    const startSearch = takeawayFrame + 1;
    const { directionChangeMinDelta } = this.config;

    // Find the frame with maximum wrist height between takeaway and end
    let maxHeight = -Infinity;
    let maxIdx = -1;
    let downswingFrames = 0;

    for (let i = startSearch; i < frameCount; i++) {
      const h = wristHeights[i];
      const d = directions[i];

      if (!isNaN(h) && h > maxHeight) {
        maxHeight = h;
        maxIdx = i;
        downswingFrames = 0; // Reset if we found a new high
      }

      // If we have a peak and hand is moving positively (downswing)
      if (!isNaN(d) && maxIdx !== -1) {
        if (d > directionChangeMinDelta) {
          downswingFrames++;
          if (downswingFrames > 3) {
            // Definitively in downswing, stop searching to avoid matching a high finish
            break;
          }
        } else if (d <= 0) {
          // Hand stopped moving towards target or moved away again
          downswingFrames = 0;
        }
      }
    }

    // Top is valid if hands are above shoulders (maxHeight > 0) OR significantly above address position
    const minHeightRequired = addressWristHeight + 0.10;
    if (maxIdx >= 0 && (maxHeight > 0 || maxHeight > minHeightRequired)) {
      const frame = timeline.frames[maxIdx];
      const confidence = Math.min(1, Math.max(0.4, (maxHeight - addressWristHeight) * 3));
      return reliableEvent('TOP', maxIdx, frame.timestamp * 1000, confidence, {
        wristHeight: maxHeight,
        frameIndex: maxIdx,
        isDTL: cameraView === 'DTL',
      });
    }

    return unreliableEvent('TOP');
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
