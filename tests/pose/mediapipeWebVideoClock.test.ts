/**
 * mediapipeWebVideoClock.test.ts
 * MediaPipe VIDEO mode rejects non-increasing timestamps ("Packet timestamp
 * mismatch"), so the web engine maps media time onto a strictly increasing clock.
 */

import { createVideoClock } from '@/features/pose/MediaPipeWebPoseEngine';

describe('createVideoClock', () => {
  it('keeps the real spacing between consecutive frames', () => {
    const next = createVideoClock();
    const ts = [0, 1 / 15, 2 / 15, 3 / 15].map(next);
    expect(ts).toEqual([0, 67, 133, 200]);
  });

  it('starts from the first frame even when a trimmed clip begins mid-video', () => {
    const next = createVideoClock();
    expect(next(4.2)).toBe(0);
    expect(next(4.2 + 1 / 60)).toBe(17);
  });

  it('never repeats a timestamp for closely spaced frames', () => {
    const next = createVideoClock();
    const ts = [0, 0.0001, 0.0002].map(next);
    expect(ts[1]).toBeGreaterThan(ts[0]);
    expect(ts[2]).toBeGreaterThan(ts[1]);
  });

  it('treats a non-advancing timestamp as a new sequence (new clip or one-off photo)', () => {
    const next = createVideoClock();
    const first = [0, 0.5, 1.0].map(next);
    const photoA = next(0);
    const photoB = next(0);
    expect(photoA).toBeGreaterThan(first[2]);
    expect(photoB).toBeGreaterThan(photoA);
  });
});
