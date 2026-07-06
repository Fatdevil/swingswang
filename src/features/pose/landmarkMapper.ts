/**
 * landmarkMapper.ts
 * SwingSwang
 *
 * Maps provider-specific landmark indices to canonical LandmarkID.
 */

import { LandmarkID, PoseLandmark, LANDMARK_COUNT } from '../../types/landmarks';
import { PoseFrame } from '../../types/pose';
import { pixelToNormalized } from '../../utils/coordinates';

/** Map COCO 17-keypoint index to canonical LandmarkID. Direct 1:1 mapping. */
export function mapCocoToLandmarkID(cocoIndex: number): LandmarkID | null {
  if (cocoIndex >= 0 && cocoIndex < LANDMARK_COUNT) {
    return cocoIndex as LandmarkID;
  }
  return null;
}

/** Raw keypoint from pose model output. */
export interface RawKeypoint {
  x: number;
  y: number;
  score: number;
}

/**
 * Map raw model output to a canonical PoseFrame.
 * @param keypoints - Array of raw keypoints from model (length 17 for COCO).
 * @param timestamp - Video timestamp in seconds.
 * @param frameIndex - Sequential frame index.
 * @param imageWidth - Source image width in pixels.
 * @param imageHeight - Source image height in pixels.
 * @param pixelCoords - If true, keypoints are in pixel coords and need normalization.
 */
export function mapPoseOutputToFrame(
  keypoints: RawKeypoint[],
  timestamp: number,
  frameIndex: number,
  imageWidth: number,
  imageHeight: number,
  pixelCoords: boolean = true
): PoseFrame {
  const landmarks = new Map<LandmarkID, PoseLandmark>();
  let totalConfidence = 0;
  let detectedCount = 0;

  for (let i = 0; i < keypoints.length; i++) {
    const id = mapCocoToLandmarkID(i);
    if (id === null) continue;

    const kp = keypoints[i];
    const confidence = kp.score;

    let nx: number, ny: number;
    if (pixelCoords) {
      const normalized = pixelToNormalized(kp.x, kp.y, imageWidth, imageHeight);
      nx = normalized.x;
      ny = normalized.y;
    } else {
      nx = kp.x;
      ny = kp.y;
    }

    landmarks.set(id, {
      id,
      x: nx,
      y: ny,
      visibility: confidence,
      confidence,
    });

    totalConfidence += confidence;
    detectedCount++;
  }

  const averageConfidence = detectedCount > 0 ? totalConfidence / detectedCount : 0;

  return {
    timestamp,
    frameIndex,
    landmarks,
    averageConfidence,
    detectedCount,
    missingCount: LANDMARK_COUNT - detectedCount,
    sourceWidth: imageWidth,
    sourceHeight: imageHeight,
    processingTimeMs: 0, // Set by caller
  };
}
