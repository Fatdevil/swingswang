/**
 * skeleton.ts
 * SwingSwang
 *
 * Bone connections for skeleton overlay drawing.
 */

import { LandmarkID } from '../types/landmarks';

/** A bone connection between two landmarks. */
export interface BoneConnection {
  readonly from: LandmarkID;
  readonly to: LandmarkID;
}

/** All bone connections for the COCO 17-keypoint skeleton. */
export const SKELETON_CONNECTIONS: readonly BoneConnection[] = [
  // Head
  { from: LandmarkID.leftEar, to: LandmarkID.leftEye },
  { from: LandmarkID.leftEye, to: LandmarkID.nose },
  { from: LandmarkID.nose, to: LandmarkID.rightEye },
  { from: LandmarkID.rightEye, to: LandmarkID.rightEar },

  // Torso
  { from: LandmarkID.leftShoulder, to: LandmarkID.rightShoulder },
  { from: LandmarkID.leftShoulder, to: LandmarkID.leftHip },
  { from: LandmarkID.rightShoulder, to: LandmarkID.rightHip },
  { from: LandmarkID.leftHip, to: LandmarkID.rightHip },

  // Left arm
  { from: LandmarkID.leftShoulder, to: LandmarkID.leftElbow },
  { from: LandmarkID.leftElbow, to: LandmarkID.leftWrist },

  // Right arm
  { from: LandmarkID.rightShoulder, to: LandmarkID.rightElbow },
  { from: LandmarkID.rightElbow, to: LandmarkID.rightWrist },

  // Left leg
  { from: LandmarkID.leftHip, to: LandmarkID.leftKnee },
  { from: LandmarkID.leftKnee, to: LandmarkID.leftAnkle },

  // Right leg
  { from: LandmarkID.rightHip, to: LandmarkID.rightKnee },
  { from: LandmarkID.rightKnee, to: LandmarkID.rightAnkle },
];

/** Color for left-side landmarks. */
export const LEFT_SIDE_COLOR = '#60A5FA'; // blue-400

/** Color for right-side landmarks. */
export const RIGHT_SIDE_COLOR = '#F87171'; // red-400

/** Color for center/head landmarks. */
export const CENTER_COLOR = '#A78BFA'; // violet-400

/** Default bone line width. */
export const BONE_LINE_WIDTH = 2.5;

/** Default joint circle radius. */
export const JOINT_RADIUS = 5;

/** Get the side color for a landmark. */
export function landmarkSideColor(id: LandmarkID): string {
  const name = LandmarkID[id];
  if (name.startsWith('left')) return LEFT_SIDE_COLOR;
  if (name.startsWith('right')) return RIGHT_SIDE_COLOR;
  return CENTER_COLOR;
}
