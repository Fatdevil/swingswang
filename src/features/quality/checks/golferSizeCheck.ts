/**
 * golferSizeCheck.ts
 * SwingSwang – Quality Gate
 *
 * Estimates golfer size in frame by computing the bounding box ratio
 * of detected landmarks relative to the frame dimensions.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { golferSizeRatio, Point2D } from '@/utils/geometry';
import { QUALITY_THRESHOLDS } from '@/config/analysisThresholds';
import { GolferSizeResult, QualityStatus, QualityWarning } from '@/features/quality/types';

/**
 * Checks whether the golfer occupies enough of the frame for reliable analysis.
 *
 * Calculates the average golfer-to-frame bounding box ratio across all frames
 * and compares against the PROVISIONAL `minBodyRatio` threshold.
 */
export function checkGolferSize(timeline: PoseTimeline): GolferSizeResult {
  const { minBodyRatio } = QUALITY_THRESHOLDS;
  const frames = timeline.frames;

  if (frames.length === 0) {
    return {
      status: 'FAIL',
      bodyRatio: 0,
      confidence: 0,
      warnings: [
        {
          code: 'NO_FRAMES',
          message: 'No pose frames available for golfer size analysis.',
          severity: 'error',
        },
      ],
    };
  }

  let ratioSum = 0;
  let validFrames = 0;

  for (const frame of frames) {
    const points: Point2D[] = [];
    for (const lm of frame.landmarks.values()) {
      points.push({ x: lm.x, y: lm.y });
    }

    if (points.length === 0) continue;

    // Landmarks are normalized 0–1, so frame dimensions are 1×1 in normalized space
    const ratio = golferSizeRatio(points, 1, 1);
    ratioSum += ratio;
    validFrames++;
  }

  if (validFrames === 0) {
    return {
      status: 'FAIL',
      bodyRatio: 0,
      confidence: 0,
      warnings: [
        {
          code: 'NO_LANDMARKS',
          message: 'No landmarks detected in any frame for size estimation.',
          severity: 'error',
        },
      ],
    };
  }

  const avgRatio = ratioSum / validFrames;
  const warnings: QualityWarning[] = [];
  let status: QualityStatus;

  if (avgRatio < minBodyRatio) {
    status = 'WARNING';
    warnings.push({
      code: 'GOLFER_TOO_SMALL',
      message: `Golfer appears too small in frame (${(avgRatio * 100).toFixed(1)}% of frame, need ${(minBodyRatio * 100).toFixed(0)}%). Try recording closer to the golfer.`,
      severity: 'warning',
    });
  } else {
    status = 'PASS';
  }

  // Confidence scales linearly from 0 at 0 ratio to 1 at 2× threshold
  const confidence = Math.min(1, avgRatio / (minBodyRatio * 2));

  return {
    status,
    bodyRatio: avgRatio,
    confidence,
    warnings,
  };
}
