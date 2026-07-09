/**
 * cameraReadiness.ts
 * SwingSwang
 *
 * Checks golfer positioning and visibility for live camera readiness guide.
 */

import { PoseFrame } from '../../types/pose';
import { LandmarkID, isLandmarkVisible } from '../../types/landmarks';
import { CameraView } from '../../types/swing';

export type CameraReadinessStatus =
  | 'SEARCHING'
  | 'LOW_CONFIDENCE'
  | 'PARTIAL_BODY'
  | 'TOO_CLOSE'
  | 'TOO_FAR'
  | 'READY';

export interface CameraReadinessResult {
  status: CameraReadinessStatus;
  message: string;
  subtext: string;
  confidence: number;
  poseFrame: PoseFrame | null;
  color: 'red' | 'orange' | 'yellow' | 'green';
}

/**
 * Evaluates a single camera snapshot pose frame against golfer setup criteria.
 * Calculates confidence, joint visibility, and bounding boxes.
 */
export function evaluateCameraSnapshot(
  poseFrame: PoseFrame | null,
  view: CameraView
): CameraReadinessResult {
  // 1. Searching state (no frame or no landmarks)
  if (!poseFrame || poseFrame.detectedCount === 0) {
    return {
      status: 'SEARCHING',
      message: 'Searching for golfer...',
      subtext: 'Stand in view with your full body visible.',
      confidence: 0,
      poseFrame: null,
      color: 'red',
    };
  }

  // 2. Low confidence state
  if (poseFrame.averageConfidence < 0.65) {
    return {
      status: 'LOW_CONFIDENCE',
      message: 'Almost ready',
      subtext: 'Improve lighting or hold still.',
      confidence: poseFrame.averageConfidence,
      poseFrame,
      color: 'yellow',
    };
  }

  // 3. Landmark visibility checks
  const getVisible = (id: LandmarkID) => {
    const lm = poseFrame.landmarks.get(id);
    return isLandmarkVisible(lm);
  };

  const hasShoulders = getVisible(LandmarkID.leftShoulder) && getVisible(LandmarkID.rightShoulder);
  const hasHips = getVisible(LandmarkID.leftHip) && getVisible(LandmarkID.rightHip);
  const hasKnees = getVisible(LandmarkID.leftKnee) && getVisible(LandmarkID.rightKnee);
  const hasAnkles = getVisible(LandmarkID.leftAnkle) && getVisible(LandmarkID.rightAnkle);

  if (!hasShoulders || !hasHips) {
    return {
      status: 'PARTIAL_BODY',
      message: 'Golfer partly visible',
      subtext: 'Make sure your shoulders and hips are visible.',
      confidence: poseFrame.averageConfidence,
      poseFrame,
      color: 'orange',
    };
  }

  if (!hasKnees || !hasAnkles) {
    return {
      status: 'PARTIAL_BODY',
      message: 'Golfer partly visible',
      subtext: 'Make sure your feet and knees are visible in the frame.',
      confidence: poseFrame.averageConfidence,
      poseFrame,
      color: 'orange',
    };
  }

  // 4. Bounding box checks
  // Find min and max y coordinates of detected joints to determine golfer height and cutoff risk
  let minY = 1.0;
  let maxY = 0.0;
  let minX = 1.0;
  let maxX = 0.0;

  poseFrame.landmarks.forEach((lm) => {
    if (isLandmarkVisible(lm)) {
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
    }
  });

  const golferHeight = maxY - minY;

  // Too far check
  if (golferHeight < 0.3) {
    return {
      status: 'TOO_FAR',
      message: 'Golfer too far away',
      subtext: 'Move closer to the camera to fill the guide silhouette.',
      confidence: poseFrame.averageConfidence,
      poseFrame,
      color: 'orange',
    };
  }

  // Too close or cropping cutoff check
  if (golferHeight > 0.9 || minY < 0.05 || maxY > 0.95 || minX < 0.05 || maxX > 0.95) {
    return {
      status: 'TOO_CLOSE',
      message: 'Golfer too close',
      subtext: 'Move farther back so your full body is visible.',
      confidence: poseFrame.averageConfidence,
      poseFrame,
      color: 'orange',
    };
  }

  // 5. Ready state!
  return {
    status: 'READY',
    message: 'Golfer found! Ready to swing.',
    subtext: 'Hold still, then start your swing.',
    confidence: poseFrame.averageConfidence,
    poseFrame,
    color: 'green',
  };
}
