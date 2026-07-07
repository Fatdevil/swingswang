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
import { GolferHandedness } from '@/types/swing';

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
 */
export function extractHandVelocity(timeline: PoseTimeline): number[] {
  const centers = extractHandCenter(timeline);
  if (centers.length === 0) return [];

  const velocities: number[] = [0]; // First frame has no prior frame
  for (let i = 1; i < centers.length; i++) {
    const prev = centers[i - 1];
    const curr = centers[i];

    if (isNaN(prev.x) || isNaN(curr.x)) {
      velocities.push(NaN);
    } else {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      velocities.push(Math.sqrt(dx * dx + dy * dy));
    }
  }
  return velocities;
}

// ─── Hand Direction ─────────────────────────────────────────────────

/**
 * Direction of hand movement along the X-axis.
 * Positive = toward target (trail→lead side), negative = away from target.
 *
 * For RIGHT-handed: lead side is LEFT (lower X in normalized coords).
 *   Moving toward target = negative X movement → we negate so positive = toward.
 * For LEFT-handed: lead side is RIGHT (higher X in normalized coords).
 *   Moving toward target = positive X movement → already positive.
 *
 * First frame direction is 0.
 */
export function extractHandDirection(
  timeline: PoseTimeline,
  handedness: GolferHandedness,
): number[] {
  const centers = extractHandCenter(timeline);
  if (centers.length === 0) return [];

  // For RIGHT-handed golfer, target is to the LEFT (lower X),
  // so moving toward target means dx < 0. We negate to make positive = toward target.
  // For LEFT-handed golfer, target is to the RIGHT (higher X),
  // so moving toward target means dx > 0.
  const sign = handedness === 'RIGHT' ? -1 : 1;

  const directions: number[] = [0];
  for (let i = 1; i < centers.length; i++) {
    const prev = centers[i - 1];
    const curr = centers[i];

    if (isNaN(prev.x) || isNaN(curr.x)) {
      directions.push(NaN);
    } else {
      directions.push((curr.x - prev.x) * sign);
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
