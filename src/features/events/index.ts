/**
 * index.ts
 * SwingSwang – Swing Event Detection
 *
 * Barrel exports for the events feature module.
 */

export {
  type SwingEventType,
  type SwingEvent,
  type SwingEventResult,
  type SwingEventDetector,
  SWING_EVENT_ORDER,
} from './types';

export {
  type HandCenterPoint,
  extractHandCenter,
  extractHandVelocity,
  extractHandDirection,
  extractShoulderSpan,
  extractHipLateralPosition,
  extractWristHeight,
  extractHandLateralOffset,
  extractTrailHeelLift,
  smoothSignal,
} from './signalExtractors';

export {
  type EventDetectionConfig,
  DEFAULT_EVENT_DETECTION_CONFIG,
  RuleBasedSwingEventDetectorV1,
} from './RuleBasedSwingEventDetectorV1';

export {
  P1P10TimelineAdapter,
  type P1P10SwingEventResult,
  mapCocoToMediaPipe33,
  timelineToP1P10Frames,
  p1p10ToSwingEventResult,
} from './p1p10/timelineAdapter';

export {
  P1P10EventDetector,
  type PoseFrame as P1P10PoseFrame,
  type Landmark as P1P10Landmark,
  type SequenceResult as P1P10SequenceResult,
  type SwingEvent as P1P10SwingEvent,
  type PipelineTrace as P1P10PipelineTrace,
  type PPosition,
  POSITIONS as P1P10_POSITIONS,
  POSE_ONLY_MODE_CAPS,
} from './p1p10';

