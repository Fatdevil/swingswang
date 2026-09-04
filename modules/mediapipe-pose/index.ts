import MediaPipePoseModule from './src/MediaPipePoseModule';

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface PoseDetectionResult {
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  timestampMs: number;
}

export type ModelVariant = 'lite' | 'full' | 'heavy';

/**
 * Detect pose landmarks from an image file.
 * @param imageUri - Local file URI to the image
 * @param modelVariant - 'lite', 'full', or 'heavy'
 * @returns Array of detected poses (usually 1 for single person)
 */
export async function detectPose(
  imageUri: string,
  modelVariant: ModelVariant = 'lite'
): Promise<PoseDetectionResult[]> {
  return MediaPipePoseModule.detectPose(imageUri, modelVariant);
}

/**
 * Initialize the pose landmarker with a specific model variant.
 * Call this before detectPose for faster first inference.
 * @param modelVariant - 'lite', 'full', or 'heavy'
 */
export async function initialize(
  modelVariant: ModelVariant = 'lite'
): Promise<void> {
  return MediaPipePoseModule.initialize(modelVariant);
}

/**
 * Release the pose landmarker resources.
 */
export async function release(): Promise<void> {
  return MediaPipePoseModule.release();
}

/**
 * Check if the module is available in this build.
 */
export function isAvailable(): boolean {
  try {
    return !!MediaPipePoseModule;
  } catch {
    return false;
  }
}

export default MediaPipePoseModule;
