/**
 * signalExtractors.ts
 * SwingSwang – Swing Event Detection
 *
 * Signal extraction functions that operate on PoseTimeline data.
 * Each function returns an array of signal values indexed by frame index.
 * Missing landmarks produce NaN for that frame.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { LandmarkID, isLandmarkVisible } from '@/types/landmarks';
import { CameraView, GolferHandedness } from '@/types/swing';

// ─── Hand Center ────────────────────────────────────────────────────


/** Midpoint of both wrists, with average confidence. */
export interface HandCenterPoint {
  readonly x: number;
  readonly y: number;
  readonly confidence: number;
}

/**
 * Extract the hand center (midpoint of both wrists) for every frame.
 * Returns NaN coordinates when one or both wrists are not visible.
 */
export function extractHandCenter(timeline: PoseTimeline): HandCenterPoint[] {
  return timeline.frames.map((frame) => {
    const leftWrist = frame.landmarks.get(LandmarkID.leftWrist);
    const rightWrist = frame.landmarks.get(LandmarkID.rightWrist);

    if (!isLandmarkVisible(leftWrist) || !isLandmarkVisible(rightWrist)) {
      return { x: NaN, y: NaN, confidence: 0 };
    }

    return {
      x: (leftWrist!.x + rightWrist!.x) / 2,
      y: (leftWrist!.y + rightWrist!.y) / 2,
      confidence: (leftWrist!.confidence + rightWrist!.confidence) / 2,
    };
  });
}

// ─── Hand Velocity ──────────────────────────────────────────────────

/**
 * Frame-to-frame velocity of hand center (Euclidean distance per frame).
 * First frame velocity is 0. Returns NaN when hand center is unavailable
 * for either the current or previous frame.
 * Uses realTimestamp when available for true real-world velocity (slow-motion invariant).
 */
export function extractHandVelocity(timeline: PoseTimeline): number[] {
  const centers = extractHandCenter(timeline);
  if (centers.length === 0) return [];

  const velocities: number[] = [0]; // First frame has no prior frame
  for (let i = 1; i < centers.length; i++) {
    const prev = centers[i - 1];
    const curr = centers[i];
    const tCurr = timeline.frames[i].realTimestamp ?? timeline.frames[i].timestamp;
    const tPrev = timeline.frames[i - 1].realTimestamp ?? timeline.frames[i - 1].timestamp;
    let dt = tCurr - tPrev;

    if (dt <= 0) {
      dt = timeline.frames[i].timestamp - timeline.frames[i - 1].timestamp;
    }

    if (isNaN(prev.x) || isNaN(curr.x) || dt <= 0) {
      velocities.push(NaN);
    } else {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
  }
  return velocities;
}

// ─── Hand Direction ─────────────────────────────────────────────────

/**
 * Direction of hand movement.
 *
 * For Face-On (FO):
 * Along the X-axis: Positive = toward target (trail→lead side), negative = away from target.
 * For RIGHT-handed: lead side is LEFT (lower X in normalized coords).
 *   Moving toward target = negative X movement → we negate so positive = toward.
 * For LEFT-handed: lead side is RIGHT (higher X in normalized coords).
 *   Moving toward target = positive X movement → already positive.
 *
 * For Down-the-Line (DTL):
 * Camera looks down target line.
 * Upward movement into backswing arc = negative (decreasing Y in screen coords).
 * Downward movement toward impact/ball = positive (increasing Y in screen coords).
 *
 * First frame direction is 0.
 */
export function extractHandDirection(
  timeline: PoseTimeline,
  handedness: GolferHandedness,
  cameraView: CameraView = 'FO',
): number[] {
  const centers = extractHandCenter(timeline);
  if (centers.length === 0) return [];

  const sign = handedness === 'RIGHT' ? -1 : 1;

  const directions: number[] = [0];
  for (let i = 1; i < centers.length; i++) {
    const prev = centers[i - 1];
    const curr = centers[i];
    const dt = timeline.frames[i].timestamp - timeline.frames[i - 1].timestamp;

    if (isNaN(prev.x) || isNaN(curr.x) || isNaN(prev.y) || isNaN(curr.y) || dt <= 0) {
      directions.push(NaN);
    } else if (cameraView === 'DTL') {
      // In DTL: moving downward toward ball/impact (increasing Y in screen coords) is positive.
      // Moving upward into backswing (decreasing Y in screen coords) is negative.
      const dy = curr.y - prev.y;
      directions.push(dy / dt);
    } else {
      directions.push(((curr.x - prev.x) * sign) / dt);
    }
  }
  return directions;
}

// ─── Shoulder Span ──────────────────────────────────────────────────

/**
 * Distance between left and right shoulders along the X-axis.
 * Acts as a rotation proxy: as the golfer rotates, the apparent
 * shoulder span in the camera plane changes.
 */
export function extractShoulderSpan(timeline: PoseTimeline): number[] {
  return timeline.frames.map((frame) => {
    const leftShoulder = frame.landmarks.get(LandmarkID.leftShoulder);
    const rightShoulder = frame.landmarks.get(LandmarkID.rightShoulder);

    if (!isLandmarkVisible(leftShoulder) || !isLandmarkVisible(rightShoulder)) {
      return NaN;
    }

    return Math.abs(rightShoulder!.x - leftShoulder!.x);
  });
}

// ─── Hip Lateral Position ───────────────────────────────────────────

/**
 * X-coordinate of the hip midpoint (lateral sway proxy).
 */
export function extractHipLateralPosition(timeline: PoseTimeline): number[] {
  return timeline.frames.map((frame) => {
    const leftHip = frame.landmarks.get(LandmarkID.leftHip);
    const rightHip = frame.landmarks.get(LandmarkID.rightHip);

    if (!isLandmarkVisible(leftHip) || !isLandmarkVisible(rightHip)) {
      return NaN;
    }

    return (leftHip!.x + rightHip!.x) / 2;
  });
}

// ─── Wrist Height ───────────────────────────────────────────────────

/**
 * Wrist height relative to shoulder height.
 * Normalized: 0 = at shoulder level, negative = below shoulders, positive = above shoulders.
 *
 * Note: In normalized screen coordinates Y increases downward,
 * so wrist.y > shoulder.y means wrist is BELOW shoulder → negative value.
 */
export function extractWristHeight(timeline: PoseTimeline): number[] {
  return timeline.frames.map((frame) => {
    const leftWrist = frame.landmarks.get(LandmarkID.leftWrist);
    const rightWrist = frame.landmarks.get(LandmarkID.rightWrist);
    const leftShoulder = frame.landmarks.get(LandmarkID.leftShoulder);
    const rightShoulder = frame.landmarks.get(LandmarkID.rightShoulder);

    if (
      !isLandmarkVisible(leftWrist) || !isLandmarkVisible(rightWrist) ||
      !isLandmarkVisible(leftShoulder) || !isLandmarkVisible(rightShoulder)
    ) {
      return NaN;
    }

    const wristY = (leftWrist!.y + rightWrist!.y) / 2;
    const shoulderY = (leftShoulder!.y + rightShoulder!.y) / 2;

    // In screen coords, smaller Y = higher.
    // Return positive when wrists are above shoulders (wristY < shoulderY).
    return shoulderY - wristY;
  });
}

// ─── Hand Lateral Offset ────────────────────────────────────────────

/**
 * Hand center lateral offset relative to hip center.
 * Signed so positive = trail side (backswing side), negative = lead side (target / follow-through side).
 *
 * For Face-On (FO):
 * For RIGHT-handed: Trail side is screen-right (higher X), lead side is screen-left (lower X).
 *   offset = handCenter.x - hipCenter.x.
 * For LEFT-handed: Trail side is screen-left (lower X), lead side is screen-right (higher X).
 *   offset = hipCenter.x - handCenter.x.
 *
 * For Down-The-Line (DTL):
 * Camera is looking down target line.
 * Along X-axis, depth relative to pelvis center:
 * Positive = away from body / behind hands, negative = in front.
 */
export function extractHandLateralOffset(
  timeline: PoseTimeline,
  handedness: GolferHandedness = 'RIGHT',
  cameraView: CameraView = 'FO',
): number[] {
  const centers = extractHandCenter(timeline);
  const sign = handedness === 'RIGHT' ? 1 : -1;

  return timeline.frames.map((frame, i) => {
    const hand = centers[i];
    const leftHip = frame.landmarks.get(LandmarkID.leftHip);
    const rightHip = frame.landmarks.get(LandmarkID.rightHip);

    if (
      isNaN(hand.x) ||
      !isLandmarkVisible(leftHip) ||
      !isLandmarkVisible(rightHip)
    ) {
      return NaN;
    }

    const hipX = (leftHip!.x + rightHip!.x) / 2;
    return (hand.x - hipX) * sign;
  });
}

// ─── Trail Heel Lift ────────────────────────────────────────────────

/**
 * Relative elevation of trail ankle versus lead ankle.
 * In screen coordinates, Y increases downward (ground is larger Y).
 * When trail foot lifts (e.g. at FINISH/P10 with toe-roll), trail ankle moves upward (smaller Y),
 * so leadAnkle.y - trailAnkle.y becomes positive (> 0.04).
 * When both feet are planted (ADDRESS/P1 through TOP/P4), trail ankle is near lead ankle level (≈ 0).
 */
export function extractTrailHeelLift(
  timeline: PoseTimeline,
  handedness: GolferHandedness = 'RIGHT',
  cameraView: CameraView = 'FO',
): number[] {
  return timeline.frames.map((frame) => {
    const leftAnkle = frame.landmarks.get(LandmarkID.leftAnkle);
    const rightAnkle = frame.landmarks.get(LandmarkID.rightAnkle);

    if (!isLandmarkVisible(leftAnkle) || !isLandmarkVisible(rightAnkle)) {
      return NaN;
    }

    // Right-handed: trail foot is RIGHT, lead foot is LEFT
    // Left-handed: trail foot is LEFT, lead foot is RIGHT
    const trailAnkle = handedness === 'RIGHT' ? rightAnkle! : leftAnkle!;
    const leadAnkle = handedness === 'RIGHT' ? leftAnkle! : rightAnkle!;

    // leadAnkle.y - trailAnkle.y > 0 means trail ankle is higher on screen than lead ankle (lifted!)
    return leadAnkle.y - trailAnkle.y;
  });
}

// ─── Signal Smoothing ───────────────────────────────────────────────


/**
 * Smooth a 1D numerical signal using a moving average window, preserving NaNs.
 */
export function smoothSignal(signal: readonly number[], windowSize: number = 3): number[] {
  if (windowSize <= 1 || signal.length <= 1) return [...signal];
  const half = Math.floor(windowSize / 2);
  const result: number[] = [];

  for (let i = 0; i < signal.length; i++) {
    if (isNaN(signal[i])) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - half);
    const end = Math.min(signal.length - 1, i + half);

    for (let j = start; j <= end; j++) {
      if (!isNaN(signal[j])) {
        sum += signal[j];
        count++;
      }
    }
    result.push(count > 0 ? sum / count : NaN);
  }

  return result;
}
