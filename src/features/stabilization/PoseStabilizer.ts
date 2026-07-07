/**
 * PoseStabilizer.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Main orchestrator. Runs the full stabilization pipeline in order:
 *   1. Confidence-based filtering
 *   2. Velocity-based outlier detection
 *   3. Short-gap linear interpolation
 *   4. Velocity-adaptive EMA smoothing
 *
 * Each step is a pure function that returns new data — no mutation.
 */

import { PoseFrame } from '@/types/pose';
import {
  StabilizationConfig,
  DEFAULT_STABILIZATION_CONFIG,
  StabilizationReport,
} from './types';
import { filterByConfidence } from './PoseFilter';
import { detectOutliers } from './PoseOutlierDetector';
import { interpolateShortGaps } from './PoseInterpolator';
import { smoothLandmarks } from './PoseSmoother';

export interface StabilizationResult {
  readonly frames: PoseFrame[];
  readonly report: StabilizationReport;
}

/**
 * Run the full pose stabilization pipeline.
 *
 * @param frames  Raw pose frames from the detector.
 * @param config  Partial config — missing fields fall back to defaults.
 * @returns Stabilized frames and a report of what happened.
 */
export function stabilizePoseTimeline(
  frames: readonly PoseFrame[],
  config?: Partial<StabilizationConfig>,
): StabilizationResult {
  const mergedConfig: StabilizationConfig = {
    ...DEFAULT_STABILIZATION_CONFIG,
    ...config,
  };

  // Step 1: Filter low-confidence landmarks.
  const filterResult = filterByConfidence(frames, mergedConfig.minLandmarkConfidence);

  // Step 2: Detect and remove single-frame spike outliers.
  const outlierResult = detectOutliers(
    filterResult.frames,
    mergedConfig.outlierVelocityThreshold,
  );

  // Step 3: Interpolate short gaps.
  const interpResult = interpolateShortGaps(
    outlierResult.frames,
    mergedConfig.maxInterpolationGap,
  );

  // Step 4: Velocity-adaptive smoothing.
  const smoothedFrames = smoothLandmarks(
    interpResult.frames,
    mergedConfig.smoothingBaseFactor,
    mergedConfig.smoothingVelocityScale,
    mergedConfig.minSmoothingFactor,
  );

  const report: StabilizationReport = {
    totalFrames: frames.length,
    landmarksFiltered: filterResult.filteredCount,
    outliersDetected: outlierResult.outliersDetected,
    gapsInterpolated: interpResult.interpolatedCount,
    gapsRejected: interpResult.rejectedGaps,
    smoothingApplied: frames.length > 1,
    config: mergedConfig,
  };

  return { frames: smoothedFrames, report };
}
