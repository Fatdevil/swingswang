/**
 * config.ts
 * SwingSwang
 *
 * Analysis configuration constants.
 */

/** Frame rate used for pose analysis (frames per second of video). */
export const ANALYSIS_FRAME_RATE = 15;

/** Maximum recommended video duration in seconds. */
export const MAX_RECOMMENDED_DURATION = 10;

/** Absolute maximum video duration before rejection. */
export const MAX_ABSOLUTE_DURATION = 60;

/** Minimum video duration in seconds. */
export const MIN_DURATION = 0.5;

/** Minimum confidence to consider a landmark visible. */
export const MIN_LANDMARK_CONFIDENCE = 0.3;

/** Minimum confidence to consider a frame reliable. */
export const MIN_FRAME_CONFIDENCE = 0.5;

/** Number of initial frames to use as reference position (as ratio). */
export const REFERENCE_FRAME_RATIO = 0.1;

/** Minimum reference frames for reference position calculation. */
export const MIN_REFERENCE_FRAMES = 3;

/** Maximum reference frames for reference position calculation. */
export const MAX_REFERENCE_FRAMES = 10;

/** Confidence thresholds for reliability status. */
export const CONFIDENCE_THRESHOLDS = {
  reliable: 0.7,
  marginal: 0.4,
} as const;

/** Confidence factor weights. */
export const CONFIDENCE_WEIGHTS = {
  landmarkVisibility: 0.25,
  poseConfidence: 0.25,
  temporalCoverage: 0.20,
  temporalStability: 0.15,
  normalizerReliability: 0.10,
  golferSizeInFrame: 0.05,
} as const;

/** Jitter threshold for temporal stability mapping. */
export const JITTER_THRESHOLD = 0.02; // normalized units

/** Normalizer coefficient of variation threshold. */
export const NORMALIZER_CV_THRESHOLD = 0.5;
