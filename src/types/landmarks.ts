/**
 * landmarks.ts
 * SwingSwang
 *
 * Canonical landmark identifiers for pose estimation.
 * Maps to COCO 17-keypoint format used by ExecuTorch.
 */

/** Canonical body landmark identifiers (COCO 17-keypoint format). */
export enum LandmarkID {
  nose = 0,
  leftEye = 1,
  rightEye = 2,
  leftEar = 3,
  rightEar = 4,
  leftShoulder = 5,
  rightShoulder = 6,
  leftElbow = 7,
  rightElbow = 8,
  leftWrist = 9,
  rightWrist = 10,
  leftHip = 11,
  rightHip = 12,
  leftKnee = 13,
  rightKnee = 14,
  leftAnkle = 15,
  rightAnkle = 16,
}

/** Total number of landmarks in COCO 17-keypoint format. */
export const LANDMARK_COUNT = 17;

/** Human-readable display names for each landmark. */
export const LANDMARK_NAMES: Record<LandmarkID, string> = {
  [LandmarkID.nose]: 'Nose',
  [LandmarkID.leftEye]: 'Left Eye',
  [LandmarkID.rightEye]: 'Right Eye',
  [LandmarkID.leftEar]: 'Left Ear',
  [LandmarkID.rightEar]: 'Right Ear',
  [LandmarkID.leftShoulder]: 'Left Shoulder',
  [LandmarkID.rightShoulder]: 'Right Shoulder',
  [LandmarkID.leftElbow]: 'Left Elbow',
  [LandmarkID.rightElbow]: 'Right Elbow',
  [LandmarkID.leftWrist]: 'Left Wrist',
  [LandmarkID.rightWrist]: 'Right Wrist',
  [LandmarkID.leftHip]: 'Left Hip',
  [LandmarkID.rightHip]: 'Right Hip',
  [LandmarkID.leftKnee]: 'Left Knee',
  [LandmarkID.rightKnee]: 'Right Knee',
  [LandmarkID.leftAnkle]: 'Left Ankle',
  [LandmarkID.rightAnkle]: 'Right Ankle',
};

/** A single detected landmark with position and confidence. */
export interface PoseLandmark {
  /** Canonical landmark identifier. */
  readonly id: LandmarkID;
  /** Normalized X position (0–1, left to right). */
  readonly x: number;
  /** Normalized Y position (0–1, top to bottom). */
  readonly y: number;
  /** Optional depth/Z coordinate (provider-dependent). */
  readonly z?: number;
  /** Visibility score (0–1). How visible is this joint? */
  readonly visibility: number;
  /** Detection confidence (0–1). How confident is the model? */
  readonly confidence: number;
}

/** Landmark groups used for metric calculations. */
export const HEAD_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.nose,
  LandmarkID.leftEye,
  LandmarkID.rightEye,
  LandmarkID.leftEar,
  LandmarkID.rightEar,
];

export const SHOULDER_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftShoulder,
  LandmarkID.rightShoulder,
];

export const HIP_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftHip,
  LandmarkID.rightHip,
];

/** Minimum confidence to consider a landmark as "visible". */
export const VISIBILITY_THRESHOLD = 0.3;

/** Check if a landmark is visible enough to use. */
export function isLandmarkVisible(
  landmark: PoseLandmark | undefined,
  minConfidence: number = VISIBILITY_THRESHOLD
): boolean {
  if (!landmark) return false;
  return landmark.confidence >= minConfidence && landmark.visibility >= minConfidence;
}
