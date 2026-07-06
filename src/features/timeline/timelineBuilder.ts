/**
 * timelineBuilder.ts
 * SwingSwang
 *
 * Builds a PoseTimeline from raw PoseFrame array.
 */

import { PoseFrame } from '../../types/pose';
import { PoseTimeline } from './PoseTimeline';
import { Logger } from '../../utils/logger';

/**
 * Build a PoseTimeline from raw analysis output.
 */
export function buildTimeline(
  frames: PoseFrame[],
  totalVideoFrames: number,
  processingDurationMs: number,
  analysisFrameRate: number
): PoseTimeline {
  Logger.pose.info(`Building timeline: ${frames.length} frames, ${totalVideoFrames} total video frames`);

  const timeline = new PoseTimeline(
    frames,
    totalVideoFrames,
    processingDurationMs,
    analysisFrameRate
  );

  Logger.pose.info('Timeline built', {
    analyzedFrames: timeline.analyzedFrameCount,
    reliableFrames: timeline.reliableFrameCount,
    averageConfidence: timeline.averageConfidence.toFixed(3),
    timeRange: `${timeline.startTime.toFixed(3)}s – ${timeline.endTime.toFixed(3)}s`,
  });

  return timeline;
}
