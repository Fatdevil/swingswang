/**
 * videoQualityEngine.test.ts
 * SwingSwang – Quality Gate Tests
 *
 * Tests for the video quality evaluation engine and its individual checks.
 */

import { LandmarkID } from '@/types/landmarks';
import { VideoMetadata } from '@/types/video';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { evaluateVideoQuality } from '@/features/quality/VideoQualityEngine';
import { QualityWarning, BodyRegionVisibility } from '@/features/quality/types';
import { createTestTimeline } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

/** Build a PoseTimeline from test frames. */
function buildTimeline(
  frameCount: number,
  options?: Parameters<typeof createTestTimeline>[1],
): PoseTimeline {
  const frames = createTestTimeline(frameCount, options);
  return new PoseTimeline(frames, frameCount, 1000, 15);
}

/** Default good-quality video metadata. */
function goodMetadata(overrides?: Partial<VideoMetadata>): VideoMetadata {
  return {
    duration: 5.0,
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    frameRate: 30,
    fileSize: 5_000_000,
    mimeType: 'video/mp4',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('VideoQualityEngine', () => {
  describe('Perfect quality video', () => {
    it('returns PASS with high confidence', () => {
      const timeline = buildTimeline(30); // 30 frames at 0.9 confidence
      const metadata = goodMetadata();
      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('PASS');
      expect(result.analysisRecommended).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.warnings).toHaveLength(0);

      expect(result.checks.bodyVisibility.status).toBe('PASS');
      expect(result.checks.golferSize.status).toBe('PASS');
      expect(result.checks.poseCoverage.status).toBe('PASS');
      expect(result.checks.videoSuitability.status).toBe('PASS');
    });
  });

  describe('Video too short', () => {
    it('returns FAIL with duration warning', () => {
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({ duration: 0.5 }); // Below 1.0s minimum

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('FAIL');
      expect(result.analysisRecommended).toBe(false);
      expect(result.checks.videoSuitability.status).toBe('FAIL');
      expect(result.warnings.some((w: QualityWarning) => w.code === 'VIDEO_TOO_SHORT')).toBe(true);
    });
  });

  describe('Video too long (recommended)', () => {
    it('returns WARNING for videos exceeding recommended duration', () => {
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({ duration: 20.0 }); // Exceeds 15s recommended

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('WARNING');
      expect(result.analysisRecommended).toBe(true);
      expect(result.checks.videoSuitability.status).toBe('WARNING');
      expect(result.warnings.some((w: QualityWarning) => w.code === 'VIDEO_TOO_LONG')).toBe(true);
    });
  });

  describe('Video too long (hard limit)', () => {
    it('returns FAIL for videos exceeding absolute maximum', () => {
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({ duration: 90.0 }); // Exceeds 60s absolute max

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('FAIL');
      expect(result.analysisRecommended).toBe(false);
      expect(result.checks.videoSuitability.status).toBe('FAIL');
      expect(result.warnings.some((w: QualityWarning) => w.code === 'VIDEO_TOO_LONG_HARD')).toBe(true);
    });
  });

  describe('Golfer too small', () => {
    it('returns WARNING with size info when landmarks are clustered', () => {
      // Place all landmarks in a tiny area (0.49–0.51 range)
      const overridesPerFrame: Record<number, Record<number, { x: number; y: number }>> = {};
      for (let i = 0; i < 30; i++) {
        const frameOverrides: Record<number, { x: number; y: number }> = {};
        for (let lmId = 0; lmId < 17; lmId++) {
          frameOverrides[lmId] = { x: 0.50, y: 0.50 };
        }
        overridesPerFrame[i] = frameOverrides;
      }

      const timeline = buildTimeline(30, { landmarkOverridesPerFrame: overridesPerFrame });
      const metadata = goodMetadata();

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.checks.golferSize.status).toBe('WARNING');
      expect(result.checks.golferSize.bodyRatio).toBeLessThan(0.15);
      expect(result.warnings.some((w: QualityWarning) => w.code === 'GOLFER_TOO_SMALL')).toBe(true);
    });
  });

  describe('Missing body regions', () => {
    it('returns WARNING when some body regions are missing in all frames', () => {
      // Exclude ankles and knees from all frames
      const excludePerFrame: Record<number, LandmarkID[]> = {};
      for (let i = 0; i < 30; i++) {
        excludePerFrame[i] = [
          LandmarkID.leftAnkle,
          LandmarkID.rightAnkle,
          LandmarkID.leftKnee,
          LandmarkID.rightKnee,
        ];
      }

      const timeline = buildTimeline(30, { excludeLandmarksPerFrame: excludePerFrame });
      const metadata = goodMetadata();

      const result = evaluateVideoQuality(timeline, metadata);

      // 2 regions fail (ankles, knees) → WARNING (not FAIL, since < 3)
      expect(result.checks.bodyVisibility.status).toBe('WARNING');
      expect(
        result.checks.bodyVisibility.regions.find((r: BodyRegionVisibility) => r.region === 'ankles')?.status,
      ).toBe('FAIL');
      expect(
        result.checks.bodyVisibility.regions.find((r: BodyRegionVisibility) => r.region === 'knees')?.status,
      ).toBe('FAIL');
      expect(result.warnings.some((w: QualityWarning) => w.code === 'LOW_REGION_VISIBILITY')).toBe(true);
    });
  });

  describe('Low frame coverage', () => {
    it('returns FAIL when too few reliable frames', () => {
      // Only 5 frames with low confidence → below minAnalyzableFrames (10)
      const timeline = buildTimeline(5, { defaultConfidence: 0.2 });
      const metadata = goodMetadata();

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.checks.poseCoverage.status).toBe('FAIL');
      expect(result.overallStatus).toBe('FAIL');
      expect(result.analysisRecommended).toBe(false);
      expect(result.warnings.some((w: QualityWarning) => w.code === 'TOO_FEW_RELIABLE_FRAMES')).toBe(true);
    });
  });

  describe('Landscape orientation', () => {
    it('returns WARNING for landscape video', () => {
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({
        orientation: 'landscape',
        width: 1920,
        height: 1080,
      });

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.checks.videoSuitability.status).toBe('WARNING');
      expect(result.warnings.some((w: QualityWarning) => w.code === 'LANDSCAPE_ORIENTATION')).toBe(true);
    });
  });

  describe('Low resolution', () => {
    it('returns WARNING for video below minimum resolution', () => {
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({ width: 320, height: 240 });

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.checks.videoSuitability.status).toBe('WARNING');
      expect(result.warnings.some((w: QualityWarning) => w.code === 'LOW_RESOLUTION')).toBe(true);
    });
  });

  describe('All checks combined', () => {
    it('aggregates multiple warnings correctly', () => {
      // Landscape + exceeds recommended duration + low resolution
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({
        duration: 20.0,
        orientation: 'landscape',
        width: 1920,
        height: 360,
      });

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('WARNING');
      expect(result.analysisRecommended).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings.some((w: QualityWarning) => w.code === 'VIDEO_TOO_LONG')).toBe(true);
      expect(result.warnings.some((w: QualityWarning) => w.code === 'LANDSCAPE_ORIENTATION')).toBe(true);
      expect(result.warnings.some((w: QualityWarning) => w.code === 'LOW_RESOLUTION')).toBe(true);
    });

    it('FAIL overrides WARNING in combined status', () => {
      // Too short (FAIL) + landscape (WARNING)
      const timeline = buildTimeline(30);
      const metadata = goodMetadata({
        duration: 0.3,
        orientation: 'landscape',
      });

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('FAIL');
      expect(result.analysisRecommended).toBe(false);
    });
  });

  describe('Empty timeline', () => {
    it('returns FAIL when no frames exist', () => {
      const timeline = buildTimeline(0);
      const metadata = goodMetadata();

      const result = evaluateVideoQuality(timeline, metadata);

      expect(result.overallStatus).toBe('FAIL');
      expect(result.analysisRecommended).toBe(false);
      expect(result.checks.bodyVisibility.status).toBe('FAIL');
      expect(result.checks.golferSize.status).toBe('FAIL');
      expect(result.checks.poseCoverage.status).toBe('FAIL');
    });
  });
});
