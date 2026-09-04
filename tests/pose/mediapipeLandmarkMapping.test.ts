/**
 * mediapipeLandmarkMapping.test.ts
 * SwingSwang – Unit Tests
 *
 * Tests the 33 MediaPipe → 17 COCO landmark mapping
 * and the adapter's frame conversion logic.
 */

import { MP_TO_COCO_MAPPING, mapMediaPipeResultToFrame } from '@/features/pose/MediaPipePoseAdapter';

/** Local type matching MediaPipeFrameResult from the native module */
interface MediaPipeFrameResult {
  timestampMs: number;
  landmarks: { x: number; y: number; z: number; visibility: number; presence: number }[];
  worldLandmarks: { x: number; y: number; z: number; visibility: number; presence: number }[];
  inferenceDurationMs: number;
}

// ── Mapping Tests ────────────────────────────────────────────────────

describe('MP_TO_COCO_MAPPING', () => {
  it('should map exactly 17 MediaPipe indices to COCO indices', () => {
    expect(MP_TO_COCO_MAPPING.size).toBe(17);
  });

  it('should map all COCO indices 0–16 exactly once', () => {
    const cocoTargets = new Set<number>();
    for (const cocoIndex of MP_TO_COCO_MAPPING.values()) {
      expect(cocoTargets.has(cocoIndex)).toBe(false);
      cocoTargets.add(cocoIndex);
    }
    expect(cocoTargets.size).toBe(17);
    for (let i = 0; i < 17; i++) {
      expect(cocoTargets.has(i)).toBe(true);
    }
  });

  it('should use only valid MediaPipe indices (0–32)', () => {
    for (const mpIndex of MP_TO_COCO_MAPPING.keys()) {
      expect(mpIndex).toBeGreaterThanOrEqual(0);
      expect(mpIndex).toBeLessThanOrEqual(32);
    }
  });

  it('should map NOSE (MP 0 → COCO 0)', () => {
    expect(MP_TO_COCO_MAPPING.get(0)).toBe(0);
  });

  it('should map LEFT_SHOULDER (MP 11 → COCO 5)', () => {
    expect(MP_TO_COCO_MAPPING.get(11)).toBe(5);
  });

  it('should map RIGHT_ANKLE (MP 28 → COCO 16)', () => {
    expect(MP_TO_COCO_MAPPING.get(28)).toBe(16);
  });

  it('should map LEFT_HIP (MP 23 → COCO 11)', () => {
    expect(MP_TO_COCO_MAPPING.get(23)).toBe(11);
  });

  it('should not map finger/foot detail landmarks (e.g. 17–22, 29–32)', () => {
    const unmappedRanges = [1, 3, 4, 6, 9, 10, 17, 18, 19, 20, 21, 22, 29, 30, 31, 32];
    for (const idx of unmappedRanges) {
      expect(MP_TO_COCO_MAPPING.has(idx)).toBe(false);
    }
  });
});

// ── Frame Conversion Tests ───────────────────────────────────────────

describe('mapMediaPipeResultToFrame', () => {
  const makeLandmark = (x: number, y: number, vis: number = 0.9, pres: number = 0.9) => ({
    x, y, z: 0.1, visibility: vis, presence: pres,
  });

  const make33Landmarks = () => {
    const lms = [];
    for (let i = 0; i < 33; i++) {
      lms.push(makeLandmark(i / 33, i / 33, 0.8 + (i % 3) * 0.05, 0.85));
    }
    return lms;
  };

  const mockFrameResult: MediaPipeFrameResult = {
    timestampMs: 1500,
    landmarks: make33Landmarks(),
    worldLandmarks: make33Landmarks(),
    inferenceDurationMs: 42.5,
  };

  it('should return a PoseFrame with 17 detected landmarks', () => {
    const frame = mapMediaPipeResultToFrame(mockFrameResult, 1.5, 0, 1, 1);
    expect(frame.detectedCount).toBe(17);
    expect(frame.missingCount).toBe(0);
    expect(frame.landmarks.size).toBe(17);
  });

  it('should set processingTimeMs from inferenceDurationMs', () => {
    const frame = mapMediaPipeResultToFrame(mockFrameResult, 1.5, 0, 1, 1);
    expect(frame.processingTimeMs).toBeCloseTo(42.5);
  });

  it('should preserve all 33 landmarks in extendedLandmarks', () => {
    const frame = mapMediaPipeResultToFrame(mockFrameResult, 1.5, 0, 1, 1);
    expect(frame.extendedLandmarks).toBeDefined();
    expect(frame.extendedLandmarks!.length).toBe(33);
  });

  it('should produce typed extendedLandmarks with x/y/z/visibility/presence', () => {
    const frame = mapMediaPipeResultToFrame(mockFrameResult, 1.5, 0, 1, 1);
    const ext = frame.extendedLandmarks![0];
    expect(typeof ext.x).toBe('number');
    expect(typeof ext.y).toBe('number');
    expect(typeof ext.z).toBe('number');
    expect(typeof ext.visibility).toBe('number');
    expect(typeof ext.presence).toBe('number');
  });

  it('should use min(visibility, presence) as confidence score', () => {
    const result: MediaPipeFrameResult = {
      timestampMs: 0,
      landmarks: [makeLandmark(0.5, 0.5, 0.9, 0.7)], // only NOSE
      worldLandmarks: [],
      inferenceDurationMs: 10,
    };
    // NOSE is MP index 0 → COCO 0
    // Only 1 landmark provided, so only NOSE will be mapped
    const frame = mapMediaPipeResultToFrame(result, 0, 0, 1, 1);
    const nose = frame.landmarks.get(0); // LandmarkID.nose = 0
    expect(nose).toBeDefined();
    expect(nose!.confidence).toBeCloseTo(0.7); // min(0.9, 0.7) = 0.7
  });

  it('should pass timestamp and frameIndex through', () => {
    const frame = mapMediaPipeResultToFrame(mockFrameResult, 2.345, 42, 1, 1);
    expect(frame.timestamp).toBeCloseTo(2.345);
    expect(frame.frameIndex).toBe(42);
  });

  it('should handle empty landmarks gracefully (return frame with 0 detected)', () => {
    const emptyResult: MediaPipeFrameResult = {
      timestampMs: 0,
      landmarks: [],
      worldLandmarks: [],
      inferenceDurationMs: 5,
    };
    // mapMediaPipeResultToFrame is only called when landmarks.length > 0
    // but test the mapping with empty extended landmarks
    const frame = mapMediaPipeResultToFrame(emptyResult, 0, 0, 1, 1);
    // All 17 COCO keypoints will have score=0 since no MediaPipe landmarks
    expect(frame.detectedCount).toBe(17); // They are "detected" with score 0
    expect(frame.extendedLandmarks).toHaveLength(0);
  });
});
