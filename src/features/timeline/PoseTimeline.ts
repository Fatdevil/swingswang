/**
 * PoseTimeline.ts
 * SwingSwang
 *
 * Ordered, queryable collection of pose frames.
 */

import { LandmarkID, PoseLandmark, isLandmarkVisible } from '../../types/landmarks';
import { PoseFrame } from '../../types/pose';
import { Point2D } from '../../utils/geometry';
import { MIN_FRAME_CONFIDENCE } from '../../constants/config';

/** Trajectory entry for a single landmark across time. */
export interface TrajectoryPoint {
  readonly timestamp: number;
  readonly point: Point2D | null;
  readonly confidence: number;
}

/** Pose timeline — ordered, queryable pose data. */
export class PoseTimeline {
  readonly frames: readonly PoseFrame[];
  readonly startTime: number;
  readonly endTime: number;
  readonly analyzedFPS: number;
  readonly totalFramesInVideo: number;
  readonly analyzedFrameCount: number;
  readonly reliableFrameCount: number;
  readonly averageConfidence: number;
  readonly processingDuration: number;

  constructor(
    frames: PoseFrame[],
    totalFramesInVideo: number,
    processingDurationMs: number,
    analysisFrameRate: number
  ) {
    // Sort by timestamp
    this.frames = [...frames].sort((a, b) => a.timestamp - b.timestamp);
    this.totalFramesInVideo = totalFramesInVideo;
    this.processingDuration = processingDurationMs;
    this.analyzedFPS = analysisFrameRate;
    this.analyzedFrameCount = frames.length;

    if (frames.length > 0) {
      this.startTime = this.frames[0].timestamp;
      this.endTime = this.frames[this.frames.length - 1].timestamp;

      let totalConf = 0;
      let reliableCount = 0;
      for (const f of this.frames) {
        totalConf += f.averageConfidence;
        if (f.averageConfidence >= MIN_FRAME_CONFIDENCE) {
          reliableCount++;
        }
      }
      this.averageConfidence = totalConf / frames.length;
      this.reliableFrameCount = reliableCount;
    } else {
      this.startTime = 0;
      this.endTime = 0;
      this.averageConfidence = 0;
      this.reliableFrameCount = 0;
    }
  }

  /**
   * Pose at an arbitrary playback time, linearly interpolated between the two
   * analyzed frames that bracket it. Showing the nearest frame instead is up to
   * half a frame interval off (33 ms at 15 fps), which in the downswing puts
   * the hands visibly behind the video.
   *
   * Falls back to the nearest frame outside the timeline, across gaps longer
   * than 2.5× the median frame interval (missed detections), and for landmarks
   * not present in both bracketing frames. frameIndex is the nearest frame's.
   */
  poseAtTime(timestamp: number): PoseFrame | null {
    const nearest = this.frameAtTime(timestamp);
    if (!nearest || this.frames.length < 2) return nearest;
    if (timestamp <= this.startTime || timestamp >= this.endTime) return nearest;

    let low = 0;
    let high = this.frames.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.frames[mid].timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    const hi = Math.max(1, low);
    const a = this.frames[hi - 1];
    const b = this.frames[hi];
    const span = b.timestamp - a.timestamp;
    if (span <= 0 || span > 2.5 * this.medianFrameInterval()) return nearest;

    const t = (timestamp - a.timestamp) / span;
    if (t <= 0) return a;
    if (t >= 1) return b;

    const landmarks = new Map<LandmarkID, PoseLandmark>();
    for (const [id, lmNearest] of nearest.landmarks) {
      const la = a.landmarks.get(id);
      const lb = b.landmarks.get(id);
      if (!la || !lb) {
        landmarks.set(id, lmNearest);
        continue;
      }
      landmarks.set(id, {
        ...lmNearest,
        x: la.x + (lb.x - la.x) * t,
        y: la.y + (lb.y - la.y) * t,
        z: la.z !== undefined && lb.z !== undefined ? la.z + (lb.z - la.z) * t : lmNearest.z,
      });
    }

    return { ...nearest, timestamp, landmarks };
  }

  private cachedMedianInterval: number | null = null;

  private medianFrameInterval(): number {
    if (this.cachedMedianInterval !== null) return this.cachedMedianInterval;
    const intervals: number[] = [];
    for (let i = 1; i < this.frames.length; i++) {
      intervals.push(this.frames[i].timestamp - this.frames[i - 1].timestamp);
    }
    intervals.sort((x, y) => x - y);
    this.cachedMedianInterval = intervals.length > 0 ? intervals[Math.floor(intervals.length / 2)] : 0;
    return this.cachedMedianInterval;
  }

  /** Find the nearest frame to a given timestamp (binary search). */
  frameAtTime(timestamp: number): PoseFrame | null {
    if (this.frames.length === 0) return null;
    if (this.frames.length === 1) return this.frames[0];

    // Binary search for nearest frame
    let low = 0;
    let high = this.frames.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.frames[mid].timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    // Compare with neighbor to find truly closest
    if (low > 0) {
      const prev = this.frames[low - 1];
      const curr = this.frames[low];
      if (Math.abs(prev.timestamp - timestamp) < Math.abs(curr.timestamp - timestamp)) {
        return prev;
      }
    }

    return this.frames[low];
  }

  /** Get all frames within a time range [start, end]. */
  framesInRange(start: number, end: number): PoseFrame[] {
    return this.frames.filter(f => f.timestamp >= start && f.timestamp <= end);
  }

  /** Get the trajectory (position over time) for a specific landmark. */
  trajectory(landmarkId: LandmarkID): TrajectoryPoint[] {
    return this.frames.map(frame => {
      const landmark = frame.landmarks.get(landmarkId);
      return {
        timestamp: frame.timestamp,
        point: landmark && isLandmarkVisible(landmark)
          ? { x: landmark.x, y: landmark.y }
          : null,
        confidence: landmark?.confidence ?? 0,
      };
    });
  }

  /** Fraction of frames where this landmark was detected and visible (0–1). */
  landmarkAvailability(landmarkId: LandmarkID): number {
    if (this.frames.length === 0) return 0;
    let available = 0;
    for (const frame of this.frames) {
      const lm = frame.landmarks.get(landmarkId);
      if (lm && isLandmarkVisible(lm)) {
        available++;
      }
    }
    return available / this.frames.length;
  }

  /** Get only the reliable frames (confidence > threshold). */
  get reliableFrames(): PoseFrame[] {
    return this.frames.filter(f => f.averageConfidence >= MIN_FRAME_CONFIDENCE);
  }
}
