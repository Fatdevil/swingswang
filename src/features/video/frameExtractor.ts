/**
 * frameExtractor.ts
 * SwingSwang
 *
 * Extracts video frames as images at configurable intervals.
 */

// Risk 3 NOTE: expo-video-thumbnails is marked deprecated in Expo SDK 57.
// In a future release, migrate to expo-video's VideoPlayer.generateThumbnailsAsync.
// Currently, generateThumbnailsAsync requires an active player lifecycle and returns 
// native references, so expo-video-thumbnails remains the most reliable offline batch extractor for now.
import * as VideoThumbnails from 'expo-video-thumbnails';
import { FrameData } from '../../types/video';
import { ANALYSIS_FRAME_RATE, MAX_ABSOLUTE_DURATION } from '../../constants/config';
import { Logger, PerformanceTimer } from '../../utils/logger';

/**
 * Extract frames from a video at a configurable analysis frame rate.
 *
 * @param uri - Local video file URI.
 * @param duration - Video duration in seconds.
 * @param frameRate - Analysis frame rate (default: ANALYSIS_FRAME_RATE).
 * @param onProgress - Progress callback (0–1).
 * @param isCancelled - Optional function returning true if extraction should abort.
 * @returns Array of extracted FrameData with image URIs and timestamps.
 */
export async function extractFrames(
  uri: string,
  duration: number,
  frameRate: number = ANALYSIS_FRAME_RATE,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean
): Promise<FrameData[]> {
  const timer = new PerformanceTimer('extractFrames');

  // Enforce absolute maximum duration guardrail
  const safeDuration = Math.min(duration, MAX_ABSOLUTE_DURATION);

  // Calculate timestamps at the desired frame rate
  const intervalSeconds = 1.0 / frameRate;
  const timestamps: number[] = [];

  for (let t = 0; t < safeDuration; t += intervalSeconds) {
    timestamps.push(t);
  }

  Logger.video.info(`Extracting ${timestamps.length} frames at ${frameRate}fps from ${safeDuration.toFixed(1)}s video (original: ${duration.toFixed(1)}s)`);

  const frames: FrameData[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (isCancelled && isCancelled()) {
      Logger.video.info('Frame extraction cancelled by caller.');
      throw new Error('Frame extraction cancelled');
    }

    const timestamp = timestamps[i];
    const timeMs = Math.round(timestamp * 1000);

    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
        time: timeMs,
        quality: 0.8,
      });

      frames.push({
        imageUri: thumbnail.uri,
        timestamp,
        index: i,
      });
    } catch (error) {
      Logger.video.warn(`Failed to extract frame at ${timestamp.toFixed(3)}s: ${String(error)}`);
      // Continue — don't fail the whole extraction for one frame
    }

    onProgress?.((i + 1) / timestamps.length);
  }

  const elapsed = timer.stop();
  Logger.video.info(`Frame extraction complete: ${frames.length}/${timestamps.length} frames in ${elapsed.toFixed(0)}ms`);

  return frames;
}

/**
 * Generate an array of timestamps at a given frame rate.
 * Useful for testing or manual extraction.
 */
export function generateTimestamps(
  duration: number,
  frameRate: number = ANALYSIS_FRAME_RATE
): number[] {
  const timestamps: number[] = [];
  const interval = 1.0 / frameRate;
  for (let t = 0; t < duration; t += interval) {
    timestamps.push(Number(t.toFixed(4)));
  }
  return timestamps;
}
