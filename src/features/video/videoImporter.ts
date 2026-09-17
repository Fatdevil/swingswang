/**
 * videoImporter.ts
 * SwingSwang
 *
 * Video selection and metadata extraction.
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoSource, VideoMetadata, VideoValidation } from '../../types/video';
import { Logger } from '../../utils/logger';
import {
  MAX_RECOMMENDED_DURATION,
  MAX_ABSOLUTE_DURATION,
  MIN_DURATION,
} from '../../constants/config';
import { detectSlowMotion } from './slowMotionDetector';

/**
 * Safely normalize video duration across Web and Native platforms.
 * - On Web: expo-image-picker returns duration in seconds (via HTML5 Video.duration).
 * - On Native: expo-image-picker returns duration in milliseconds (via MediaMetadataRetriever / AVAsset).
 */
export function normalizeDuration(rawDuration: number | null | undefined): number {
  if (!rawDuration || !Number.isFinite(rawDuration) || rawDuration <= 0) {
    return 0;
  }
  if (Platform.OS === 'web') {
    return rawDuration;
  }
  // On iOS / Android native modules, expo-image-picker returns milliseconds.
  // Any duration > 300 is definitely milliseconds (300s = 5 minutes).
  return rawDuration > 300 ? rawDuration / 1000 : rawDuration;
}

/**
 * Web-specific fallback to extract duration using an in-memory HTML5 video element.
 */
async function getWebVideoDuration(uri: string): Promise<number> {
  if (typeof document === 'undefined') return 0;
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.src = uri;
      video.preload = 'metadata';
      const timeout = setTimeout(() => resolve(0), 3000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(video.duration || 0);
      };
      video.onerror = () => {
        clearTimeout(timeout);
        resolve(0);
      };
    } catch {
      resolve(0);
    }
  });
}

/**
 * Open the device media library and let the user select a video.
 * @returns VideoSource with URI and metadata, or null if cancelled.
 */
export async function selectVideo(): Promise<VideoSource | null> {
  Logger.video.info('Opening video picker...');

  try {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Logger.video.warn('Media library permission denied');
      throw new Error('Permission to access media library was denied. Please enable it in Settings.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: MAX_ABSOLUTE_DURATION,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      Logger.video.info('Video selection cancelled by user');
      return null;
    }

    const asset = result.assets[0];
    Logger.video.info('Video selected', {
      uri: asset.uri.substring(0, 50) + '...',
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    });

    // Normalize duration according to platform
    let durationSeconds = normalizeDuration(asset.duration);
    if (durationSeconds <= 0) {
      Logger.video.info('Selected video duration is 0 or null. Attempting fallback duration extraction...');
      try {
        if (Platform.OS === 'web') {
          durationSeconds = await getWebVideoDuration(asset.uri);
        } else {
          durationSeconds = await getFallbackDuration(asset.uri);
        }
      } catch (err) {
        Logger.video.error('Fallback duration extraction error', { error: String(err) });
      }
    }

    const metadata = buildMetadata(asset, durationSeconds);

    return {
      uri: asset.uri,
      metadata,
    };
  } catch (error) {
    Logger.video.error('Video selection failed', { error: String(error) });
    throw error;
  }
}

/**
 * Asynchronously retrieve video duration using expo-video player
 * as a fallback if ImagePicker returns 0 or null duration on native platforms.
 */
async function getFallbackDuration(uri: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const { createVideoPlayer } = require('expo-video');
      if (!createVideoPlayer) {
        Logger.video.warn('createVideoPlayer not available in expo-video');
        resolve(0);
        return;
      }

      const player = createVideoPlayer(uri);
      if (!player) {
        resolve(0);
        return;
      }

      // Check if duration is already ready
      if (player.duration > 0) {
        const d = player.duration;
        try { player.release(); } catch (_) { /* ignore */ }
        resolve(d);
        return;
      }

      // Idempotent finish guard to prevent double resolve/release (Finding 10)
      let settled = false;
      let subscription: any = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const finish = (duration: number, source: string) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (subscription) {
          try { subscription.remove(); } catch (_) { /* ignore */ }
        }
        try { player.release(); } catch (_) { /* ignore */ }
        Logger.video.info(`Fallback duration resolved via ${source}: ${duration}s`);
        resolve(duration);
      };

      // Timeout fallback
      timeout = setTimeout(() => {
        const d = player.duration || 0;
        Logger.video.warn(`Fallback duration extraction timed out, using: ${d}s`);
        finish(d, 'timeout');
      }, 2000);

      subscription = player.addListener('statusChange', (status: string) => {
        if ((status === 'readyToPlay' || player.status === 'readyToPlay') && player.duration > 0) {
          finish(player.duration, 'statusChange');
        }
      });
    } catch (e) {
      Logger.video.error('Failed to get fallback duration from expo-video', { error: String(e) });
      resolve(0);
    }
  });
}

/** Build VideoMetadata from an ImagePicker asset. */
export function buildMetadata(asset: ImagePicker.ImagePickerAsset, durationOverride?: number): VideoMetadata {
  const width = asset.width || 0;
  const height = asset.height || 0;
  let duration = 0;

  if (durationOverride !== undefined && durationOverride > 0) {
    duration = durationOverride;
  } else if (asset.duration && asset.duration > 0) {
    duration = normalizeDuration(asset.duration);
  }

  const baseMetadata: VideoMetadata = {
    duration,
    width,
    height,
    orientation: width > height ? 'landscape' : 'portrait',
    frameRate: null, // ImagePicker doesn't provide frame rate
    fileSize: asset.fileSize ?? null,
    mimeType: asset.mimeType ?? null,
  };

  const slowMotion = detectSlowMotion(baseMetadata);

  return {
    ...baseMetadata,
    slowMotion,
  };
}

/**
 * Validate a video for swing analysis suitability.
 * Returns warnings and errors, never blocks outright unless truly invalid.
 */
export function validateVideo(metadata: VideoMetadata): VideoValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Duration checks
  if (metadata.duration <= 0) {
    errors.push('Could not determine video duration. Please ensure the video format is supported (e.g. MP4, MOV).');
  } else if (metadata.duration < MIN_DURATION) {
    errors.push(`Video is too short (${metadata.duration.toFixed(1)}s). Minimum is ${MIN_DURATION}s.`);
  }

  if (metadata.duration > MAX_ABSOLUTE_DURATION) {
    errors.push(`Video is too long (${metadata.duration.toFixed(0)}s). Maximum is ${MAX_ABSOLUTE_DURATION}s.`);
  }

  if (metadata.duration > MAX_RECOMMENDED_DURATION) {
    warnings.push(
      `Video is longer than recommended (${metadata.duration.toFixed(1)}s). ` +
      `For best results, trim to the swing (${MAX_RECOMMENDED_DURATION}s or less).`
    );
  }

  // Resolution checks
  const minDimension = Math.min(metadata.width, metadata.height);
  if (minDimension > 0 && minDimension < 480) {
    warnings.push('Video resolution is low. The golfer may be too small for reliable pose detection.');
  }

  // Orientation info
  if (metadata.orientation === 'landscape') {
    warnings.push('Landscape video detected. Portrait video usually gives better pose detection results.');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
