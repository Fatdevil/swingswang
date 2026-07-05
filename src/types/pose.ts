/**
 * pose.ts
 * SwingSwang
 *
 * Pose frame and timeline types.
 */

import { LandmarkID, PoseLandmark } from './landmarks';

/** A single pose detection result for one video frame. */
export interface PoseFrame {
  /** Timestamp in seconds from the start of the video. */
  readonly timestamp: number;
  /** Frame index in the analysis sequence (not video frame index). */
  readonly frameIndex: number;
  /** Detected landmarks, keyed by LandmarkID. Missing = not detected. */
  readonly landmarks: ReadonlyMap<LandmarkID, PoseLandmark>;
  /** Average confidence across all detected landmarks (0–1). */
  readonly averageConfidence: number;
  /** Number of landmarks detected in this frame. */
  readonly detectedCount: number;
  /** Number of landmarks that are missing. */
  readonly missingCount: number;
  /** Source image dimensions used for detection. */
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  /** Processing time for this frame in milliseconds. */
  readonly processingTimeMs: number;
}

/** Summary of landmark availability across a timeline. */
export interface LandmarkAvailabilitySummary {
  readonly landmarkId: LandmarkID;
  /** Ratio of frames where this landmark was detected (0–1). */
  readonly availability: number;
  /** Average confidence across frames where detected. */
  readonly averageConfidence: number;
}

/** Processing statistics for the analysis pipeline. */
export interface ProcessingStats {
  /** Total wall-clock time for the full analysis in milliseconds. */
  readonly totalTimeMs: number;
  /** Number of frames extracted from the video. */
  readonly framesExtracted: number;
  /** Number of frames successfully analyzed by pose engine. */
  readonly framesAnalyzed: number;
  /** Number of frames where no person was detected. */
  readonly framesEmpty: number;
  /** Number of reliable frames (confidence > 0.5). */
  readonly framesReliable: number;
  /** Average pose inference time per frame in milliseconds. */
  readonly averageFrameTimeMs: number;
  /** Analysis frame rate (frames per second of video). */
  readonly analysisFrameRate: number;
}

/** Analysis processing status. */
export type ProcessingStatus =
  | { type: 'idle' }
  | { type: 'selecting' }
  | { type: 'ready' }
  | { type: 'extracting'; progress: number }
  | { type: 'analyzing'; progress: number; framesComplete: number; framesTotal: number }
  | { type: 'calculating' }
  | { type: 'completed' }
  | { type: 'failed'; error: string };

/** Helper to get a display string for ProcessingStatus. */
export function statusDisplayText(status: ProcessingStatus): string {
  switch (status.type) {
    case 'idle': return 'Ready';
    case 'selecting': return 'Selecting video...';
    case 'ready': return 'Video loaded';
    case 'extracting': return `Extracting frames... ${Math.round(status.progress * 100)}%`;
    case 'analyzing': return `Pose detection... ${status.framesComplete}/${status.framesTotal}`;
    case 'calculating': return 'Calculating metrics...';
    case 'completed': return 'Analysis complete';
    case 'failed': return `Failed: ${status.error}`;
  }
}

/** Check if a status represents active processing. */
export function isProcessing(status: ProcessingStatus): boolean {
  return status.type === 'extracting' || status.type === 'analyzing' || status.type === 'calculating';
}

/** Get progress 0–1 from status, or null if not processing. */
export function statusProgress(status: ProcessingStatus): number | null {
  switch (status.type) {
    case 'extracting': return status.progress * 0.3; // 0–30%
    case 'analyzing': return 0.3 + (status.framesComplete / Math.max(status.framesTotal, 1)) * 0.6; // 30–90%
    case 'calculating': return 0.95;
    case 'completed': return 1.0;
    default: return null;
  }
}
