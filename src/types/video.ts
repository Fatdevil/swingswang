/**
 * video.ts
 * SwingSwang
 *
 * Video source and metadata types.
 */

/** Metadata extracted from an imported video. */
export interface VideoMetadata {
  /** Duration in seconds. */
  readonly duration: number;
  /** Video width in pixels (after orientation). */
  readonly width: number;
  /** Video height in pixels (after orientation). */
  readonly height: number;
  /** Detected orientation. */
  readonly orientation: 'portrait' | 'landscape';
  /** Frame rate if available (frames per second). */
  readonly frameRate: number | null;
  /** File size in bytes if available. */
  readonly fileSize: number | null;
  /** MIME type if available. */
  readonly mimeType: string | null;
}

/** A video ready for analysis. */
export interface VideoSource {
  /** Local URI to the video file. */
  readonly uri: string;
  /** Extracted metadata. */
  readonly metadata: VideoMetadata;
}

/** A single extracted frame for analysis. */
export interface FrameData {
  /** Local URI to the extracted frame image. */
  readonly imageUri: string;
  /** Timestamp in seconds from the start of the video. */
  readonly timestamp: number;
  /** Sequential index in the extraction sequence. */
  readonly index: number;
}

/** Video validation result. */
export interface VideoValidation {
  /** Whether the video is acceptable for analysis. */
  readonly isValid: boolean;
  /** Validation warnings (not blocking). */
  readonly warnings: string[];
  /** Validation errors (blocking). */
  readonly errors: string[];
}

/** Human-readable format helpers. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(0).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatResolution(width: number, height: number): string {
  return `${width} × ${height}`;
}
