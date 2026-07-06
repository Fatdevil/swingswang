/**
 * PoseEngine.ts
 * SwingSwang
 *
 * Replaceable pose estimation interface (adapter pattern).
 */

import { PoseFrame } from '../../types/pose';

/** Abstract interface for any pose estimation provider. */
export interface PoseEngine {
  /** Provider name (e.g., "ExecuTorch", "MediaPipe"). */
  readonly name: string;
  /** Provider version string. */
  readonly version: string;
  /** Number of landmarks this provider detects. */
  readonly landmarkCount: number;

  /** Initialize the pose engine (load model, allocate resources). */
  initialize(): Promise<void>;

  /**
   * Analyze a single frame image and return detected pose.
   * @param imageUri - Local file URI to an image (JPEG/PNG).
   * @param timestamp - Video timestamp in seconds.
   * @param frameIndex - Sequential frame index.
   * @returns PoseFrame with detected landmarks, or null if no person detected.
   */
  analyzeFrame(imageUri: string, timestamp: number, frameIndex: number): Promise<PoseFrame | null>;

  /** Release resources. */
  dispose(): void;
}
