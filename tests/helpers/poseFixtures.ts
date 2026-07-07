/**
 * poseFixtures.ts
 * SwingSwang – Test Helpers
 *
 * Utility for creating full 17-landmark PoseFrames with sensible defaults
 * and easy per-landmark overrides.
 */

import { LandmarkID, LANDMARK_COUNT, PoseLandmark } from '@/types/landmarks';
import { PoseFrame } from '@/types/pose';

/** Default positions for a standard right-handed golfer at address (normalized 0–1). */
const DEFAULT_LANDMARK_POSITIONS: Record<LandmarkID, { x: number; y: number }> = {
  [LandmarkID.nose]:          { x: 0.50, y: 0.12 },
  [LandmarkID.leftEye]:       { x: 0.48, y: 0.10 },
  [LandmarkID.rightEye]:      { x: 0.52, y: 0.10 },
  [LandmarkID.leftEar]:       { x: 0.46, y: 0.12 },
  [LandmarkID.rightEar]:      { x: 0.54, y: 0.12 },
  [LandmarkID.leftShoulder]:  { x: 0.42, y: 0.25 },
  [LandmarkID.rightShoulder]: { x: 0.58, y: 0.25 },
  [LandmarkID.leftElbow]:     { x: 0.38, y: 0.40 },
  [LandmarkID.rightElbow]:    { x: 0.62, y: 0.40 },
  [LandmarkID.leftWrist]:     { x: 0.45, y: 0.50 },
  [LandmarkID.rightWrist]:    { x: 0.55, y: 0.50 },
  [LandmarkID.leftHip]:       { x: 0.45, y: 0.55 },
  [LandmarkID.rightHip]:      { x: 0.55, y: 0.55 },
  [LandmarkID.leftKnee]:      { x: 0.44, y: 0.72 },
  [LandmarkID.rightKnee]:     { x: 0.56, y: 0.72 },
  [LandmarkID.leftAnkle]:     { x: 0.43, y: 0.90 },
  [LandmarkID.rightAnkle]:    { x: 0.57, y: 0.90 },
};

/**
 * Create a full 17-landmark PoseFrame for testing.
 *
 * @param timestamp       Frame timestamp in seconds.
 * @param frameIndex      Frame index in the sequence.
 * @param landmarkOverrides  Optional per-landmark overrides for position,
 *                           confidence, and visibility. Omitted landmarks
 *                           get standard defaults (confidence 0.9, visibility 0.9).
 *                           Set a landmark to `null` to exclude it entirely.
 * @returns A valid PoseFrame.
 */
export function createTestPoseFrame(
  timestamp: number,
  frameIndex: number,
  landmarkOverrides?: Partial<
    Record<
      LandmarkID,
      | { x: number; y: number; confidence?: number; visibility?: number; z?: number }
      | null
    >
  >,
): PoseFrame {
  const landmarks = new Map<LandmarkID, PoseLandmark>();

  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const id = i as LandmarkID;

    // Check if this landmark was explicitly excluded.
    if (landmarkOverrides && landmarkOverrides[id] === null) {
      continue;
    }

    const override = landmarkOverrides?.[id] ?? undefined;
    const defaults = DEFAULT_LANDMARK_POSITIONS[id];

    const landmark: PoseLandmark = {
      id,
      x: override?.x ?? defaults.x,
      y: override?.y ?? defaults.y,
      z: override?.z,
      visibility: override?.visibility ?? 0.9,
      confidence: override?.confidence ?? 0.9,
    };

    landmarks.set(id, landmark);
  }

  // Compute stats.
  let totalConfidence = 0;
  for (const lm of landmarks.values()) {
    totalConfidence += lm.confidence;
  }

  return {
    timestamp,
    frameIndex,
    landmarks: landmarks as ReadonlyMap<LandmarkID, PoseLandmark>,
    averageConfidence: landmarks.size > 0 ? totalConfidence / landmarks.size : 0,
    detectedCount: landmarks.size,
    missingCount: LANDMARK_COUNT - landmarks.size,
    sourceWidth: 1080,
    sourceHeight: 1920,
    processingTimeMs: 16,
  };
}

/**
 * Create a sequence of identical pose frames for testing.
 * Useful for testing smoothing on stationary data.
 */
export function createStationarySequence(
  count: number,
  overrides?: Partial<
    Record<
      LandmarkID,
      | { x: number; y: number; confidence?: number; visibility?: number }
      | null
    >
  >,
): PoseFrame[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPoseFrame(i / 30, i, overrides),
  );
}

/**
 * Create an array of PoseFrames with per-frame overrides and exclusions.
 * Useful for constructing PoseTimeline test data with varying quality.
 *
 * @param frameCount - Number of frames to generate.
 * @param options - Per-frame overrides and timeline-level configuration.
 */
export function createTestTimeline(
  frameCount: number,
  options?: {
    startTime?: number;
    interval?: number;
    defaultConfidence?: number;
    defaultVisibility?: number;
    /** Per-frame landmark overrides keyed by frame index. */
    landmarkOverridesPerFrame?: Record<
      number,
      Partial<
        Record<
          LandmarkID,
          | { x: number; y: number; confidence?: number; visibility?: number }
          | null
        >
      >
    >;
    /** Per-frame landmark exclusions keyed by frame index. */
    excludeLandmarksPerFrame?: Record<number, LandmarkID[]>;
  },
): PoseFrame[] {
  const start = options?.startTime ?? 0;
  const interval = options?.interval ?? 1 / 15;
  const defaultConf = options?.defaultConfidence ?? 0.9;
  const defaultVis = options?.defaultVisibility ?? 0.9;
  const frames: PoseFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    // Build overrides for this frame: merge per-frame overrides + exclusions
    const perFrameOverrides = options?.landmarkOverridesPerFrame?.[i];
    const perFrameExclusions = options?.excludeLandmarksPerFrame?.[i];

    // Build a combined override object
    const combinedOverrides: Partial<
      Record<
        LandmarkID,
        | { x: number; y: number; confidence?: number; visibility?: number }
        | null
      >
    > = {};

    // Apply default confidence/visibility via overrides on all landmarks if non-default
    if (defaultConf !== 0.9 || defaultVis !== 0.9) {
      for (let lmId = 0; lmId < LANDMARK_COUNT; lmId++) {
        const id = lmId as LandmarkID;
        combinedOverrides[id] = {
          x: DEFAULT_LANDMARK_POSITIONS[id].x,
          y: DEFAULT_LANDMARK_POSITIONS[id].y,
          confidence: defaultConf,
          visibility: defaultVis,
        };
      }
    }

    // Layer per-frame overrides
    if (perFrameOverrides) {
      for (const [key, val] of Object.entries(perFrameOverrides)) {
        combinedOverrides[Number(key) as LandmarkID] = val;
      }
    }

    // Apply exclusions as null overrides
    if (perFrameExclusions) {
      for (const id of perFrameExclusions) {
        combinedOverrides[id] = null;
      }
    }

    const hasOverrides = Object.keys(combinedOverrides).length > 0;

    frames.push(
      createTestPoseFrame(
        start + i * interval,
        i,
        hasOverrides ? combinedOverrides : undefined,
      ),
    );
  }

  return frames;
}
