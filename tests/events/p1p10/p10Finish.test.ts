/**
 * p10Finish.test.ts
 * P10 must be found for amateur finishes too: a short hold that the clip cuts
 * off, or hands lowered right after the swing (previously missed at 15 fps or
 * placed ~350 ms late on the rest pose).
 */

import { P1P10EventDetector, LANDMARK_INDEX, PoseFrame } from '@/features/events/p1p10';
import { generateSyntheticSwing } from './testHelpers';

const WRISTS = [LANDMARK_INDEX.LEFT_WRIST, LANDMARK_INDEX.RIGHT_WRIST];

/** Lower both wrists by 0.35 (image y) over 300 ms starting at `fromMs`. */
function lowerHandsAfter(frames: PoseFrame[], fromMs: number): PoseFrame[] {
  return frames.map((f) => {
    const t = f.timestampUs / 1000;
    if (t < fromMs) return f;
    const image = f.image.map((l) => ({ ...l }));
    const p = Math.min(1, (t - fromMs) / 300);
    for (const i of WRISTS) image[i].y += 0.35 * p;
    return { ...f, image };
  });
}

describe('P10 finish detection for non-held finishes', () => {
  it.each([15, 30, 60])('held finish is an exact (plateau) detection at %i fps', (fps) => {
    const { frames, context, keyTimes } = generateSyntheticSwing({ fps, finishDurationMs: 500 });
    const p10 = new P1P10EventDetector().detect(frames, context).events.P10;
    expect(p10.status).toBe('DETECTED_EXACT');
    expect(Math.abs(p10.timestampMs! - keyTimes.finishStartMs)).toBeLessThan(120);
  });

  it.each([15, 30, 60])('short finish cut off by the clip end is still found at %i fps', (fps) => {
    const { frames, context, keyTimes } = generateSyntheticSwing({ fps, finishDurationMs: 150 });
    const p10 = new P1P10EventDetector().detect(frames, context).events.P10;
    expect(p10.status).not.toBe('ABSTAIN');
    expect(Math.abs(p10.timestampMs! - keyTimes.finishStartMs)).toBeLessThan(120);
  });

  it.each([15, 30, 60])('hands lowered right away: P10 at the finish, not the rest pose, at %i fps', (fps) => {
    const { frames, context, keyTimes } = generateSyntheticSwing({ fps, finishDurationMs: 600 });
    const result = new P1P10EventDetector().detect(lowerHandsAfter(frames, keyTimes.finishStartMs), context);
    const p10 = result.events.P10;
    expect(p10.status).toBe('DETECTED_PROXY');
    expect(p10.warnings).toContain('FINISH_NOT_HELD');
    expect(Math.abs(p10.timestampMs! - keyTimes.finishStartMs)).toBeLessThan(120);
  });
});
