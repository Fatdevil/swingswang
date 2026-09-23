/**
 * downswingTracking.test.ts
 * Regression: the stabilized skeleton must follow the hands through the
 * downswing instead of lagging behind (previously ~15 % of frame height).
 */

import { LandmarkID } from '@/types/landmarks';
import { stabilizePoseTimeline } from '@/features/stabilization/PoseStabilizer';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { createTestPoseFrame } from '../helpers/poseFixtures';

/** Wrist y (image coords): address, backswing up, 250 ms downswing, follow-through. */
function wristY(t: number): number {
  if (t < 1.0) return 0.75;
  if (t < 1.8) return 0.75 - 0.45 * Math.sin(((t - 1.0) / 0.8) * (Math.PI / 2));
  if (t < 2.05) {
    const p = (t - 1.8) / 0.25;
    return 0.3 + 0.45 * p * p;
  }
  if (t < 2.45) return 0.75 - 0.45 * Math.sin(((t - 2.05) / 0.4) * (Math.PI / 2));
  return 0.3;
}

/** Deterministic pseudo-random jitter in [-amp, amp]. */
function jitter(i: number, amp: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * amp;
}

function buildFrames(fps: number, jitterAmp: number) {
  const n = Math.round(3 * fps);
  return Array.from({ length: n }, (_, i) =>
    createTestPoseFrame(i / fps, i, {
      [LandmarkID.leftWrist]: { x: 0.5, y: wristY(i / fps) + jitter(i, jitterAmp) },
    }),
  );
}

describe('Stabilized skeleton tracks the downswing', () => {
  it.each([15, 30, 60])('wrist stays within 2%% of frame height through the downswing at %i fps', (fps) => {
    const raw = buildFrames(fps, 0);
    const { frames } = stabilizePoseTimeline(raw);

    let maxErr = 0;
    frames.forEach((f, i) => {
      const t = raw[i].timestamp;
      if (t < 1.8 || t > 2.2) return;
      const y = f.landmarks.get(LandmarkID.leftWrist)!.y;
      maxErr = Math.max(maxErr, Math.abs(y - wristY(t)));
    });

    expect(maxErr).toBeLessThan(0.02);
  });

  it('still reduces jitter while the golfer is at address', () => {
    const raw = buildFrames(30, 0.006);
    const { frames } = stabilizePoseTimeline(raw);

    const range = (ys: number[]) => Math.max(...ys) - Math.min(...ys);
    const addr = (fs: typeof raw) =>
      fs
        .filter((f) => f.timestamp > 0.1 && f.timestamp < 0.9)
        .map((f) => f.landmarks.get(LandmarkID.leftWrist)!.y);

    expect(range(addr(frames))).toBeLessThan(range(addr(raw)) * 0.7);
  });
});

describe('PoseTimeline.poseAtTime', () => {
  const makeTimeline = (times: number[], ys: number[]) =>
    new PoseTimeline(
      times.map((t, i) => createTestPoseFrame(t, i, { [LandmarkID.leftWrist]: { x: 0.5, y: ys[i] } })),
      times.length,
      0,
      15,
    );

  it('interpolates landmarks between bracketing frames', () => {
    const tl = makeTimeline([0, 1 / 15, 2 / 15], [0.3, 0.5, 0.7]);
    const pose = tl.poseAtTime(0.5 / 15)!;
    expect(pose.landmarks.get(LandmarkID.leftWrist)!.y).toBeCloseTo(0.4, 6);
    expect(pose.timestamp).toBeCloseTo(0.5 / 15, 9);
  });

  it('returns the exact frame at a frame timestamp and clamps outside the range', () => {
    const tl = makeTimeline([0, 1 / 15, 2 / 15], [0.3, 0.5, 0.7]);
    expect(tl.poseAtTime(1 / 15)!.landmarks.get(LandmarkID.leftWrist)!.y).toBeCloseTo(0.5, 9);
    expect(tl.poseAtTime(-1)!.landmarks.get(LandmarkID.leftWrist)!.y).toBe(0.3);
    expect(tl.poseAtTime(5)!.landmarks.get(LandmarkID.leftWrist)!.y).toBe(0.7);
  });

  it('does not interpolate across a long gap of missed detections', () => {
    const tl = makeTimeline([0, 1 / 15, 2 / 15, 1.0], [0.3, 0.3, 0.3, 0.9]);
    const pose = tl.poseAtTime(0.2)!;
    expect(pose.landmarks.get(LandmarkID.leftWrist)!.y).toBe(0.3);
  });

  it('falls back to the nearest frame for a landmark missing on one side', () => {
    const frames = [
      createTestPoseFrame(0, 0, { [LandmarkID.leftWrist]: { x: 0.5, y: 0.3 } }),
      createTestPoseFrame(1 / 15, 1, { [LandmarkID.leftWrist]: null }),
    ];
    const tl = new PoseTimeline(frames, 2, 0, 15);
    const pose = tl.poseAtTime(0.2 / 15)!;
    expect(pose.landmarks.get(LandmarkID.leftWrist)!.y).toBe(0.3);
  });
});
