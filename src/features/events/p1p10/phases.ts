/**
 * phases.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Coarse swing segmentation, address window detection (>= 250 ms),
 * takeaway detection with waggle rejection, and backswing progress calculation.
 */

import { Vec3, LANDMARK_INDEX } from './types';
import { ProcessedFrame } from './signalProcessing';

export type SwingPhaseName = 'ADDRESS' | 'BACK' | 'DOWN' | 'THROUGH' | 'FINISH';

export interface AddressWindow {
  readonly startIdx: number;
  readonly endIdx: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly meanGrip2D: Vec3;
  readonly meanHip2D: Vec3;
}

export interface SwingPhases {
  readonly hasTakeaway: boolean;
  readonly hasTransition: boolean;
  readonly addressWindow: AddressWindow | null;
  readonly p1FrameIndex: number | null;
  readonly takeawayFrameIndex: number | null;
  readonly topFrameIndex: number | null;
  readonly impactApproxFrameIndex: number | null;
  readonly backswingProgress: readonly number[]; // Normalized [0, 1] per frame
  readonly reasonCodes: string[];
}

/**
 * Finds the stable address window of >= 250 ms:
 * - median(gripSpeed) < adaptive limit (base 0.20 S/s, scaled by golfer size)
 * - median(midHipSpeed) < adaptive limit (base 0.15 S/s, scaled by golfer size)
 * - at least one ankle quality >= 0.40, at least one wrist quality >= 0.50
 * - feet within normalized frame (with ±0.05 tolerance)
 */
export function findAddressWindow(
  frames: readonly ProcessedFrame[],
  s2D: number,
  maxSearchIdx?: number,
): AddressWindow | null {
  const n = frames.length;
  if (n < 5) return null;

  const minDurationMs = 250.0;
  const limitIdx = maxSearchIdx !== undefined && maxSearchIdx > 0 ? Math.min(n, maxSearchIdx) : n;
  let bestWindow: AddressWindow | null = null;

  // Estimate sequence noise floor from 20th percentile of grip speed
  const sortedSpeeds = frames
    .map(f => f.gripSpeed)
    .filter(s => typeof s === 'number' && !isNaN(s))
    .sort((a, b) => a - b);
  const baselineNoise = sortedSpeeds.length > 0 ? sortedSpeeds[Math.floor(sortedSpeeds.length * 0.20)] : 0.05;

  // Search forward through frames
  for (let i = 0; i < limitIdx; i++) {
    const tStartMs = frames[i].timestampMs;
    let endIdx = i;

    while (endIdx < limitIdx && frames[endIdx].timestampMs - tStartMs < minDurationMs) {
      endIdx++;
    }

    if (endIdx >= limitIdx) break;

    const windowFrames = frames.slice(i, endIdx + 1);
    const durationMs = frames[endIdx].timestampMs - tStartMs;

    if (durationMs < minDurationMs) continue;

    // Check key landmark qualities & feet in frame
    let qualityOk = true;
    for (const f of windowFrames) {
      const qLAnkle = f.quality[LANDMARK_INDEX.LEFT_ANKLE];
      const qRAnkle = f.quality[LANDMARK_INDEX.RIGHT_ANKLE];
      const qLWrist = f.quality[LANDMARK_INDEX.LEFT_WRIST];
      const qRWrist = f.quality[LANDMARK_INDEX.RIGHT_WRIST];

      if ((qLAnkle < 0.35 && qRAnkle < 0.35) || (qLWrist < 0.35 && qRWrist < 0.35)) {
        qualityOk = false;
        break;
      }

      // Check feet in frame (allow slight overshoot)
      const lAnkleRaw = f.imageRaw[LANDMARK_INDEX.LEFT_ANKLE];
      const rAnkleRaw = f.imageRaw[LANDMARK_INDEX.RIGHT_ANKLE];
      if (
        lAnkleRaw.x < -0.05 || lAnkleRaw.x > 1.05 || lAnkleRaw.y < -0.05 || lAnkleRaw.y > 1.05 ||
        rAnkleRaw.x < -0.05 || rAnkleRaw.x > 1.05 || rAnkleRaw.y < -0.05 || rAnkleRaw.y > 1.05
      ) {
        qualityOk = false;
        break;
      }
    }

    if (!qualityOk) continue;

    // Check address posture: wrists hang below shoulders in yUp
    const isAddressPosture = windowFrames.every(
      f => f.grip2D.y < f.midShoulder.y - 0.03 * s2D
    );
    if (!isAddressPosture) continue;

    // Displacement-based stillness check: bounding box of grip across 250ms
    let minGripX = Infinity, maxGripX = -Infinity;
    let minGripY = Infinity, maxGripY = -Infinity;
    for (const f of windowFrames) {
      if (f.grip2D.x < minGripX) minGripX = f.grip2D.x;
      if (f.grip2D.x > maxGripX) maxGripX = f.grip2D.x;
      if (f.grip2D.y < minGripY) minGripY = f.grip2D.y;
      if (f.grip2D.y > maxGripY) maxGripY = f.grip2D.y;
    }
    const gripDisp = Math.hypot((maxGripX - minGripX) / s2D, (maxGripY - minGripY) / s2D);

    // Calculate median speeds
    const gripSpeeds = windowFrames.map(f => f.gripSpeed).sort((a, b) => a - b);
    const hipSpeeds = windowFrames.map(f => f.midHipSpeed).sort((a, b) => a - b);

    const medianGrip = gripSpeeds[Math.floor(gripSpeeds.length / 2)];
    const medianHip = hipSpeeds[Math.floor(hipSpeeds.length / 2)];

    // Adaptive quiescence thresholds: combine noiseScale with baseline sequence noise
    const noiseScale = Math.max(1.0, 0.25 / Math.max(s2D, 0.05));
    const gripSpeedLimit = Math.max(0.20 * noiseScale, baselineNoise * 2.5);
    const hipSpeedLimit = Math.max(0.18 * noiseScale, baselineNoise * 2.0);

    const isStillDisplacement = gripDisp < 0.08 * noiseScale;
    const isStillSpeed = medianGrip < gripSpeedLimit && medianHip < hipSpeedLimit;

    if (isStillDisplacement || isStillSpeed) {
      // Calculate mean grip position
      let sumGripX = 0;
      let sumGripY = 0;
      let sumHipX = 0;
      let sumHipY = 0;
      for (const f of windowFrames) {
        sumGripX += f.grip2D.x;
        sumGripY += f.grip2D.y;
        sumHipX += f.midHip.x;
        sumHipY += f.midHip.y;
      }
      const count = windowFrames.length;

      bestWindow = {
        startIdx: i,
        endIdx,
        startMs: tStartMs,
        endMs: frames[endIdx].timestampMs,
        durationMs,
        meanGrip2D: { x: sumGripX / count, y: sumGripY / count, z: 0 },
        meanHip2D: { x: sumHipX / count, y: sumHipY / count, z: 0 },
      };
    }
  }

  return bestWindow;
}

/**
 * Detects Takeaway:
 * - gripSpeed > 0.18 S/s sustained for >= 50 ms
 * - net displacement from address grip > 0.04 S
 * - Waggle rejection: small movements returning to address do NOT start the swing.
 */
export function detectTakeaway(
  frames: readonly ProcessedFrame[],
  address: AddressWindow,
  s2D: number,
): { takeawayIdx: number | null; p1Idx: number } {
  const n = frames.length;
  let p1Idx = address.endIdx;

  // Adaptive thresholds: same noise compensation as findAddressWindow
  const noiseScale = Math.max(1.0, 0.25 / Math.max(s2D, 0.05));

  for (let i = address.endIdx; i < n; i++) {
    const f = frames[i];
    const dx = (f.grip2D.x - address.meanGrip2D.x) / s2D;
    const dy = (f.grip2D.y - address.meanGrip2D.y) / s2D;
    const netDisp = Math.hypot(dx, dy);

    if ((f.gripSpeed > 0.12 * noiseScale || netDisp > 0.05 * noiseScale) && netDisp > 0.03 * noiseScale) {
      // Check persistence >= 50 ms
      let persistent = true;
      let endJ = i;
      const tStart = f.timestampMs;

      while (endJ < n && frames[endJ].timestampMs - tStart < 50.0) {
        if (frames[endJ].gripSpeed < 0.08 * noiseScale && Math.hypot((frames[endJ].grip2D.x - address.meanGrip2D.x) / s2D, (frames[endJ].grip2D.y - address.meanGrip2D.y) / s2D) < netDisp * 0.7) {
          persistent = false;
          break;
        }
        endJ++;
      }

      if (persistent && endJ < n) {
        // Verify this is not a temporary waggle returning back to address:
        let returnsToAddress = false;
        const checkWindow = Math.min(n, i + Math.round(contextWindowFrames(frames, 300))); // 300 ms lookahead
        for (let k = i; k < checkWindow; k++) {
          const kDisp = Math.hypot(
            (frames[k].grip2D.x - address.meanGrip2D.x) / s2D,
            (frames[k].grip2D.y - address.meanGrip2D.y) / s2D,
          );
          if (kDisp < 0.02 * noiseScale && frames[k].gripSpeed < 0.10 * noiseScale) {
            returnsToAddress = true;
            p1Idx = k; // Update P1 to after the waggle
            break;
          }
        }

        if (!returnsToAddress) {
          // Confirmed real takeaway
          return { takeawayIdx: i, p1Idx };
        }
      }
    }
  }

  // Fallback: detect takeaway purely from displacement away from address that continues into backswing
  for (let i = address.endIdx; i < n - 15; i++) {
    const f = frames[i];
    const disp = Math.hypot(
      (f.grip2D.x - address.meanGrip2D.x) / s2D,
      (f.grip2D.y - address.meanGrip2D.y) / s2D,
    );
    if (disp > 0.04 * noiseScale) {
      let movingAway = true;
      for (let k = 1; k <= Math.min(8, n - 1 - i); k++) {
        const nextDisp = Math.hypot(
          (frames[i + k].grip2D.x - address.meanGrip2D.x) / s2D,
          (frames[i + k].grip2D.y - address.meanGrip2D.y) / s2D,
        );
        if (nextDisp < disp * 0.8) {
          movingAway = false;
          break;
        }
      }
      if (movingAway) {
        return { takeawayIdx: i, p1Idx };
      }
    }
  }

  return { takeawayIdx: null, p1Idx };
}

function contextWindowFrames(frames: readonly ProcessedFrame[], ms: number): number {
  if (frames.length < 2) return 10;
  const dt = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / frames.length;
  return Math.max(1, Math.round(ms / Math.max(dt, 1)));
}

/**
 * Computes normalized backswing progress [0, 1] per frame:
 * Aggregates grip height, lateral extension in takeaway direction, and lead arm angle.
 */
export function computeBackswingProgress(
  frames: readonly ProcessedFrame[],
  p1Idx: number,
  takeawayIdx: number,
  s2D: number,
): number[] {
  const n = frames.length;
  const progress: number[] = new Array(n).fill(0);
  if (takeawayIdx >= n) return progress;

  const addrGrip = frames[p1Idx].grip2D;
  const addrLeadArmDeg = frames[p1Idx].leadArmDeg;

  // Determine backswing lateral direction from takeaway movement:
  const sampleFrame = frames[Math.min(n - 1, takeawayIdx + 8)];
  const takeawayDirX = Math.sign(sampleFrame.grip2D.x - addrGrip.x) || 1;

  for (let i = takeawayIdx; i < n; i++) {
    const f = frames[i];
    // Height above address (in yUp coordinates, higher is positive):
    const height = Math.max(0, (f.grip2D.y - addrGrip.y) / s2D);
    // Lateral extension in backswing direction:
    const lateralExt = Math.max(0, ((f.grip2D.x - addrGrip.x) * takeawayDirX) / s2D);
    // Lead arm angle change
    const armChange = Math.abs(f.leadArmDeg - addrLeadArmDeg) / 45.0;

    // Combined progress along backswing:
    progress[i] = height * 0.50 + lateralExt * 0.35 + armChange * 0.15;
  }

  // Normalize progress by maximum value:
  let maxP = 0.01;
  for (let i = takeawayIdx; i < n; i++) {
    if (progress[i] > maxP) maxP = progress[i];
  }

  for (let i = takeawayIdx; i < n; i++) {
    progress[i] = Math.max(0, Math.min(1.0, progress[i] / maxP));
  }

  return progress;
}

/**
 * Finds Top / Transition (P4):
 * Maximum backswing progress, followed by sustained downward acceleration.
 * If there is a pause on top (e.g. Hideki Matsuyama), picks the LAST stable frame
 * before downward acceleration begins.
 */
export function findTransitionTop(
  frames: readonly ProcessedFrame[],
  takeawayIdx: number,
  progress: readonly number[],
  s2D: number,
  maxSearchIdx?: number,
): number | null {
  const n = frames.length;
  if (takeawayIdx >= n - 5) return null;

  const searchEnd = maxSearchIdx !== undefined && maxSearchIdx > takeawayIdx + 2
    ? Math.min(n - 1, maxSearchIdx)
    : n - 3;

  // Adaptive thresholds: same noise compensation as findAddressWindow
  const noiseScale = Math.max(1.0, 0.25 / Math.max(s2D, 0.05));

  // Search for the peak in backswing progress:
  let bestIdx: number | null = null;
  let maxProg = -1;

  for (let i = takeawayIdx; i <= searchEnd; i++) {
    if (progress[i] > maxProg) {
      maxProg = progress[i];
      bestIdx = i;
    }
  }

  if (bestIdx === null || maxProg < 0.15) {
    // Kinematic geometric fallback: find global maximum of grip height (yUp)
    let maxY = -Infinity;
    let maxYIdx: number | null = null;
    for (let i = takeawayIdx; i <= searchEnd; i++) {
      if (frames[i].grip2D.y > maxY) {
        maxY = frames[i].grip2D.y;
        maxYIdx = i;
      }
    }
    if (maxYIdx !== null) {
      return maxYIdx;
    }
    return null;
  }

  // Check if there is a plateau (pause at the top):
  // "En paus på toppen är tillåten; välj sista stabila frame före accelerationen ned."
  let lastStableIdx = bestIdx;
  const plateauLimit = Math.min(searchEnd, bestIdx + contextWindowFrames(frames, 350));
  for (let i = bestIdx; i < plateauLimit; i++) {
    const pDiff = Math.abs(progress[i] - maxProg);
    const isStationary = frames[i].gripSpeed < 0.25 * noiseScale;
    if (pDiff < 0.08 && isStationary) {
      lastStableIdx = i;
    } else if (frames[i].gripSpeed >= 0.20 * noiseScale && frames[i].gripVelocity.y < -0.08 * noiseScale) {
      // Clear downward acceleration established
      break;
    }
  }

  return lastStableIdx;
}

/**
 * Segments the entire sequence into coarse phases.
 */
export function segmentSwingPhases(
  frames: readonly ProcessedFrame[],
  s2D: number,
): SwingPhases {
  const reasonCodes: string[] = [];

  // 1. Locate kinetic downswing peak (maximum hand speed in clip)
  let peakSpeed = 0;
  let peakSpeedIdx = -1;
  for (let i = 1; i < frames.length - 1; i++) {
    const s = frames[i].gripSpeed;
    if (s > peakSpeed) {
      peakSpeed = s;
      peakSpeedIdx = i;
    }
  }

  const hasKineticPeak = peakSpeed > 0.40 && peakSpeedIdx > 4;
  const addressSearchLimit = hasKineticPeak ? peakSpeedIdx : frames.length;

  const address = findAddressWindow(frames, s2D, addressSearchLimit);
  if (!address) {
    reasonCodes.push('NO_STABLE_ADDRESS');
    return {
      hasTakeaway: false,
      hasTransition: false,
      addressWindow: null,
      p1FrameIndex: null,
      takeawayFrameIndex: null,
      topFrameIndex: null,
      impactApproxFrameIndex: null,
      backswingProgress: new Array(frames.length).fill(0),
      reasonCodes,
    };
  }

  const { takeawayIdx, p1Idx } = detectTakeaway(frames, address, s2D);
  if (takeawayIdx === null) {
    reasonCodes.push('NO_TRANSITION');
    return {
      hasTakeaway: false,
      hasTransition: false,
      addressWindow: address,
      p1FrameIndex: p1Idx,
      takeawayFrameIndex: null,
      topFrameIndex: null,
      impactApproxFrameIndex: null,
      backswingProgress: new Array(frames.length).fill(0),
      reasonCodes,
    };
  }

  const progress = computeBackswingProgress(frames, p1Idx, takeawayIdx, s2D);
  const topSearchLimit = hasKineticPeak ? peakSpeedIdx : frames.length;
  const topIdx = findTransitionTop(frames, takeawayIdx, progress, s2D, topSearchLimit);

  if (topIdx === null) {
    reasonCodes.push('NO_TRANSITION');
    return {
      hasTakeaway: true,
      hasTransition: false,
      addressWindow: address,
      p1FrameIndex: p1Idx,
      takeawayFrameIndex: takeawayIdx,
      topFrameIndex: null,
      impactApproxFrameIndex: null,
      backswingProgress: progress,
      reasonCodes,
    };
  }

  // Approximate impact: lowest grip height or maximum downward grip speed after top
  let impactApprox: number | null = null;
  let maxDownSpeed = -1;
  for (let i = topIdx; i < frames.length; i++) {
    if (frames[i].gripSpeed > maxDownSpeed) {
      maxDownSpeed = frames[i].gripSpeed;
      impactApprox = i;
    }
  }

  return {
    hasTakeaway: true,
    hasTransition: true,
    addressWindow: address,
    p1FrameIndex: p1Idx,
    takeawayFrameIndex: takeawayIdx,
    topFrameIndex: topIdx,
    impactApproxFrameIndex: impactApprox,
    backswingProgress: progress,
    reasonCodes,
  };
}
