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
export type PoseEngineProvider = 'MEDIAPIPE' | 'EXECUTORCH' | 'MOCK';

/** Configuration for pose engine creation. */
export interface PoseEngineConfig {
  readonly mode: PoseEngineMode;
  readonly provider?: PoseEngineProvider;
}

/** Result of checking real engine availability. */
export interface PoseEngineAvailability {
  readonly available: boolean;
  readonly provider: PoseEngineProvider | null;
  readonly reason: string;
}
