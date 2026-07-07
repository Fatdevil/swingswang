/**
 * types.ts
 * SwingSwang – Pose Stabilization Engine
 *
 * Configuration, metadata, and result types for the stabilization pipeline.
 * All interfaces use readonly properties to enforce immutability.
 */

import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';

/**
 * Configurable parameters for the stabilization pipeline.
 * All values are PROVISIONAL defaults tuned for golf swing capture at ~30 fps.
 */
export interface StabilizationConfig {
  /** Minimum landmark confidence to keep (below → filtered out). */
  readonly minLandmarkConfidence: number;
  /** Velocity threshold (normalized units/frame) above which a snap-back is an outlier. */
  readonly outlierVelocityThreshold: number;
  /** Maximum consecutive missing frames eligible for linear interpolation. */
  readonly maxInterpolationGap: number;
  /** EMA base alpha — used at zero velocity (maximum smoothing). */
  readonly smoothingBaseFactor: number;
  /** Controls how fast alpha decays with velocity (higher = faster decay). */
  readonly smoothingVelocityScale: number;
  /** Floor for alpha — fastest motion gets this much smoothing at minimum. */
  readonly minSmoothingFactor: number;
}

/** Sensible defaults for 30 fps golf-swing capture. */
export const DEFAULT_STABILIZATION_CONFIG: StabilizationConfig = {
  minLandmarkConfidence: 0.3,
  outlierVelocityThreshold: 0.15,
  maxInterpolationGap: 2,
  smoothingBaseFactor: 0.3,
  smoothingVelocityScale: 2.0,
  minSmoothingFactor: 0.05,
};

/** Metadata attached to every interpolated landmark. */
export interface InterpolationMetadata {
  readonly interpolated: true;
  readonly sourceConfidence: 0.0;
  /** Blended confidence based on bounding-frame quality and gap size. */
  readonly effectiveConfidence: number;
  /** Total number of missing frames in this gap. */
  readonly gapSize: number;
  /** 1-based position within the gap (1 = first interpolated frame). */
  readonly positionInGap: number;
}

/** Per-landmark stabilization details for a single frame. */
export interface LandmarkStabilityInfo {
  readonly landmarkId: LandmarkID;
  /** Original landmark data before stabilization (undefined if missing). */
  readonly original: PoseLandmark | undefined;
  /** Stabilized landmark data (undefined if removed / unrecoverable). */
  readonly stabilized: PoseLandmark | undefined;
  /** True if the landmark was removed due to low confidence. */
  readonly wasFiltered: boolean;
  /** True if the landmark was flagged as a single-frame spike. */
  readonly wasOutlier: boolean;
  /** True if the landmark was filled in via interpolation. */
  readonly wasInterpolated: boolean;
  /** Present only when wasInterpolated is true. */
  readonly interpolationMeta?: InterpolationMetadata;
}

/** A PoseFrame augmented with per-landmark stabilization metadata. */
export interface StabilizedPoseFrame extends PoseFrame {
  readonly stabilizationInfo: ReadonlyMap<LandmarkID, LandmarkStabilityInfo>;
}

/** Aggregate summary of what the stabilization pipeline did. */
export interface StabilizationReport {
  readonly totalFrames: number;
  readonly landmarksFiltered: number;
  readonly outliersDetected: number;
  readonly gapsInterpolated: number;
  /** Gaps that were too long and left as missing. */
  readonly gapsRejected: number;
  readonly smoothingApplied: boolean;
  readonly config: StabilizationConfig;
}
