/**
 * types.ts
 * SwingSwang – Pose Engine
 *
 * Configuration types for the pose engine factory.
 * Controls whether mock or real inference is used.
 */

/** Explicitly selects mock vs real analysis mode. */
export type PoseEngineMode = 'REAL' | 'MOCK';

/** Available pose engine providers. */
export type PoseEngineProvider = 'MEDIAPIPE' | 'MEDIAPIPE_WEB' | 'MOCK';

/** Configuration for pose engine creation. */
/** MediaPipe model variant selection. */
export type MediaPipeModelVariant = 'lite' | 'full' | 'heavy';

/** Configuration for pose engine creation. */
export interface PoseEngineConfig {
  readonly mode: PoseEngineMode;
  readonly provider?: PoseEngineProvider;
  /** MediaPipe model variant (default: 'lite'). Only used when provider is MEDIAPIPE. */
  readonly modelVariant?: MediaPipeModelVariant;
}

/** Result of checking real engine availability. */
export interface PoseEngineAvailability {
  readonly available: boolean;
  readonly provider: PoseEngineProvider | null;
  readonly reason: string;
}
