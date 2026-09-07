/**
 * MediaPipe Pose Landmarker — Expo Module JS API
 *
 * Wraps native Android (Kotlin) and iOS (Swift) MediaPipe Pose Landmarker
 * via Expo Modules API. Provides image detection and full video processing
 * with frame-accurate timestamps from the video decoder.
 *
 * License: Apache 2.0 (MediaPipe) — no AGPL/YOLO code.
 */
import MediaPipePoseModule from './src/MediaPipePoseModule';

// ── Types ────────────────────────────────────────────────────────────

export type MediaPipeModelVariant = 'lite' | 'full' | 'heavy';

export interface MediaPipeLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly visibility: number;
  readonly presence: number;
}

export interface MediaPipeFrameResult {
  readonly timestampMs: number;
  readonly landmarks: readonly MediaPipeLandmark[];
  readonly worldLandmarks: readonly MediaPipeLandmark[];
  readonly inferenceDurationMs: number;
}

export interface MediaPipeVideoResult {
  readonly frames: readonly MediaPipeFrameResult[];
  readonly sourceDurationMs: number;
  readonly decodedFrameCount: number;
  readonly processedFrameCount: number;
  readonly samplingSkippedFrameCount: number;
  readonly decodeDroppedFrameCount: number;
  readonly modelVariant: MediaPipeModelVariant;
}

// ── API ──────────────────────────────────────────────────────────────

/**
 * Check if MediaPipe Pose Landmarker is available for the given model variant.
 * Returns true if the native module is loaded AND the .task model file
 * exists in the app's assets.
 */
export async function isAvailable(
  modelVariant: MediaPipeModelVariant = 'lite'
): Promise<boolean> {
  try {
    if (!MediaPipePoseModule) return false;
    return await MediaPipePoseModule.isAvailable(modelVariant);
  } catch {
    return false;
  }
}

/**
 * Detect pose landmarks from a single image file.
 *
 * @param imageUri — Local file URI (file:// or content://)
 * @param modelVariant — 'lite', 'full', or 'heavy'
 * @returns Single frame result with 33 landmarks + world landmarks
 */
export async function detectImage(
  imageUri: string,
  modelVariant: MediaPipeModelVariant = 'lite'
): Promise<MediaPipeFrameResult> {
  if (!MediaPipePoseModule?.detectImage) {
    throw new Error('MediaPipePose is not available on this platform.');
  }
  return MediaPipePoseModule.detectImage(imageUri, modelVariant);
}

/**
 * Process a video file with native frame decoding and pose inference.
 *
 * Uses MediaExtractor + MediaCodec for frame-accurate timestamps
 * and MediaPipe PoseLandmarker in VIDEO running mode for temporal
 * tracking consistency.
 *
 * @param videoUri — Local file URI
 * @param modelVariant — 'lite', 'full', or 'heavy'
 * @param samplingPolicy — targetFps and optional maxFrames
 * @returns Video result with all processed frames and decode statistics
 */
export async function processVideo(
  videoUri: string,
  modelVariant: MediaPipeModelVariant = 'lite',
  samplingPolicy: {
    targetFps: number;
    maxFrames?: number;
  } = { targetFps: 15 }
): Promise<MediaPipeVideoResult> {
  if (!MediaPipePoseModule?.processVideo) {
    throw new Error('MediaPipePose is not available on this platform.');
  }
  return MediaPipePoseModule.processVideo(
    videoUri,
    modelVariant,
    samplingPolicy.targetFps,
    samplingPolicy.maxFrames ?? 0 // 0 = unlimited
  );
}

/**
 * Release all native PoseLandmarker resources.
 * Call when analysis is complete to free GPU/memory.
 */
export async function release(): Promise<void> {
  if (MediaPipePoseModule?.release) {
    return MediaPipePoseModule.release();
  }
}

export default MediaPipePoseModule;
