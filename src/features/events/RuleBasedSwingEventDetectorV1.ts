/**
 * RuleBasedSwingEventDetectorV1.ts
 * SwingSwang – Swing Event Detection
 *
 * Rule-based temporal state machine that detects 8 swing events
 * from a PoseTimeline. All thresholds are PROVISIONAL — will be
 * tuned after real pose data.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';
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
} from './signalExtractors';

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
  stillnessVelocityThreshold: 0.005,
  movementVelocityThreshold: 0.01,
  stillnessMinFrames: 3,
  directionChangeMinDelta: 0.003,
  wristHeightTolerance: 0.03,
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

    // Extract signals
    const velocities = extractHandVelocity(timeline);
    const directions = extractHandDirection(timeline, swingConfig.handedness);
    const wristHeights = extractWristHeight(timeline);
    const handCenters = extractHandCenter(timeline);

    const frameCount = timeline.frames.length;

    // Detect each event
    const addressResult = this.detectAddress(velocities, timeline, frameCount);
    const takeawayResult = this.detectTakeaway(velocities, directions, timeline, addressResult.frameIndex, frameCount);
    const topResult = this.detectTop(wristHeights, directions, timeline, takeawayResult.frameIndex, frameCount);
    const midBackswingResult = this.detectMidBackswing(wristHeights, timeline, takeawayResult.frameIndex, topResult.frameIndex);
    const impactResult = this.detectImpactProxy(wristHeights, velocities, timeline, topResult.frameIndex, frameCount, addressResult);
    const midDownswingResult = this.detectMidDownswing(velocities, timeline, topResult.frameIndex, impactResult.frameIndex);
    const midFollowThroughResult = this.detectMidFollowThrough(velocities, timeline, impactResult.frameIndex, frameCount);
    const finishResult = this.detectFinish(velocities, timeline, impactResult.frameIndex, frameCount);

    // Build the events array in canonical order
    const events: SwingEvent[] = [
      addressResult,
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
   * ADDRESS: First run of N consecutive frames where hand velocity
   * is below the stillness threshold. Picks the middle frame of the run.
   */
  private detectAddress(
    velocities: number[],
    timeline: PoseTimeline,
    frameCount: number,
  ): SwingEvent {
    const { stillnessVelocityThreshold, stillnessMinFrames } = this.config;
    let consecutiveStill = 0;
    let runStart = 0;

    for (let i = 0; i < frameCount; i++) {
      const v = velocities[i];
      if (!isNaN(v) && v <= stillnessVelocityThreshold) {
        if (consecutiveStill === 0) runStart = i;
        consecutiveStill++;
        if (consecutiveStill >= stillnessMinFrames) {
          const midIdx = Math.floor((runStart + i) / 2);
          const frame = timeline.frames[midIdx];
          const avgVel = this.averageInRange(velocities, runStart, i);
          const clarity = 1 - (avgVel / stillnessVelocityThreshold);
          return reliableEvent('ADDRESS', midIdx, frame.timestamp * 1000, Math.max(0.5, clarity), {
            avgVelocity: avgVel,
            stillFrames: consecutiveStill,
          });
        }
      } else {
        consecutiveStill = 0;
      }
    }

    // If the timeline is a single frame or very short, allow it as address
    if (frameCount === 1) {
      const v = velocities[0];
      if (!isNaN(v) && v <= stillnessVelocityThreshold) {
        return reliableEvent('ADDRESS', 0, timeline.frames[0].timestamp * 1000, 0.5, {
          avgVelocity: v,
          stillFrames: 1,
        });
      }
    }

    return unreliableEvent('ADDRESS');
  }

  // ─── TAKEAWAY Detection ─────────────────────────────────────────

  /**
   * TAKEAWAY: First frame after ADDRESS where hand velocity exceeds the
   * movement threshold AND hand direction is away from target (negative).
   */
  private detectTakeaway(
    velocities: number[],
    directions: number[],
    timeline: PoseTimeline,
    addressFrame: number | null,
    frameCount: number,
  ): SwingEvent {
    const { movementVelocityThreshold } = this.config;
    const startSearch = addressFrame !== null ? addressFrame + 1 : 0;

    for (let i = startSearch; i < frameCount; i++) {
      const v = velocities[i];
      const d = directions[i];

      if (!isNaN(v) && !isNaN(d) && v > movementVelocityThreshold && d < 0) {
        const frame = timeline.frames[i];
        const confidence = Math.min(1, v / (movementVelocityThreshold * 3));
        return reliableEvent('TAKEAWAY', i, frame.timestamp * 1000, Math.max(0.5, confidence), {
          velocity: v,
          direction: d,
          isAwayFromTarget: true,
        });
      }
    }

    return unreliableEvent('TAKEAWAY');
  }

  // ─── TOP Detection ──────────────────────────────────────────────

  /**
   * TOP: Frame where wrist height reaches its maximum (most positive value =
   * highest above shoulders) after takeaway. This approximates the top
   * of the backswing where direction reverses.
   */
  private detectTop(
    wristHeights: number[],
    directions: number[],
    timeline: PoseTimeline,
    takeawayFrame: number | null,
    frameCount: number,
  ): SwingEvent {
    const startSearch = takeawayFrame !== null ? takeawayFrame + 1 : 0;

    // Find the frame with maximum wrist height between takeaway and end
    let maxHeight = -Infinity;
    let maxIdx = -1;

    for (let i = startSearch; i < frameCount; i++) {
      const h = wristHeights[i];
      if (!isNaN(h) && h > maxHeight) {
        maxHeight = h;
        maxIdx = i;
      }
    }

    if (maxIdx >= 0 && maxHeight > 0) {
      const frame = timeline.frames[maxIdx];
      // Confidence based on how clearly the peak stands out
      const confidence = Math.min(1, maxHeight * 5); // scale by peak magnitude
      return reliableEvent('TOP', maxIdx, frame.timestamp * 1000, Math.max(0.5, confidence), {
        wristHeight: maxHeight,
        frameIndex: maxIdx,
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
      if (heightMatch > wristHeightTolerance * 3) continue; // too far from address height

      // Score: higher velocity + closer to address height = better
      const heightScore = 1 - (heightMatch / (wristHeightTolerance * 3));
      const velocityScore = peakVelocity > 0 ? v / peakVelocity : 0;
      const score = heightScore * 0.5 + velocityScore * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const frame = timeline.frames[bestIdx];
      const confidence = Math.max(0.5, Math.min(1, bestScore));
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
          return reliableEvent('FINISH', midIdx, frame.timestamp * 1000, Math.max(0.5, clarity), {
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
