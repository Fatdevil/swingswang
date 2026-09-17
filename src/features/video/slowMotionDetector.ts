/**
 * slowMotionDetector.ts
 * SwingSwang – Video
 *
 * Automatic slow-motion detection and temporal normalization.
 * Identifies high-speed video capture (120 FPS / 240 FPS) from metadata
 * or physiological kinematic heuristics, and rescales timestamps to real-world seconds.
 */

import { VideoMetadata, SlowMotionInfo } from '@/types/video';
import { Logger } from '@/utils/logger';

/** Physiological duration of a human golf swing in real-world seconds (Takeaway to Impact). */
export const PHYSIOLOGICAL_SWING_DURATION_S = {
  MIN: 0.6,
  TYPICAL: 0.9,
  MAX: 1.6,
} as const;

/**
 * Detect slow-motion capture from metadata or active movement duration.
 *
 * @param metadata - Video metadata.
 * @param activeMotionDurationSeconds - Optional observed duration of the swing gesture in the video file.
 * @returns SlowMotionInfo with retiming multiplier and detection confidence.
 */
export function detectSlowMotion(
  metadata: VideoMetadata,
  activeMotionDurationSeconds?: number,
): SlowMotionInfo {
  // 1. Check explicit container frame rate (raw high-FPS video)
  if (metadata.frameRate && metadata.frameRate >= 100) {
    const is240 = metadata.frameRate >= 200;
    const captureFps = is240 ? 240 : 120;
    Logger.video.info('Slow-motion detected via container frame rate', { frameRate: metadata.frameRate, captureFps });
    return {
      isSlowMotion: true,
      captureFps,
      speedMultiplier: 1.0, // container is already raw 120/240 fps, no retiming needed
      method: 'METADATA',
      confidence: 0.99,
      description: `Raw high-speed video (${metadata.frameRate} FPS)`,
    };
  }

  // 2. Kinematic detection based on active swing movement duration
  if (activeMotionDurationSeconds !== undefined && activeMotionDurationSeconds > 0) {
    // 240 FPS retimed 8x: a ~0.9s swing takes ~7.2s in the video file
    if (activeMotionDurationSeconds >= 5.0 && activeMotionDurationSeconds <= 15.0) {
      Logger.video.info('Slow-motion detected kinematically: 240 FPS (8x retimed)', {
        motionDuration: activeMotionDurationSeconds,
      });
      return {
        isSlowMotion: true,
        captureFps: 240,
        speedMultiplier: 8.0,
        method: 'KINEMATIC',
        confidence: 0.92,
        description: '240 FPS Slow-Motion (8× utdragen)',
      };
    }

    // 120 FPS retimed 4x: a ~0.9s swing takes ~3.6s in the video file
    if (activeMotionDurationSeconds >= 2.2 && activeMotionDurationSeconds < 5.0) {
      Logger.video.info('Slow-motion detected kinematically: 120 FPS (4x retimed)', {
        motionDuration: activeMotionDurationSeconds,
      });
      return {
        isSlowMotion: true,
        captureFps: 120,
        speedMultiplier: 4.0,
        method: 'KINEMATIC',
        confidence: 0.88,
        description: '120 FPS Slow-Motion (4× utdragen)',
      };
    }

    // Normal speed (1x): swing takes < 2.2s in the video file
    return {
      isSlowMotion: false,
      captureFps: 30,
      speedMultiplier: 1.0,
      method: 'KINEMATIC',
      confidence: 0.95,
      description: 'Normal hastighet (1×)',
    };
  }

  // 3. Fallback: heuristic based on video duration
  // If a golf video is 20–45s long, it is overwhelmingly likely an untrimmed 240 FPS slo-mo capture
  if (metadata.duration >= 20.0 && metadata.duration <= 45.0) {
    Logger.video.info('Slow-motion suspected based on typical slo-mo duration', { duration: metadata.duration });
    return {
      isSlowMotion: true,
      captureFps: 240,
      speedMultiplier: 8.0,
      method: 'KINEMATIC',
      confidence: 0.75,
      description: 'Förmodad 240 FPS Slow-Motion (8× utdragen)',
    };
  }

  // Default: standard normal video
  return {
    isSlowMotion: false,
    captureFps: 30,
    speedMultiplier: 1.0,
    method: 'METADATA',
    confidence: 0.90,
    description: 'Normal hastighet (1×)',
  };
}

/**
 * Rescale a timestamp from video file time to real-world seconds.
 *
 * @param videoTimestamp - Timestamp in video file seconds.
 * @param slowMotion - Optional SlowMotionInfo.
 * @returns Real-world seconds elapsed.
 */
export function normalizeTimestampToRealSeconds(
  videoTimestamp: number,
  slowMotion?: SlowMotionInfo,
): number {
  if (!slowMotion || !slowMotion.isSlowMotion || slowMotion.speedMultiplier <= 0) {
    return videoTimestamp;
  }
  return videoTimestamp / slowMotion.speedMultiplier;
}

/**
 * Create a manual slow-motion override.
 */
export function createManualSlowMotionInfo(
  captureFps: 30 | 60 | 120 | 240,
): SlowMotionInfo {
  if (captureFps === 240) {
    return {
      isSlowMotion: true,
      captureFps: 240,
      speedMultiplier: 8.0,
      method: 'MANUAL',
      confidence: 1.0,
      description: 'Manuell 240 FPS (8× utdragen)',
    };
  }
  if (captureFps === 120) {
    return {
      isSlowMotion: true,
      captureFps: 120,
      speedMultiplier: 4.0,
      method: 'MANUAL',
      confidence: 1.0,
      description: 'Manuell 120 FPS (4× utdragen)',
    };
  }
  return {
    isSlowMotion: false,
    captureFps,
    speedMultiplier: 1.0,
    method: 'MANUAL',
    confidence: 1.0,
    description: `Manuell normal hastighet (${captureFps} FPS)`,
  };
}
