/**
 * canonicalize.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Canonicalization, coordinate transformation (yUp = 1 - yImage),
 * handedness mapping (lead/trail), and torso scale calculation (S2D).
 */

import {
  PoseFrame,
  CaptureContext,
  Vec3,
  Landmark,
  LANDMARK_INDEX,
} from './types';

export interface CanonicalFrame {
  readonly frameIndex: number;
  readonly timestampUs: number;
  readonly timestampMs: number;
  readonly image: readonly Vec3[];        // Normalized image coords with yUp = 1 - yImage
  readonly imageRaw: readonly Landmark[];
  readonly world: readonly Vec3[];        // Centered to pelvis center in meters
  readonly quality: readonly number[];    // q = min(visibility, presence ?? 1) per landmark
  readonly midShoulder: Vec3;
  readonly midHip: Vec3;
  readonly grip2D: Vec3;
  readonly leadShoulder: Vec3;
  readonly leadElbow: Vec3;
  readonly leadWrist: Vec3;
  readonly trailShoulder: Vec3;
  readonly trailElbow: Vec3;
  readonly trailWrist: Vec3;
  readonly leadArm: Vec3;
  readonly trailArm: Vec3;
  readonly leadArmDeg: number;            // 0 deg = horizontal
  readonly trailArmDeg: number;           // 0 deg = horizontal
}

export interface CanonicalSequence {
  readonly frames: readonly CanonicalFrame[];
  readonly s2D: number;                  // Median torso height in address window (P1)
  readonly context: CaptureContext;
}

/**
 * Calculates per-landmark quality score:
 * q = min(visibility, presence ?? 1.0)
 */
export function calculateLandmarkQuality(lm: Landmark): number {
  const vis = typeof lm.visibility === 'number' ? lm.visibility : 1.0;
  const pres = typeof lm.presence === 'number' ? lm.presence : 1.0;
  return Math.max(0, Math.min(1, Math.min(vis, pres)));
}

/**
 * Computes the angle of a 2D vector relative to the image horizontal in degrees.
 * 0° = perfectly horizontal, 90° = vertical.
 */
export function angleToImageHorizontal(v: Vec3): number {
  const absY = Math.abs(v.y);
  const absX = Math.abs(v.x);
  if (absX < 1e-7 && absY < 1e-7) return 0;
  const rad = Math.atan2(absY, absX);
  return (rad * 180) / Math.PI;
}

/**
 * Performs quality-weighted mean of two 2D positions (e.g. left and right wrist).
 */
export function qualityWeightedMean(
  p1: Vec3,
  q1: number,
  p2: Vec3,
  q2: number,
): Vec3 {
  const totalQ = q1 + q2;
  if (totalQ <= 1e-6) {
    return {
      x: (p1.x + p2.x) * 0.5,
      y: (p1.y + p2.y) * 0.5,
      z: ((p1.z ?? 0) + (p2.z ?? 0)) * 0.5,
    };
  }
  return {
    x: (p1.x * q1 + p2.x * q2) / totalQ,
    y: (p1.y * q1 + p2.y * q2) / totalQ,
    z: ((p1.z ?? 0) * q1 + (p2.z ?? 0) * q2) / totalQ,
  };
}

/**
 * Canonicalizes a single PoseFrame:
 * - Un-mirrors if inputWasMirrored is true (inference must be on unmirrored pixels)
 * - Converts y to upward coordinate: yUp = 1 - yImage
 * - Centers world landmarks to pelvis center
 * - Maps lead and trail anatomical landmarks based on handedness
 * - Computes midShoulder, midHip, grip2D, and arm vectors
 */
export function canonicalizeFrame(
  frame: PoseFrame,
  context: CaptureContext,
): CanonicalFrame {
  const qList: number[] = new Array(33);
  const imageUp: Vec3[] = new Array(33);
  const worldCentered: Vec3[] = new Array(33);

  for (let i = 0; i < 33; i++) {
    const rawImg = frame.image[i] ?? { x: 0, y: 0, z: 0, visibility: 0 };
    qList[i] = calculateLandmarkQuality(rawImg);

    // If input was mirrored, unmirror X coordinate:
    const x = frame.inputWasMirrored ? 1.0 - rawImg.x : rawImg.x;
    // Internal up-pointing y axis:
    const y = 1.0 - rawImg.y;
    const z = rawImg.z ?? 0;
    imageUp[i] = { x, y, z };
  }

  // Pelvis center in world landmarks:
  const leftHipW = frame.world[LANDMARK_INDEX.LEFT_HIP] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const rightHipW = frame.world[LANDMARK_INDEX.RIGHT_HIP] ?? { x: 0, y: 0, z: 0, visibility: 0 };
  const pelvisCenterW: Vec3 = {
    x: (leftHipW.x + rightHipW.x) * 0.5,
    y: (leftHipW.y + rightHipW.y) * 0.5,
    z: (leftHipW.z + rightHipW.z) * 0.5,
  };

  for (let i = 0; i < 33; i++) {
    const rawW = frame.world[i] ?? { x: 0, y: 0, z: 0, visibility: 0 };
    worldCentered[i] = {
      x: rawW.x - pelvisCenterW.x,
      y: rawW.y - pelvisCenterW.y,
      z: rawW.z - pelvisCenterW.z,
    };
  }

  // Handedness mapping:
  // Right-handed: lead = left (11, 13, 15), trail = right (12, 14, 16)
  // Left-handed:  lead = right (12, 14, 16), trail = left (11, 13, 15)
  const isRightHanded = context.handedness === 'RIGHT';
  const leadShoulderIdx = isRightHanded ? LANDMARK_INDEX.LEFT_SHOULDER : LANDMARK_INDEX.RIGHT_SHOULDER;
  const leadElbowIdx = isRightHanded ? LANDMARK_INDEX.LEFT_ELBOW : LANDMARK_INDEX.RIGHT_ELBOW;
  const leadWristIdx = isRightHanded ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;

  const trailShoulderIdx = isRightHanded ? LANDMARK_INDEX.RIGHT_SHOULDER : LANDMARK_INDEX.LEFT_SHOULDER;
  const trailElbowIdx = isRightHanded ? LANDMARK_INDEX.RIGHT_ELBOW : LANDMARK_INDEX.LEFT_ELBOW;
  const trailWristIdx = isRightHanded ? LANDMARK_INDEX.RIGHT_WRIST : LANDMARK_INDEX.LEFT_WRIST;

  const lShoulder = imageUp[LANDMARK_INDEX.LEFT_SHOULDER];
  const rShoulder = imageUp[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lHip = imageUp[LANDMARK_INDEX.LEFT_HIP];
  const rHip = imageUp[LANDMARK_INDEX.RIGHT_HIP];

  const midShoulder: Vec3 = {
    x: (lShoulder.x + rShoulder.x) * 0.5,
    y: (lShoulder.y + rShoulder.y) * 0.5,
    z: (lShoulder.z + rShoulder.z) * 0.5,
  };

  const midHip: Vec3 = {
    x: (lHip.x + rHip.x) * 0.5,
    y: (lHip.y + rHip.y) * 0.5,
    z: (lHip.z + rHip.z) * 0.5,
  };

  const lWrist = imageUp[LANDMARK_INDEX.LEFT_WRIST];
  const rWrist = imageUp[LANDMARK_INDEX.RIGHT_WRIST];
  const qLWrist = qList[LANDMARK_INDEX.LEFT_WRIST];
  const qRWrist = qList[LANDMARK_INDEX.RIGHT_WRIST];

  const grip2D = qualityWeightedMean(lWrist, qLWrist, rWrist, qRWrist);

  const leadShoulder = imageUp[leadShoulderIdx];
  const leadElbow = imageUp[leadElbowIdx];
  const leadWrist = imageUp[leadWristIdx];

  const trailShoulder = imageUp[trailShoulderIdx];
  const trailElbow = imageUp[trailElbowIdx];
  const trailWrist = imageUp[trailWristIdx];

  const leadArm: Vec3 = {
    x: leadWrist.x - leadShoulder.x,
    y: leadWrist.y - leadShoulder.y,
    z: leadWrist.z - leadShoulder.z,
  };

  const trailArm: Vec3 = {
    x: trailWrist.x - trailShoulder.x,
    y: trailWrist.y - trailShoulder.y,
    z: trailWrist.z - trailShoulder.z,
  };

  const leadArmDeg = angleToImageHorizontal(leadArm);
  const trailArmDeg = angleToImageHorizontal(trailArm);

  return {
    frameIndex: frame.frameIndex,
    timestampUs: frame.timestampUs,
    timestampMs: frame.timestampUs / 1000,
    image: imageUp,
    imageRaw: frame.image,
    world: worldCentered,
    quality: qList,
    midShoulder,
    midHip,
    grip2D,
    leadShoulder,
    leadElbow,
    leadWrist,
    trailShoulder,
    trailElbow,
    trailWrist,
    leadArm,
    trailArm,
    leadArmDeg,
    trailArmDeg,
  };
}

/**
 * Estimates S2D (median torso height in address window) according to formula 3.3.5:
 * S_2D = median( || (S_L + S_R)/2 - (H_L + H_R)/2 || )
 *
 * Falls back to median across early frames if address window is not yet finalized.
 */
export function estimateTorsoHeightS2D(
  frames: readonly CanonicalFrame[],
  addressWindowIndices?: readonly number[],
): number {
  const sampleIndices =
    addressWindowIndices && addressWindowIndices.length > 0
      ? addressWindowIndices
      : frames.slice(0, Math.min(frames.length, 30)).map((_, i) => i);

  const torsoHeights: number[] = [];
  for (const idx of sampleIndices) {
    const f = frames[idx];
    if (!f) continue;
    const dx = f.midShoulder.x - f.midHip.x;
    const dy = f.midShoulder.y - f.midHip.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      torsoHeights.push(dist);
    }
  }

  if (torsoHeights.length === 0) return 0.25; // Safe default fallback in normalized coords
  torsoHeights.sort((a, b) => a - b);
  const mid = Math.floor(torsoHeights.length / 2);
  return torsoHeights.length % 2 !== 0
    ? torsoHeights[mid]
    : (torsoHeights[mid - 1] + torsoHeights[mid]) * 0.5;
}

/**
 * Canonicalizes an entire sequence of PoseFrames and computes S2D.
 */
export function canonicalizeSequence(
  rawFrames: readonly PoseFrame[],
  context: CaptureContext,
): CanonicalSequence {
  const canonicalFrames = rawFrames.map(f => canonicalizeFrame(f, context));
  const s2D = estimateTorsoHeightS2D(canonicalFrames);
  return {
    frames: canonicalFrames,
    s2D: Math.max(0.05, s2D),
    context,
  };
}
