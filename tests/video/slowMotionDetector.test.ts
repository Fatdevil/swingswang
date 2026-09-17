/**
 * slowMotionDetector.test.ts
 * SwingSwang – Tests
 *
 * Tests for automatic slow-motion detection and temporal normalization.
 */

import {
  detectSlowMotion,
  normalizeTimestampToRealSeconds,
  createManualSlowMotionInfo,
} from '@/features/video/slowMotionDetector';
import { VideoMetadata } from '@/types/video';

function makeMetadata(duration: number, frameRate: number | null = 30): VideoMetadata {
  return {
    duration,
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    frameRate,
    fileSize: 1024 * 1024 * 5,
    mimeType: 'video/mp4',
  };
}

describe('SlowMotionDetector', () => {
  describe('metadata-based detection', () => {
    it('detects raw 240 FPS from container frame rate', () => {
      const meta = makeMetadata(5.0, 240);
      const result = detectSlowMotion(meta);

      expect(result.isSlowMotion).toBe(true);
      expect(result.captureFps).toBe(240);
      expect(result.speedMultiplier).toBe(1.0); // raw fps does not need retiming
      expect(result.method).toBe('METADATA');
    });

    it('detects raw 120 FPS from container frame rate', () => {
      const meta = makeMetadata(5.0, 120);
      const result = detectSlowMotion(meta);

      expect(result.isSlowMotion).toBe(true);
      expect(result.captureFps).toBe(120);
      expect(result.speedMultiplier).toBe(1.0);
    });
  });

  describe('kinematic detection from motion duration', () => {
    it('identifies 240 FPS (8x) when swing motion takes 7.2 seconds', () => {
      const meta = makeMetadata(24.4, 30);
      // Active swing gesture in video is ~7.2s
      const result = detectSlowMotion(meta, 7.2);

      expect(result.isSlowMotion).toBe(true);
      expect(result.captureFps).toBe(240);
      expect(result.speedMultiplier).toBe(8.0);
      expect(result.method).toBe('KINEMATIC');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('identifies 120 FPS (4x) when swing motion takes 3.6 seconds', () => {
      const meta = makeMetadata(12.0, 30);
      const result = detectSlowMotion(meta, 3.6);

      expect(result.isSlowMotion).toBe(true);
      expect(result.captureFps).toBe(120);
      expect(result.speedMultiplier).toBe(4.0);
      expect(result.method).toBe('KINEMATIC');
    });

    it('identifies normal speed (1x) when swing motion takes 1.0 seconds', () => {
      const meta = makeMetadata(4.0, 30);
      const result = detectSlowMotion(meta, 1.0);

      expect(result.isSlowMotion).toBe(false);
      expect(result.captureFps).toBe(30);
      expect(result.speedMultiplier).toBe(1.0);
    });
  });

  describe('fallback duration heuristic', () => {
    it('suspects 240 FPS slow-motion for untrimmed 24.4s video without motion cues', () => {
      const meta = makeMetadata(24.4, 30);
      const result = detectSlowMotion(meta);

      expect(result.isSlowMotion).toBe(true);
      expect(result.captureFps).toBe(240);
      expect(result.speedMultiplier).toBe(8.0);
      expect(result.confidence).toBe(0.75);
    });

    it('defaults to normal speed for short standard clips', () => {
      const meta = makeMetadata(4.5, 30);
      const result = detectSlowMotion(meta);

      expect(result.isSlowMotion).toBe(false);
      expect(result.speedMultiplier).toBe(1.0);
    });
  });

  describe('timestamp normalization', () => {
    it('rescales 8x slow-motion timestamps to real elapsed seconds', () => {
      const slowMo = createManualSlowMotionInfo(240);
      // At 8x slow-mo, 16.0s in the video is 2.0s in real time
      const realSec = normalizeTimestampToRealSeconds(16.0, slowMo);
      expect(realSec).toBe(2.0);
    });

    it('rescales 4x slow-motion timestamps to real elapsed seconds', () => {
      const slowMo = createManualSlowMotionInfo(120);
      // At 4x slow-mo, 8.0s in the video is 2.0s in real time
      const realSec = normalizeTimestampToRealSeconds(8.0, slowMo);
      expect(realSec).toBe(2.0);
    });

    it('leaves normal 1x timestamps unchanged', () => {
      const normal = createManualSlowMotionInfo(30);
      expect(normalizeTimestampToRealSeconds(2.5, normal)).toBe(2.5);
      expect(normalizeTimestampToRealSeconds(2.5, undefined)).toBe(2.5);
    });
  });
});
