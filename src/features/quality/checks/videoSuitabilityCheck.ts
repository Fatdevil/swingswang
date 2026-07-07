/**
 * videoSuitabilityCheck.ts
 * SwingSwang – Quality Gate
 *
 * Checks video-level properties:
 *   - Duration within acceptable range
 *   - Orientation (portrait preferred)
 *   - Resolution adequate for analysis
 */

import { VideoMetadata } from '@/types/video';
import { QUALITY_THRESHOLDS } from '@/config/analysisThresholds';
import { VideoSuitabilityResult, QualityStatus, QualityWarning } from '@/features/quality/types';

/**
 * Checks video metadata against quality requirements.
 *
 * Rules:
 *   - Duration < minVideoDuration   → FAIL
 *   - Duration > absoluteMaxDuration → FAIL
 *   - Duration > maxVideoDuration   → WARNING
 *   - Landscape orientation         → WARNING
 *   - Min dimension < minResolution → WARNING
 */
export function checkVideoSuitability(metadata: VideoMetadata): VideoSuitabilityResult {
  const {
    minVideoDuration,
    maxVideoDuration,
    absoluteMaxDuration,
    minResolution,
  } = QUALITY_THRESHOLDS;

  const warnings: QualityWarning[] = [];
  let status: QualityStatus = 'PASS';

  // ── Duration checks ───────────────────────────────────────────────

  if (metadata.duration < minVideoDuration) {
    status = 'FAIL';
    warnings.push({
      code: 'VIDEO_TOO_SHORT',
      message: `Video is too short (${metadata.duration.toFixed(1)}s). Minimum is ${minVideoDuration}s.`,
      severity: 'error',
    });
  } else if (metadata.duration > absoluteMaxDuration) {
    status = 'FAIL';
    warnings.push({
      code: 'VIDEO_TOO_LONG_HARD',
      message: `Video exceeds maximum duration (${metadata.duration.toFixed(1)}s). Maximum is ${absoluteMaxDuration}s.`,
      severity: 'error',
    });
  } else if (metadata.duration > maxVideoDuration) {
    if (status === 'PASS') status = 'WARNING';
    warnings.push({
      code: 'VIDEO_TOO_LONG',
      message: `Video is longer than recommended (${metadata.duration.toFixed(1)}s). Recommended max is ${maxVideoDuration}s.`,
      severity: 'warning',
    });
  }

  // ── Orientation check ─────────────────────────────────────────────

  if (metadata.orientation === 'landscape') {
    if (status === 'PASS') status = 'WARNING';
    warnings.push({
      code: 'LANDSCAPE_ORIENTATION',
      message: 'Landscape video detected. Portrait orientation is recommended for best results.',
      severity: 'warning',
    });
  }

  // ── Resolution check ──────────────────────────────────────────────

  const minDim = Math.min(metadata.width, metadata.height);
  if (minDim < minResolution) {
    if (status === 'PASS') status = 'WARNING';
    warnings.push({
      code: 'LOW_RESOLUTION',
      message: `Video resolution is low (${metadata.width}×${metadata.height}). Minimum recommended dimension is ${minResolution}px.`,
      severity: 'warning',
    });
  }

  // Confidence based on how well video meets suitability criteria
  const confidence = status === 'PASS' ? 1.0 : status === 'WARNING' ? 0.7 : 0.3;

  return {
    status,
    duration: metadata.duration,
    orientation: metadata.orientation,
    resolution: { width: metadata.width, height: metadata.height },
    confidence,
    warnings,
  };
}
