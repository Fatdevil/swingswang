/**
 * bodyVisibilityCheck.ts
 * SwingSwang – Quality Gate
 *
 * Evaluates body region visibility across the pose timeline.
 * Groups landmarks into 7 anatomical regions and checks availability/confidence.
 */

import { LandmarkID, isLandmarkVisible } from '@/types/landmarks';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { QUALITY_THRESHOLDS } from '@/config/analysisThresholds';
import {
  BodyVisibilityResult,
  BodyRegionVisibility,
  QualityStatus,
  QualityWarning,
} from '@/features/quality/types';

// ─── Region Definitions ─────────────────────────────────────────────

interface BodyRegion {
  readonly name: string;
  readonly landmarks: readonly LandmarkID[];
}

const BODY_REGIONS: readonly BodyRegion[] = [
  {
    name: 'head',
    landmarks: [
      LandmarkID.nose,
      LandmarkID.leftEye,
      LandmarkID.rightEye,
      LandmarkID.leftEar,
      LandmarkID.rightEar,
    ],
  },
  {
    name: 'shoulders',
    landmarks: [LandmarkID.leftShoulder, LandmarkID.rightShoulder],
  },
  {
    name: 'elbows',
    landmarks: [LandmarkID.leftElbow, LandmarkID.rightElbow],
  },
  {
    name: 'wrists',
    landmarks: [LandmarkID.leftWrist, LandmarkID.rightWrist],
  },
  {
    name: 'hips',
    landmarks: [LandmarkID.leftHip, LandmarkID.rightHip],
  },
  {
    name: 'knees',
    landmarks: [LandmarkID.leftKnee, LandmarkID.rightKnee],
  },
  {
    name: 'ankles',
    landmarks: [LandmarkID.leftAnkle, LandmarkID.rightAnkle],
  },
];

// ─── Check Implementation ───────────────────────────────────────────

/**
 * Evaluates body region visibility from the pose timeline.
 *
 * For each region:
 *  - availability = ratio of frames where at least one landmark in the group is visible
 *  - averageConfidence = mean confidence across frames where detected
 *  - status: FAIL if below threshold, PASS otherwise
 */
export function checkBodyVisibility(timeline: PoseTimeline): BodyVisibilityResult {
  const { bodyRegionVisibilityThreshold, minLandmarkConfidence } = QUALITY_THRESHOLDS;
  const frames = timeline.frames;
  const totalFrames = frames.length;

  if (totalFrames === 0) {
    return {
      status: 'FAIL',
      confidence: 0,
      regions: BODY_REGIONS.map(r => ({
        region: r.name,
        availability: 0,
        averageConfidence: 0,
        status: 'FAIL' as QualityStatus,
      })),
      warnings: [
        {
          code: 'NO_FRAMES',
          message: 'No pose frames available for body visibility analysis.',
          severity: 'error',
        },
      ],
    };
  }

  const regions: BodyRegionVisibility[] = [];
  const warnings: QualityWarning[] = [];
  let failCount = 0;
  let totalAvailability = 0;

  for (const region of BODY_REGIONS) {
    let framesWithRegion = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const frame of frames) {
      let regionVisible = false;

      for (const landmarkId of region.landmarks) {
        const lm = frame.landmarks.get(landmarkId);
        if (lm && isLandmarkVisible(lm, minLandmarkConfidence)) {
          regionVisible = true;
          confidenceSum += lm.confidence;
          confidenceCount++;
        }
      }

      if (regionVisible) {
        framesWithRegion++;
      }
    }

    const availability = framesWithRegion / totalFrames;
    const averageConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
    const status: QualityStatus = availability >= bodyRegionVisibilityThreshold ? 'PASS' : 'FAIL';

    totalAvailability += availability;

    if (status === 'FAIL') {
      failCount++;
      warnings.push({
        code: 'LOW_REGION_VISIBILITY',
        message: `Body region '${region.name}' visible in only ${(availability * 100).toFixed(0)}% of frames (need ${(bodyRegionVisibilityThreshold * 100).toFixed(0)}%).`,
        severity: 'warning',
      });
    }

    regions.push({ region: region.name, availability, averageConfidence, status });
  }

  const avgAvailability = totalAvailability / BODY_REGIONS.length;
  const overallStatus: QualityStatus =
    failCount >= 3 ? 'FAIL' : failCount > 0 ? 'WARNING' : 'PASS';

  return {
    status: overallStatus,
    confidence: avgAvailability,
    regions,
    warnings,
  };
}
