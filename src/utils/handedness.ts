/**
 * handedness.ts
 * SwingSwang
 *
 * Utility functions that resolve lead/trail body sides based on golfer handedness.
 *
 * For a RIGHT-handed golfer:
 *   Lead side = LEFT  (target side)
 *   Trail side = RIGHT
 *
 * For a LEFT-handed golfer:
 *   Lead side = RIGHT (target side)
 *   Trail side = LEFT
 */

import { GolferHandedness } from '@/types/swing';
import { LandmarkID, PoseLandmark } from '@/types/landmarks';

// ─── Core ID Resolvers ──────────────────────────────────────────────

/**
 * Given a pair of left/right landmark IDs, return the one on the lead side.
 * RIGHT-handed → lead = left body side.
 * LEFT-handed  → lead = right body side.
 */
export function getLeadLandmarkId(
  handedness: GolferHandedness,
  leftId: LandmarkID,
  rightId: LandmarkID,
): LandmarkID {
  return handedness === 'RIGHT' ? leftId : rightId;
}

/**
 * Given a pair of left/right landmark IDs, return the one on the trail side.
 * RIGHT-handed → trail = right body side.
 * LEFT-handed  → trail = left body side.
 */
export function getTrailLandmarkId(
  handedness: GolferHandedness,
  leftId: LandmarkID,
  rightId: LandmarkID,
): LandmarkID {
  return handedness === 'RIGHT' ? rightId : leftId;
}

// ─── Internal Helper ────────────────────────────────────────────────

function getLandmark(
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
  id: LandmarkID,
): PoseLandmark | undefined {
  return landmarks.get(id);
}

// ─── Shoulder ───────────────────────────────────────────────────────

export function getLeadShoulder(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getLeadLandmarkId(handedness, LandmarkID.leftShoulder, LandmarkID.rightShoulder),
  );
}

export function getTrailShoulder(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getTrailLandmarkId(handedness, LandmarkID.leftShoulder, LandmarkID.rightShoulder),
  );
}

// ─── Hip ────────────────────────────────────────────────────────────

export function getLeadHip(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getLeadLandmarkId(handedness, LandmarkID.leftHip, LandmarkID.rightHip),
  );
}

export function getTrailHip(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getTrailLandmarkId(handedness, LandmarkID.leftHip, LandmarkID.rightHip),
  );
}

// ─── Knee ───────────────────────────────────────────────────────────

export function getLeadKnee(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getLeadLandmarkId(handedness, LandmarkID.leftKnee, LandmarkID.rightKnee),
  );
}

export function getTrailKnee(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getTrailLandmarkId(handedness, LandmarkID.leftKnee, LandmarkID.rightKnee),
  );
}

// ─── Wrist ──────────────────────────────────────────────────────────

export function getLeadWrist(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getLeadLandmarkId(handedness, LandmarkID.leftWrist, LandmarkID.rightWrist),
  );
}

export function getTrailWrist(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getTrailLandmarkId(handedness, LandmarkID.leftWrist, LandmarkID.rightWrist),
  );
}

// ─── Elbow ──────────────────────────────────────────────────────────

export function getLeadElbow(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getLeadLandmarkId(handedness, LandmarkID.leftElbow, LandmarkID.rightElbow),
  );
}

export function getTrailElbow(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getTrailLandmarkId(handedness, LandmarkID.leftElbow, LandmarkID.rightElbow),
  );
}

// ─── Ankle ──────────────────────────────────────────────────────────

export function getLeadAnkle(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getLeadLandmarkId(handedness, LandmarkID.leftAnkle, LandmarkID.rightAnkle),
  );
}

export function getTrailAnkle(
  handedness: GolferHandedness,
  landmarks: ReadonlyMap<LandmarkID, PoseLandmark>,
): PoseLandmark | undefined {
  return getLandmark(
    landmarks,
    getTrailLandmarkId(handedness, LandmarkID.leftAnkle, LandmarkID.rightAnkle),
  );
}
