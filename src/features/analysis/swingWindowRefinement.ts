/**
 * swingWindowRefinement.ts
 * SwingSwang – Analysis Pipeline
 *
 * Two-pass frame sampling: the whole clip is analyzed at ANALYSIS_FRAME_RATE,
 * then only the swing itself is densified to SWING_WINDOW_FRAME_RATE by
 * extracting the in-between frames. At 15 fps the ~250 ms downswing has only
 * ~4 frames, which is too few for P5–P7 and short finishes; doubling the rate
 * for the whole clip would double the analysis time, while the swing window
 * is only ~2–3 s of it.
 */

import { PoseFrame } from '@/types/pose';
import { SwingConfig } from '@/types/swing';
import { buildTimeline } from '@/features/timeline/timelineBuilder';
import { stabilizePoseTimeline } from '@/features/stabilization/PoseStabilizer';
import { P1P10TimelineAdapter } from '@/features/events';

export interface SwingWindow {
  readonly startTime: number; // media seconds
  readonly endTime: number;   // media seconds
}

/** Padding before the first and after the last detected event (seconds). */
const WINDOW_PAD_BEFORE_S = 0.2;
const WINDOW_PAD_AFTER_S = 0.4;

/**
 * Locate the swing in a coarse pose sequence by running the normal
 * stabilization + event detection on it. Returns null when fewer than two
 * events are found (no usable swing to refine).
 *
 * @param poseFrames Coarse frames with media `timestamp` and `realTimestamp` set.
 */
export function detectCoarseSwingWindow(
  poseFrames: readonly PoseFrame[],
  config: SwingConfig,
  analysisFps: number,
): SwingWindow | null {
  if (poseFrames.length < 5) return null;

  const stabilized = stabilizePoseTimeline(poseFrames).frames;
  const timeline = buildTimeline(stabilized, stabilized.length, 0, analysisFps);
  const result = new P1P10TimelineAdapter().detect(timeline, config);

  const times = result.events
    .map((e) => e.timestampMs)
    .filter((t): t is number => t !== null)
    .map((t) => t / 1000);
  if (times.length < 2) return null;

  return {
    startTime: Math.max(timeline.startTime, Math.min(...times) - WINDOW_PAD_BEFORE_S),
    endTime: Math.min(timeline.endTime, Math.max(...times) + WINDOW_PAD_AFTER_S),
  };
}

/**
 * Timestamps to add between the existing samples inside `window` so that the
 * window reaches `targetFps`. Existing samples are kept as-is; e.g. 15 → 30 fps
 * inserts one midpoint between each consecutive pair.
 */
export function computeRefinementTimestamps(
  baseTimestamps: readonly number[],
  window: SwingWindow,
  targetFps: number,
): number[] {
  const sorted = [...baseTimestamps].sort((a, b) => a - b);
  const extra: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (b < window.startTime || a > window.endTime) continue;
    const steps = Math.round((b - a) * targetFps);
    for (let k = 1; k < steps; k++) {
      extra.push(a + ((b - a) * k) / steps);
    }
  }

  return extra;
}

/** Merge coarse and refined frames in time order and renumber frameIndex. */
export function mergePoseFrames(
  coarse: readonly PoseFrame[],
  refined: readonly PoseFrame[],
): PoseFrame[] {
  return [...coarse, ...refined]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((f, i) => (f.frameIndex === i ? f : { ...f, frameIndex: i }));
}
