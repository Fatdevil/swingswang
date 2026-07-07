/**
 * types.ts
 * SwingSwang – Quality Gate
 *
 * Type definitions for video quality analysis results.
 */

/** Overall quality status for a check. */
export type QualityStatus = 'PASS' | 'WARNING' | 'FAIL';

/** A single quality warning or error. */
export interface QualityWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
}

/** Top-level result from the quality evaluation engine. */
export interface QualityCheckResult {
  readonly overallStatus: QualityStatus;
  /** Aggregate confidence score (0–1). */
  readonly confidence: number;
  readonly checks: {
    bodyVisibility: BodyVisibilityResult;
    golferSize: GolferSizeResult;
    poseCoverage: PoseCoverageResult;
    videoSuitability: VideoSuitabilityResult;
  };
  readonly warnings: QualityWarning[];
  /** True when quality is sufficient to proceed with analysis. */
  readonly analysisRecommended: boolean;
}

// ─── Individual Check Results ───────────────────────────────────────

export interface BodyVisibilityResult {
  readonly status: QualityStatus;
  readonly confidence: number;
  readonly regions: BodyRegionVisibility[];
  readonly warnings: QualityWarning[];
}

export interface BodyRegionVisibility {
  /** Body region name: 'head', 'shoulders', 'elbows', 'wrists', 'hips', 'knees', 'ankles' */
  readonly region: string;
  /** Ratio of frames where at least one landmark in this group is visible (0–1). */
  readonly availability: number;
  /** Average confidence across frames where the region is detected. */
  readonly averageConfidence: number;
  readonly status: QualityStatus;
}

export interface GolferSizeResult {
  readonly status: QualityStatus;
  /** Ratio of golfer bounding-box diagonal to frame diagonal. */
  readonly bodyRatio: number;
  readonly confidence: number;
  readonly warnings: QualityWarning[];
}

export interface PoseCoverageResult {
  readonly status: QualityStatus;
  readonly totalFrames: number;
  readonly validFrames: number;
  readonly reliableFrames: number;
  readonly reliableRatio: number;
  readonly confidence: number;
  readonly warnings: QualityWarning[];
}

export interface VideoSuitabilityResult {
  readonly status: QualityStatus;
  readonly duration: number;
  readonly orientation: string;
  readonly resolution: { width: number; height: number };
  readonly confidence: number;
  readonly warnings: QualityWarning[];
}
