/**
 * Pose Stabilization Engine – public API
 */
export { stabilizePoseTimeline } from './PoseStabilizer';
export { filterByConfidence } from './PoseFilter';
export { detectOutliers } from './PoseOutlierDetector';
export { interpolateShortGaps } from './PoseInterpolator';
export { smoothLandmarks } from './PoseSmoother';
export {
  DEFAULT_STABILIZATION_CONFIG,
  type StabilizationConfig,
  type StabilizationReport,
  type StabilizedPoseFrame,
  type LandmarkStabilityInfo,
  type InterpolationMetadata,
} from './types';
