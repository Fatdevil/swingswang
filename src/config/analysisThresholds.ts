/**
 * analysisThresholds.ts
 * SwingSwang
 *
 * Centralized, configurable thresholds for the video quality gate.
 * ALL values are PROVISIONAL — tune after real pose data.
 */

export const QUALITY_THRESHOLDS = {
  /** PROVISIONAL — minimum bounding box / frame ratio */
  minBodyRatio: 0.15,

  /** PROVISIONAL — minimum per-landmark confidence */
  minLandmarkConfidence: 0.3,

  /** PROVISIONAL — minimum per-frame average confidence */
  minFrameConfidence: 0.5,

  /** PROVISIONAL — minimum reliable frames / total frames ratio */
  minReliableFrameRatio: 0.5,

  /** PROVISIONAL — absolute minimum usable frames */
  minAnalyzableFrames: 10,

  /** PROVISIONAL — minimum video duration in seconds */
  minVideoDuration: 1.0,

  /** PROVISIONAL — maximum recommended video duration in seconds */
  maxVideoDuration: 15.0,

  /** PROVISIONAL — absolute maximum video duration in seconds (hard limit) */
  absoluteMaxDuration: 60.0,

  /** PROVISIONAL — minimum pixel dimension (width or height) */
  minResolution: 480,

  /** PROVISIONAL — minimum availability per body region */
  bodyRegionVisibilityThreshold: 0.6,

  /** PROVISIONAL — if > 40% frames missing landmarks, warn */
  maxMissingFrameRatio: 0.4,

  /** PROVISIONAL — normalized jitter threshold for pose instability */
  poseInstabilityThreshold: 0.08,
} as const;
