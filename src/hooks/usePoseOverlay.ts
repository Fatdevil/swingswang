/**
 * usePoseOverlay.ts
 * SwingSwang
 *
 * Provides the current PoseFrame from a PoseTimeline
 * based on the current video playback time.
 */

import { useMemo } from 'react';
import { PoseTimeline } from '../features/timeline/PoseTimeline';
import type { PoseFrame } from '../types/pose';

export interface UsePoseOverlayReturn {
  /** The current pose frame, or null if no timeline or no frame at time. */
  currentFrame: PoseFrame | null;
}

/**
 * Looks up the nearest PoseFrame from the timeline for the given time.
 *
 * @param timeline - PoseTimeline instance (or null if not yet available)
 * @param currentTime - Current video playback time in seconds
 */
export function usePoseOverlay(
  timeline: PoseTimeline | null,
  currentTime: number,
): UsePoseOverlayReturn {
  const currentFrame = useMemo(() => {
    if (!timeline) return null;
    return timeline.frameAtTime(currentTime);
  }, [timeline, currentTime]);

  return { currentFrame };
}
