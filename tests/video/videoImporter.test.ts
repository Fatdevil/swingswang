jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

import { normalizeDuration, buildMetadata, validateVideo } from '@/features/video/videoImporter';
import { Platform } from 'react-native';

describe('videoImporter', () => {
  describe('normalizeDuration', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    });

    it('handles null, undefined, 0, and negative values', () => {
      expect(normalizeDuration(null)).toBe(0);
      expect(normalizeDuration(undefined)).toBe(0);
      expect(normalizeDuration(0)).toBe(0);
      expect(normalizeDuration(-5)).toBe(0);
      expect(normalizeDuration(NaN)).toBe(0);
    });

    it('normalizes duration correctly on Web (seconds preserved)', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      expect(normalizeDuration(3.5)).toBe(3.5);
      expect(normalizeDuration(24.424333)).toBe(24.424333);
      expect(normalizeDuration(0.8)).toBe(0.8);
    });

    it('normalizes duration correctly on Native (milliseconds converted to seconds)', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      expect(normalizeDuration(3500)).toBe(3.5);
      expect(normalizeDuration(24424)).toBe(24.424);
      // Durations <= 300 on native are treated as seconds already
      expect(normalizeDuration(4.5)).toBe(4.5);
    });
  });

  describe('buildMetadata', () => {
    it('constructs correct metadata from ImagePicker asset with durationOverride', () => {
      const asset: any = {
        uri: 'file://swing.mp4',
        width: 1080,
        height: 1920,
        duration: 3000,
        fileSize: 1024000,
        mimeType: 'video/mp4',
      };

      const metadata = buildMetadata(asset, 4.2);
      expect(metadata.duration).toBe(4.2);
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
      expect(metadata.orientation).toBe('portrait');
      expect(metadata.fileSize).toBe(1024000);
      expect(metadata.mimeType).toBe('video/mp4');
    });

    it('detects landscape orientation correctly', () => {
      const asset: any = {
        uri: 'file://swing.mp4',
        width: 1920,
        height: 1080,
      };

      const metadata = buildMetadata(asset, 3.0);
      expect(metadata.orientation).toBe('landscape');
    });
  });

  describe('validateVideo', () => {
    it('validates a standard golf swing video successfully', () => {
      const metadata = {
        duration: 3.5,
        width: 1080,
        height: 1920,
        orientation: 'portrait' as const,
        frameRate: null,
        fileSize: 5000000,
        mimeType: 'video/mp4',
      };

      const result = validateVideo(metadata);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('flags error for duration <= 0', () => {
      const metadata = {
        duration: 0,
        width: 1080,
        height: 1920,
        orientation: 'portrait' as const,
        frameRate: null,
        fileSize: null,
        mimeType: null,
      };

      const result = validateVideo(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Could not determine video duration');
    });

    it('flags error for video too short (< 0.5s)', () => {
      const metadata = {
        duration: 0.3,
        width: 1080,
        height: 1920,
        orientation: 'portrait' as const,
        frameRate: null,
        fileSize: null,
        mimeType: null,
      };

      const result = validateVideo(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Video is too short');
    });

    it('flags error for video too long (> 60s)', () => {
      const metadata = {
        duration: 65,
        width: 1080,
        height: 1920,
        orientation: 'portrait' as const,
        frameRate: null,
        fileSize: null,
        mimeType: null,
      };

      const result = validateVideo(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Video is too long');
    });

    it('warns for videos longer than recommended (> 10s)', () => {
      const metadata = {
        duration: 15,
        width: 1080,
        height: 1920,
        orientation: 'portrait' as const,
        frameRate: null,
        fileSize: null,
        mimeType: null,
      };

      const result = validateVideo(metadata);
      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('Video is longer than recommended');
    });
  });
});
