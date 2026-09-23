/**
 * candidates.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Candidate generation and quality scoring for positions P1 through P10,
 * enforcing honest pose-only proxies (P2_PROXY, P6_PROXY, IMPACT_PROXY, P8_PROXY)
 * with caps and warnings.
 */

import {
  PPosition,
  EventStatus,
  CaptureContext,
  LANDMARK_INDEX,
  POSE_ONLY_MODE_CAPS,
  SEMANTIC_NAMES,
} from './types';
import { ProcessedFrame } from './signalProcessing';
import { SwingPhases } from './phases';

export interface Candidate {
  readonly position: PPosition;
  readonly frameIndex: number;
  readonly timestampMs: number;
  readonly score: number; // Quality score [0, 1] capped by modeCap
  readonly status: EventStatus;
  readonly semantic: string;
  readonly warnings: string[];
  readonly evidence: Record<string, number | boolean | string>;
}

/**
 * Computes weighted geometric mean quality according to Section 8.1:
 * quality = (Q_landmarks^0.35) * (Q_geometry^0.25) * (Q_temporal^0.25) * (Q_view^0.15)
 * quality = min(quality, modeCap[position])
 */
export function computeQualityScore(
  position: PPosition,
  qLandmarks: number,
  qGeometry: number,
  qTemporal: number,
  qView: number,
): number {
  // Clamp all components to [0, 1]
  const l = Math.max(0, Math.min(1, qLandmarks));
  const g = Math.max(0, Math.min(1, qGeometry));
  const t = Math.max(0, Math.min(1, qTemporal));
  const v = Math.max(0, Math.min(1, qView));

  if (l <= 1e-4 || g <= 1e-4 || t <= 1e-4 || v <= 1e-4) {
    return 0.0;
  }

  const rawQuality =
    Math.pow(l, 0.35) *
    Math.pow(g, 0.25) *
    Math.pow(t, 0.25) *
    Math.pow(v, 0.15);

  const cap = POSE_ONLY_MODE_CAPS[position];
  return Math.min(rawQuality, cap);
}

/**
 * Checks landmark health across specified key landmarks:
 * Returns geometric mean, or 0 if any landmark is below hard floor (0.50).
 */
export function evaluateLandmarksQuality(
  frame: ProcessedFrame,
  landmarkIndices: readonly number[],
): number {
  let prod = 1.0;
  for (const idx of landmarkIndices) {
    const q = frame.quality[idx];
    if (q < 0.50) return 0.0; // Hard gate floor
    prod *= q;
  }
  return Math.pow(prod, 1.0 / landmarkIndices.length);
}

/**
 * Evaluates arm track stability across an interval [startIdx, endIdx]:
 * Returns true if no ID swaps or sudden flips occurred between wrists/shoulders.
 */
export function isArmTrackStable(
  frames: readonly ProcessedFrame[],
  startIdx: number,
  endIdx: number,
): boolean {
  const s = Math.max(0, startIdx);
  const e = Math.min(frames.length - 1, endIdx);
  for (let i = s + 1; i <= e; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    // Check sudden inversion of lead/trail wrist relationship
    const prevRelX = prev.leadWrist.x - prev.trailWrist.x;
    const currRelX = curr.leadWrist.x - curr.trailWrist.x;
    if (prevRelX * currRelX < 0 && Math.abs(currRelX - prevRelX) > 0.02) {
      return false; // Wrist identity swap detected
    }
  }
  return true;
}

/**
 * Generates all candidate frames for a specific position P1-P10.
 */
export function generateCandidatesForPosition(
  position: PPosition,
  frames: readonly ProcessedFrame[],
  phases: SwingPhases,
  context: CaptureContext,
  s2D: number,
): Candidate[] {
  const n = frames.length;
  if (n === 0 || !phases.addressWindow) return [];

  const candidates: Candidate[] = [];
  const p1Idx = phases.p1FrameIndex ?? phases.addressWindow.endIdx;
  const takeawayIdx = phases.takeawayFrameIndex ?? p1Idx;
  const topIdx = phases.topFrameIndex ?? Math.min(n - 1, takeawayIdx + 10);

  const viewFactor = context.view === 'FACE_ON' ? 0.95 : 0.90;

  switch (position) {
    case 'P1': {
      // P1: Best frame in stable address window immediately preceding takeaway
      const searchStart = Math.max(phases.addressWindow.startIdx, p1Idx - 5);
      const searchEnd = Math.min(frames.length - 1, p1Idx);

      for (let idx = searchStart; idx <= searchEnd; idx++) {
        const f = frames[idx];
        const qL = evaluateLandmarksQuality(f, [
          LANDMARK_INDEX.LEFT_SHOULDER,
          LANDMARK_INDEX.RIGHT_SHOULDER,
          LANDMARK_INDEX.LEFT_WRIST,
          LANDMARK_INDEX.RIGHT_WRIST,
          LANDMARK_INDEX.LEFT_HIP,
          LANDMARK_INDEX.RIGHT_HIP,
        ]);
        const qG = Math.max(0.2, 1.0 - f.gripSpeed / 0.25);
        const qT = 0.95;
        const score = computeQualityScore('P1', qL, qG, qT, viewFactor);

        if (score > 0.10) {
          candidates.push({
            position: 'P1',
            frameIndex: f.frameIndex,
            timestampMs: f.timestampMs,
            score,
            status: 'DETECTED_EXACT',
            semantic: SEMANTIC_NAMES.P1.exact,
            warnings: [],
            evidence: {
              gripSpeed: f.gripSpeed,
              stabilityMs: phases.addressWindow.durationMs,
            },
          });
        }
      }
      break;
    }

    case 'P2': {
      // P2: Shaft parallel in backswing -> POSE-ONLY PROXY (P2_PROXY)
      // Best combination of grip in hip band, early arc length, moving away from P1.
      const hipLevelY = frames[p1Idx].midHip.y;
      const searchEnd = topIdx;

      for (let i = takeawayIdx; i < searchEnd; i++) {
        const f = frames[i];
        if (f.gripVelocity.x === 0 && f.gripVelocity.y === 0) continue;

        // Grip should be around hip level in backswing
        const hipDist = Math.abs(f.grip2D.y - hipLevelY) / s2D;
        if (hipDist > 0.35) continue;

        const qL = evaluateLandmarksQuality(f, [
          LANDMARK_INDEX.LEFT_WRIST,
          LANDMARK_INDEX.RIGHT_WRIST,
        ]);
        const qG = Math.max(0, 1.0 - hipDist / 0.35);
        const qT = f.gripSpeed > 0.10 ? 0.90 : 0.60;
        const score = computeQualityScore('P2', qL, qG, qT, viewFactor);

        if (score > 0.15) {
          candidates.push({
            position: 'P2',
            frameIndex: f.frameIndex,
            timestampMs: f.timestampMs,
            score,
            status: 'DETECTED_PROXY',
            semantic: SEMANTIC_NAMES.P2.proxy,
            warnings: ['NO_CLUB_SIGNAL'],
            evidence: {
              hipDistTorsoRatio: hipDist,
              gripSpeed: f.gripSpeed,
            },
          });
        }
      }
      break;
    }

    case 'P3': {
      // P3: Lead arm parallel to ground in backswing (leadArmDeg <= 10 deg, rising)
      for (let i = takeawayIdx; i < topIdx; i++) {
        const f = frames[i];
        if (f.leadArmDeg <= 12.0 && f.leadArmVelocity.y >= -0.05) {
          const qL = evaluateLandmarksQuality(f, [
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER,
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.LEFT_ELBOW : LANDMARK_INDEX.RIGHT_ELBOW,
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST,
          ]);
          const qG = Math.max(0, 1.0 - f.leadArmDeg / 15.0);
          const qT = 0.90;
          const score = computeQualityScore('P3', qL, qG, qT, viewFactor);

          if (score > 0.20) {
            candidates.push({
              position: 'P3',
              frameIndex: f.frameIndex,
              timestampMs: f.timestampMs,
              score,
              status: 'DETECTED_EXACT',
              semantic: SEMANTIC_NAMES.P3.exact,
              warnings: [],
              evidence: {
                leadArmDeg: f.leadArmDeg,
                rising: true,
              },
            });
          }
        }
      }
      break;
    }

    case 'P4': {
      // P4: Top / transition (last robust progression maximum)
      const f = frames[topIdx];
      const isStable = isArmTrackStable(frames, Math.max(0, topIdx - 5), Math.min(n - 1, topIdx + 5));
      const qL = evaluateLandmarksQuality(f, [
        LANDMARK_INDEX.LEFT_SHOULDER,
        LANDMARK_INDEX.RIGHT_SHOULDER,
        LANDMARK_INDEX.LEFT_WRIST,
        LANDMARK_INDEX.RIGHT_WRIST,
      ]);
      const stabilityMultiplier = isStable ? 1.0 : 0.85;
      const qG = 0.90 * stabilityMultiplier;
      const qT = 0.90;
      const score = computeQualityScore('P4', qL, qG, qT, viewFactor);

      if (score > 0.20) {
        candidates.push({
          position: 'P4',
          frameIndex: f.frameIndex,
          timestampMs: f.timestampMs,
          score,
          status: 'DETECTED_EXACT',
          semantic: SEMANTIC_NAMES.P4.exact,
          warnings: isStable ? [] : ['WRIST_CROSS_OBSERVED'],
          evidence: {
            backswingProgress: phases.backswingProgress[topIdx],
            armTrackStable: isStable,
          },
        });
      }
      break;
    }

    case 'P5': {
      // P5: Lead arm parallel to ground in downswing (leadArmDeg <= 12 deg, falling, after P4)
      const downswingStable = isArmTrackStable(frames, topIdx, Math.min(n - 1, topIdx + 30));
      if (!downswingStable) {
        break; // Downswing arm tracking compromised; abstain P5
      }

      const remainingP5 = n - 1 - topIdx;
      const p5Limit = Math.min(n, topIdx + Math.max(25, Math.round(remainingP5 * 0.50)));

      for (let i = topIdx + 1; i < p5Limit; i++) {
        const f = frames[i];
        if (f.leadArmDeg <= 15.0 && f.leadArmVelocity.y <= 0.10) {
          const qL = evaluateLandmarksQuality(f, [
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER,
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.LEFT_ELBOW : LANDMARK_INDEX.RIGHT_ELBOW,
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST,
          ]);
          const qG = Math.max(0, 1.0 - f.leadArmDeg / 15.0);
          const qT = f.gripSpeed > 0.15 ? 0.90 : 0.70;
          const score = computeQualityScore('P5', qL, qG, qT, viewFactor);

          if (score > 0.20) {
            candidates.push({
              position: 'P5',
              frameIndex: f.frameIndex,
              timestampMs: f.timestampMs,
              score,
              status: 'DETECTED_EXACT',
              semantic: SEMANTIC_NAMES.P5.exact,
              warnings: [],
              evidence: {
                leadArmDeg: f.leadArmDeg,
                gripSpeed: f.gripSpeed,
              },
            });
          }
        }
      }
      break;
    }

    case 'P6': {
      // P6: Shaft parallel downswing -> POSE-ONLY PROXY (P6_PROXY)
      // Grip passes delivery hip band with falling trajectory and high speed.
      const remainingP6 = n - 1 - topIdx;
      const p6Limit = Math.min(n, topIdx + Math.max(30, Math.round(remainingP6 * 0.65)));
      const hipLevelY = frames[p1Idx].midHip.y;

      for (let i = topIdx + 1; i < p6Limit; i++) {
        const f = frames[i];
        const hipDist = Math.abs(f.grip2D.y - hipLevelY) / s2D;
        if (hipDist < 0.35 && f.gripVelocity.y < 0.05) {
          const qL = evaluateLandmarksQuality(f, [
            LANDMARK_INDEX.LEFT_WRIST,
            LANDMARK_INDEX.RIGHT_WRIST,
          ]);
          const qG = Math.max(0, 1.0 - hipDist / 0.35);
          const qT = f.gripSpeed > 0.20 ? 0.90 : 0.70;
          const score = computeQualityScore('P6', qL, qG, qT, viewFactor);

          if (score > 0.15) {
            candidates.push({
              position: 'P6',
              frameIndex: f.frameIndex,
              timestampMs: f.timestampMs,
              score,
              status: 'DETECTED_PROXY',
              semantic: SEMANTIC_NAMES.P6.proxy,
              warnings: ['NO_CLUB_SIGNAL'],
              evidence: {
                hipDistTorsoRatio: hipDist,
                gripSpeed: f.gripSpeed,
              },
            });
          }
        }
      }
      break;
    }

    case 'P7': {
      // P7: Impact -> POSE-ONLY PROXY (IMPACT_PROXY)
      // Minimum distance to address grip zone & passage through lower arc
      const remainingP7 = n - 1 - topIdx;
      const p7Limit = Math.min(n, topIdx + Math.max(35, Math.round(remainingP7 * 0.85)));
      const addrGrip = frames[p1Idx].grip2D;

      for (let i = topIdx + 2; i < p7Limit; i++) {
        const f = frames[i];
        const distToAddr =
          Math.hypot(f.grip2D.x - addrGrip.x, f.grip2D.y - addrGrip.y) / s2D;

        if (distToAddr < 0.45) {
          const qL = evaluateLandmarksQuality(f, [
            LANDMARK_INDEX.LEFT_WRIST,
            LANDMARK_INDEX.RIGHT_WRIST,
          ]);
          const qG = Math.max(0, 1.0 - distToAddr / 0.45);
          const qT = f.gripSpeed > 0.25 ? 0.90 : 0.75;
          const score = computeQualityScore('P7', qL, qG, qT, viewFactor);

          if (score > 0.15) {
            candidates.push({
              position: 'P7',
              frameIndex: f.frameIndex,
              timestampMs: f.timestampMs,
              score,
              status: 'DETECTED_PROXY',
              semantic: SEMANTIC_NAMES.P7.proxy,
              warnings: ['NO_CLUB_SIGNAL', 'NO_BALL_CONTACT_SIGNAL'],
              evidence: {
                distanceToAddressGrip: distToAddr,
                gripSpeedBodyLengthsPerSec: f.gripSpeed,
                phase: 'DOWN_TO_THROUGH',
              },
            });
          }
        }
      }
      break;
    }

    case 'P8': {
      // P8: Shaft parallel follow-through -> POSE-ONLY PROXY (P8_PROXY)
      // First exit passing corresponding hip band after impact
      const hipLevelY = frames[p1Idx].midHip.y;
      const searchStart = topIdx + 3;
      const p8Limit = Math.min(n, searchStart + Math.max(40, Math.round((n - searchStart) * 0.60)));

      for (let i = searchStart; i < p8Limit; i++) {
        const f = frames[i];
        const hipDist = Math.abs(f.grip2D.y - hipLevelY) / s2D;
        if (hipDist < 0.35 && f.gripVelocity.y > -0.05) {
          const qL = evaluateLandmarksQuality(f, [
            LANDMARK_INDEX.LEFT_WRIST,
            LANDMARK_INDEX.RIGHT_WRIST,
          ]);
          const qG = Math.max(0, 1.0 - hipDist / 0.35);
          const qT = f.gripSpeed > 0.20 ? 0.90 : 0.70;
          const score = computeQualityScore('P8', qL, qG, qT, viewFactor);

          if (score > 0.15) {
            candidates.push({
              position: 'P8',
              frameIndex: f.frameIndex,
              timestampMs: f.timestampMs,
              score,
              status: 'DETECTED_PROXY',
              semantic: SEMANTIC_NAMES.P8.proxy,
              warnings: ['NO_CLUB_SIGNAL'],
              evidence: {
                hipDistTorsoRatio: hipDist,
                gripSpeed: f.gripSpeed,
              },
            });
          }
        }
      }
      break;
    }

    case 'P9': {
      // P9: Trail arm parallel to ground in through-swing (trailArmDeg <= 15 deg, rising)
      const searchStart = topIdx + 4;
      const p9Limit = Math.min(n, searchStart + Math.max(60, n - searchStart));

      for (let i = searchStart; i < p9Limit; i++) {
        const f = frames[i];
        if (f.trailArmDeg <= 15.0 && f.trailArmVelocity.y >= -0.05) {
          const qL = evaluateLandmarksQuality(f, [
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER,
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.RIGHT_ELBOW : LANDMARK_INDEX.LEFT_ELBOW,
            context.handedness === 'RIGHT' ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST,
          ]);
          const qG = Math.max(0, 1.0 - f.trailArmDeg / 18.0);
          const qT = 0.85;
          const score = computeQualityScore('P9', qL, qG, qT, viewFactor);

          if (score > 0.20) {
            candidates.push({
              position: 'P9',
              frameIndex: f.frameIndex,
              timestampMs: f.timestampMs,
              score,
              status: 'DETECTED_EXACT',
              semantic: SEMANTIC_NAMES.P9.exact,
              warnings: [],
              evidence: {
                trailArmDeg: f.trailArmDeg,
                rising: true,
              },
            });
          }
        }
      }
      break;
    }

    case 'P10': {
      // P10: Finish: first stable frame in finish plateau (>= 150 ms stable, low body speed)
      const searchStart = topIdx + 10;
      for (let i = searchStart; i < n - 3; i++) {
        const f = frames[i];
        if (f.gripSpeed < 0.35 && f.midHipSpeed < 0.20) {
          // Check duration of stability plateau
          let plateauLengthMs = 0;
          for (let j = i; j < n; j++) {
            if (frames[j].gripSpeed < 0.40) {
              plateauLengthMs = frames[j].timestampMs - f.timestampMs;
            } else {
              break;
            }
          }

          if (plateauLengthMs >= 150.0 || i >= n - 10) {
            const qL = evaluateLandmarksQuality(f, [
              LANDMARK_INDEX.LEFT_ANKLE,
              LANDMARK_INDEX.RIGHT_ANKLE,
              LANDMARK_INDEX.LEFT_SHOULDER,
              LANDMARK_INDEX.RIGHT_SHOULDER,
            ]);
            const qG = 0.90;
            const qT = Math.min(1.0, Math.max(0.70, plateauLengthMs / 250.0));
            const score = computeQualityScore('P10', qL, qG, qT, viewFactor);

            if (score > 0.20) {
              candidates.push({
                position: 'P10',
                frameIndex: f.frameIndex,
                timestampMs: f.timestampMs,
                score,
                status: 'DETECTED_EXACT',
                semantic: SEMANTIC_NAMES.P10.exact,
                warnings: [],
                evidence: {
                  plateauDurationMs: plateauLengthMs,
                  gripSpeed: f.gripSpeed,
                },
              });
              // Take the first frame entering the stability plateau:
              break;
            }
          }
        }
      }
      break;
    }
  }

  return candidates;
}
