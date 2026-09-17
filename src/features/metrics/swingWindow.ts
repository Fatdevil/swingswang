/**
 * swingWindow.ts
 * SwingSwang – Metrics
 *
 * Utilities for extracting active swing windows from timelines and events.
 * Confines spatial and rotational metrics to [ADDRESS, FINISH] to prevent
 * setup and exit movements from polluting swing calculations.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingEventResult } from '@/features/events/types';
import { PoseFrame } from '@/types/pose';

export interface SwingWindowInfo {
  readonly hasEvents: boolean;
  readonly addressFrameIndex: number | null;
  readonly finishFrameIndex: number | null;
  readonly windowFrames: readonly PoseFrame[];
  readonly reliableWindowFrames: readonly PoseFrame[];
}

/**
 * Extract the subset of frames representing the active swing window.
 * If reliable events are present, selects frames from ADDRESS to FINISH (or IMPACT_PROXY + buffer).
 * If events are missing or unreliable, falls back to the full timeline.
 */
export function extractSwingWindow(
  timeline: PoseTimeline,
  events?: SwingEventResult,
): SwingWindowInfo {
  if (!events || events.reliableCount === 0 || timeline.frames.length === 0) {
    return {
      hasEvents: false,
      addressFrameIndex: null,
      finishFrameIndex: null,
      windowFrames: timeline.frames,
      reliableWindowFrames: timeline.reliableFrames,
    };
  }

  const addressEvent = events.events.find(
    (e) => e.event === 'ADDRESS' && e.frameIndex !== null && e.status === 'RELIABLE',
  );
  const finishEvent = events.events.find(
    (e) => e.event === 'FINISH' && e.frameIndex !== null && e.status === 'RELIABLE',
  );
  const impactEvent = events.events.find(
    (e) => e.event === 'IMPACT_PROXY' && e.frameIndex !== null && e.status === 'RELIABLE',
  );

  const topEvent = events.events.find(
    (e) => e.event === 'TOP' && e.frameIndex !== null && e.status === 'RELIABLE',
  );

  // If no address event is found, we cannot reliably bound the start of the swing
  if (!addressEvent || addressEvent.frameIndex === null) {
    return {
      hasEvents: false,
      addressFrameIndex: null,
      finishFrameIndex: finishEvent?.frameIndex ?? null,
      windowFrames: timeline.frames,
      reliableWindowFrames: timeline.reliableFrames,
    };
  }

  // If neither FINISH, IMPACT, nor TOP is found, swing end is undefined
  if (
    (!finishEvent || finishEvent.frameIndex === null) &&
    (!impactEvent || impactEvent.frameIndex === null) &&
    (!topEvent || topEvent.frameIndex === null)
  ) {
    return {
      hasEvents: false,
      addressFrameIndex: addressEvent.frameIndex,
      finishFrameIndex: null,
      windowFrames: timeline.frames,
      reliableWindowFrames: timeline.reliableFrames,
    };
  }

  // Start frame: address frame with 1-frame pre-buffer if available
  const startIdx = Math.max(0, addressEvent.frameIndex - 1);

  // End frame: finish frame with post-buffer, or impact + 15 frames, or top + 30 frames
  let endIdx = timeline.frames.length - 1;
  if (finishEvent && finishEvent.frameIndex !== null) {
    endIdx = Math.min(timeline.frames.length - 1, finishEvent.frameIndex + 1);
  } else if (impactEvent && impactEvent.frameIndex !== null) {
    endIdx = Math.min(timeline.frames.length - 1, impactEvent.frameIndex + 15);
  } else if (topEvent && topEvent.frameIndex !== null) {
    endIdx = Math.min(timeline.frames.length - 1, topEvent.frameIndex + 30);
  }

  if (startIdx >= endIdx) {
    return {
      hasEvents: false,
      addressFrameIndex: addressEvent.frameIndex,
      finishFrameIndex: finishEvent?.frameIndex ?? null,
      windowFrames: timeline.frames,
      reliableWindowFrames: timeline.reliableFrames,
    };
  }

  const windowFrames = timeline.frames.slice(startIdx, endIdx + 1);
  const reliableWindowFrames = windowFrames.filter(
    (f) => f.averageConfidence >= 0.3 && f.detectedCount >= 3,
  );

  return {
    hasEvents: true,
    addressFrameIndex: addressEvent.frameIndex,
    finishFrameIndex: finishEvent?.frameIndex ?? null,
    windowFrames,
    reliableWindowFrames:
      reliableWindowFrames.length >= 3 ? reliableWindowFrames : timeline.reliableFrames,
  };
}

/**
 * Get reference frame(s) around the address position.
 * If addressFrameIndex is provided, extracts frames immediately surrounding it.
 * Otherwise falls back to the first N frames of the provided list.
 */
export function getAddressReferenceFrames(
  frames: readonly PoseFrame[],
  addressFrameIndex: number | null,
  fallbackCount: number,
): readonly PoseFrame[] {
  if (frames.length === 0) return [];

  if (addressFrameIndex !== null) {
    const idxInList = frames.findIndex((f) => f.frameIndex === addressFrameIndex);
    if (idxInList !== -1) {
      const start = Math.max(0, idxInList - 1);
      const end = Math.min(frames.length, idxInList + 2);
      const slice = frames.slice(start, end);
      if (slice.length > 0) return slice;
    }
  }

  return frames.slice(0, Math.min(frames.length, fallbackCount));
}
