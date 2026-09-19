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
import { Platform } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { FrameData } from '../../types/video';
import { ANALYSIS_FRAME_RATE, MAX_ABSOLUTE_DURATION } from '../../constants/config';
import { Logger, PerformanceTimer } from '../../utils/logger';

async function extractFramesWeb(
  uri: string,
  duration: number,
  safeFrameRate: number,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean,
  timeRange?: { startTime: number; endTime: number }
): Promise<FrameData[]> {
  const safeDuration = Math.min(duration, MAX_ABSOLUTE_DURATION);
  const intervalSeconds = 1.0 / safeFrameRate;
  const start = timeRange ? Math.max(0, timeRange.startTime) : 0;
  const end = timeRange ? Math.min(safeDuration, timeRange.endTime) : safeDuration;
  const timestamps: number[] = [];
  for (let t = start; t <= end; t += intervalSeconds) {
    timestamps.push(t);
  }

  const frames: FrameData[] = [];

  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = uri;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 3000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        resolve();
      };
    });

    const canvas = document.createElement('canvas');
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;
    const maxDim = 640;
    let width = vWidth;
    let height = vHeight;
    if (width > height) {
      if (width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < timestamps.length; i++) {
      if (isCancelled && isCancelled()) {
        throw new Error('Frame extraction cancelled');
      }
      const timestamp = timestamps[i];
      try {
        await new Promise<void>((resolve) => {
          let settled = false;
          const cleanup = () => {
            if (settled) return;
            settled = true;
            video.removeEventListener('seeked', onSeeked);
            clearTimeout(timeout);
          };

          const timeout = setTimeout(() => {
            cleanup();
            resolve();
          }, 600);

          const onSeeked = () => {
            cleanup();
            resolve();
          };

          video.addEventListener('seeked', onSeeked);
          video.currentTime = timestamp;
        });

        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const dataUri = canvas.toDataURL('image/jpeg', 0.7);
          frames.push({
            imageUri: dataUri,
            timestamp,
            index: i,
          });
        }
      } catch (frameErr) {
        Logger.video.warn(`Failed to capture frame at ${timestamp}s`, { error: String(frameErr) });
      }
      onProgress?.((i + 1) / timestamps.length);
    }
  } catch (err) {
    Logger.video.error('Web video extraction encountered an unrecoverable error', { error: String(err) });
    throw new Error(`Web video frame extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // If browser canvas extraction was blocked or returned 0 frames, fail explicitly
  if (frames.length === 0) {
    throw new Error('Web video frame extraction produced 0 frames: browser could not decode video');
  }

  return frames;
}

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
  isCancelled?: () => boolean,
  timeRange?: { startTime: number; endTime: number }
): Promise<FrameData[]> {
  // Validate numeric input arguments (Finding 11)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid video duration: ${duration}. Expected a finite positive number.`);
  }
  const safeFrameRate = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : ANALYSIS_FRAME_RATE;

  const timer = new PerformanceTimer('extractFrames');

  // If running in a web browser environment, use HTML5 video & canvas
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const frames = await extractFramesWeb(uri, duration, safeFrameRate, onProgress, isCancelled, timeRange);
    const elapsed = timer.stop();
    Logger.video.info(`Web frame extraction complete: ${frames.length} frames in ${elapsed.toFixed(0)}ms`);
    return frames;
  }

  // Enforce absolute maximum duration guardrail
  const safeDuration = Math.min(duration, MAX_ABSOLUTE_DURATION);

  // Calculate timestamps at the desired frame rate
  const intervalSeconds = 1.0 / safeFrameRate;
  const start = timeRange ? Math.max(0, timeRange.startTime) : 0;
  const end = timeRange ? Math.min(safeDuration, timeRange.endTime) : safeDuration;
  const timestamps: number[] = [];

  for (let t = start; t <= end; t += intervalSeconds) {
    timestamps.push(t);
  }

  Logger.video.info(`Extracting ${timestamps.length} frames at ${safeFrameRate}fps between ${start.toFixed(1)}s-${end.toFixed(1)}s from ${safeDuration.toFixed(1)}s video (original: ${duration.toFixed(1)}s)`);

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
