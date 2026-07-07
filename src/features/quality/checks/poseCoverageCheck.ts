/**
 * poseCoverageCheck.ts
 * SwingSwang – Quality Gate
 *
 * Calculates frame coverage statistics:
 *   - Total frames analyzed
 *   - Valid frames (have any detected landmarks)
 *   - Reliable frames (average confidence above threshold)
 *   - Reliable frame ratio
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { QUALITY_THRESHOLDS } from '@/config/analysisThresholds';
import { PoseCoverageResult, QualityStatus, QualityWarning } from '@/features/quality/types';

/**
 * Checks pose frame coverage quality.
 *
 * Evaluates the ratio of reliable (high-confidence) frames to total frames,
 * and verifies the absolute minimum analyzable frame count is met.
 */
export function checkPoseCoverage(timeline: PoseTimeline): PoseCoverageResult {
  const {
    minFrameConfidence,
    minReliableFrameRatio,
    minAnalyzableFrames,
  } = QUALITY_THRESHOLDS;

  const totalFrames = timeline.analyzedFrameCount;
  const warnings: QualityWarning[] = [];

  if (totalFrames === 0) {
    return {
      status: 'FAIL',
      totalFrames: 0,
      validFrames: 0,
      reliableFrames: 0,
      reliableRatio: 0,
      confidence: 0,
      warnings: [
        {
          code: 'NO_FRAMES',
          message: 'No frames were analyzed.',
          severity: 'error',
        },
      ],
    };
  }

  // Valid frames = have at least one detected landmark
  let validFrames = 0;
  let reliableFrames = 0;

  for (const frame of timeline.frames) {
    if (frame.detectedCount > 0) {
      validFrames++;
    }
    if (frame.averageConfidence >= minFrameConfidence) {
      reliableFrames++;
    }
  }

  const reliableRatio = reliableFrames / totalFrames;
  let status: QualityStatus = 'PASS';

  // Check absolute minimum
  if (reliableFrames < minAnalyzableFrames) {
    status = 'FAIL';
    warnings.push({
      code: 'TOO_FEW_RELIABLE_FRAMES',
      message: `Only ${reliableFrames} reliable frames detected (need at least ${minAnalyzableFrames}).`,
      severity: 'error',
    });
  }

  // Check reliable ratio
  if (reliableRatio < minReliableFrameRatio) {
    if (status !== 'FAIL') {
      status = 'WARNING';
    }
    warnings.push({
      code: 'LOW_RELIABLE_RATIO',
      message: `Only ${(reliableRatio * 100).toFixed(0)}% of frames are reliable (need ${(minReliableFrameRatio * 100).toFixed(0)}%).`,
      severity: 'warning',
    });
  }

  // Confidence based on reliable ratio
  const confidence = Math.min(1, reliableRatio / minReliableFrameRatio);

  return {
    status,
    totalFrames,
    validFrames,
    reliableFrames,
    reliableRatio,
    confidence: Math.min(1, confidence),
    warnings,
  };
}
