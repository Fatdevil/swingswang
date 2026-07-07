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
} from './signalExtractors';

export {
  type EventDetectionConfig,
  DEFAULT_EVENT_DETECTION_CONFIG,
  RuleBasedSwingEventDetectorV1,
} from './RuleBasedSwingEventDetectorV1';
