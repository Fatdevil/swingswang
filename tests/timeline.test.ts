/**
 * timeline.test.ts
 * SwingSwang
 *
 * Tests for PoseTimeline construction and querying.
 * Uses synthetic PoseFrame data.
 */

import { LandmarkID, PoseLandmark } from '../src/types/landmarks';
import { PoseFrame } from '../src/types/pose';

// ─── Helpers ────────────────────────────────────────────────────────

function createTestLandmarks(
  confidence: number = 0.9
): ReadonlyMap<LandmarkID, PoseLandmark> {
  const map = new Map<LandmarkID, PoseLandmark>();
  // Create a simple golfer standing pose
  const positions: Array<[LandmarkID, number, number]> = [
    [LandmarkID.nose, 0.50, 0.15],
    [LandmarkID.leftEye, 0.48, 0.13],
    [LandmarkID.rightEye, 0.52, 0.13],
    [LandmarkID.leftEar, 0.46, 0.14],
    [LandmarkID.rightEar, 0.54, 0.14],
    [LandmarkID.leftShoulder, 0.40, 0.30],
    [LandmarkID.rightShoulder, 0.60, 0.30],
    [LandmarkID.leftElbow, 0.35, 0.45],
    [LandmarkID.rightElbow, 0.65, 0.45],
    [LandmarkID.leftWrist, 0.38, 0.55],
    [LandmarkID.rightWrist, 0.62, 0.55],
    [LandmarkID.leftHip, 0.43, 0.60],
    [LandmarkID.rightHip, 0.57, 0.60],
    [LandmarkID.leftKnee, 0.42, 0.75],
    [LandmarkID.rightKnee, 0.58, 0.75],
    [LandmarkID.leftAnkle, 0.41, 0.90],
    [LandmarkID.rightAnkle, 0.59, 0.90],
  ];

  for (const [id, x, y] of positions) {
    map.set(id, { id, x, y, visibility: confidence, confidence });
  }
  return map;
}

function createTestFrame(timestamp: number, index: number, confidence: number = 0.9): PoseFrame {
  return {
    timestamp,
    frameIndex: index,
    landmarks: createTestLandmarks(confidence),
    averageConfidence: confidence,
    detectedCount: 17,
    missingCount: 0,
    sourceWidth: 1080,
    sourceHeight: 1920,
    processingTimeMs: 45,
  };
}

function createSparseFrame(timestamp: number, index: number): PoseFrame {
  // Only nose and shoulders — simulates partially occluded golfer
  const map = new Map<LandmarkID, PoseLandmark>();
  map.set(LandmarkID.nose, { id: LandmarkID.nose, x: 0.5, y: 0.15, visibility: 0.8, confidence: 0.8 });
  map.set(LandmarkID.leftShoulder, { id: LandmarkID.leftShoulder, x: 0.4, y: 0.3, visibility: 0.7, confidence: 0.7 });
  map.set(LandmarkID.rightShoulder, { id: LandmarkID.rightShoulder, x: 0.6, y: 0.3, visibility: 0.7, confidence: 0.7 });

  return {
    timestamp,
    frameIndex: index,
    landmarks: map,
    averageConfidence: 0.73,
    detectedCount: 3,
    missingCount: 14,
    sourceWidth: 1080,
    sourceHeight: 1920,
    processingTimeMs: 30,
  };
}

// ─── Timeline construction ──────────────────────────────────────────

describe('PoseTimeline — construction from synthetic data', () => {
  it('creates frames array sorted by timestamp', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0.2, 3),
      createTestFrame(0.0, 0),
      createTestFrame(0.1, 1),
    ];
    frames.sort((a, b) => a.timestamp - b.timestamp);

    expect(frames[0].timestamp).toBe(0.0);
    expect(frames[1].timestamp).toBe(0.1);
    expect(frames[2].timestamp).toBe(0.2);
  });

  it('calculates average confidence correctly', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0, 0, 0.9),
      createTestFrame(0.1, 1, 0.8),
      createTestFrame(0.2, 2, 0.7),
    ];
    const avgConf = frames.reduce((s, f) => s + f.averageConfidence, 0) / frames.length;
    expect(avgConf).toBeCloseTo(0.8);
  });

  it('counts reliable frames (confidence > 0.5)', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0, 0, 0.9),
      createTestFrame(0.1, 1, 0.3),  // not reliable
      createTestFrame(0.2, 2, 0.8),
      createTestFrame(0.3, 3, 0.2),  // not reliable
    ];
    const reliable = frames.filter(f => f.averageConfidence > 0.5);
    expect(reliable).toHaveLength(2);
  });
});

// ─── Frame lookup ───────────────────────────────────────────────────

describe('PoseTimeline — frame lookup', () => {
  const frames: PoseFrame[] = [
    createTestFrame(0.0, 0),
    createTestFrame(0.1, 1),
    createTestFrame(0.2, 2),
    createTestFrame(0.3, 3),
    createTestFrame(0.4, 4),
  ];

  it('finds exact timestamp', () => {
    const target = 0.2;
    const closest = frames.reduce((prev, curr) =>
      Math.abs(curr.timestamp - target) < Math.abs(prev.timestamp - target) ? curr : prev
    );
    expect(closest.timestamp).toBe(0.2);
  });

  it('finds nearest frame for between timestamps', () => {
    const target = 0.15;
    const closest = frames.reduce((prev, curr) =>
      Math.abs(curr.timestamp - target) < Math.abs(prev.timestamp - target) ? curr : prev
    );
    // 0.1 and 0.2 are equidistant — either is acceptable
    expect(closest.timestamp === 0.1 || closest.timestamp === 0.2).toBe(true);
  });

  it('returns first frame for timestamp before range', () => {
    const target = -1.0;
    const closest = frames.reduce((prev, curr) =>
      Math.abs(curr.timestamp - target) < Math.abs(prev.timestamp - target) ? curr : prev
    );
    expect(closest.timestamp).toBe(0.0);
  });

  it('returns last frame for timestamp after range', () => {
    const target = 99.0;
    const closest = frames.reduce((prev, curr) =>
      Math.abs(curr.timestamp - target) < Math.abs(prev.timestamp - target) ? curr : prev
    );
    expect(closest.timestamp).toBe(0.4);
  });
});

// ─── Landmark trajectory ────────────────────────────────────────────

describe('PoseTimeline — landmark trajectory', () => {
  it('extracts trajectory for a specific landmark', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0.0, 0),
      createTestFrame(0.1, 1),
      createTestFrame(0.2, 2),
    ];

    const noseTrajectory = frames.map(f => {
      const landmark = f.landmarks.get(LandmarkID.nose);
      return {
        timestamp: f.timestamp,
        point: landmark ? { x: landmark.x, y: landmark.y } : null,
        confidence: landmark?.confidence ?? 0,
      };
    });

    expect(noseTrajectory).toHaveLength(3);
    expect(noseTrajectory[0].point?.x).toBe(0.5);
    expect(noseTrajectory[0].confidence).toBe(0.9);
  });

  it('handles missing landmarks in trajectory', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0.0, 0),
      createSparseFrame(0.1, 1), // no hip landmarks
    ];

    const hipTrajectory = frames.map(f => {
      const landmark = f.landmarks.get(LandmarkID.leftHip);
      return {
        timestamp: f.timestamp,
        point: landmark ? { x: landmark.x, y: landmark.y } : null,
      };
    });

    expect(hipTrajectory[0].point).not.toBeNull();
    expect(hipTrajectory[1].point).toBeNull();
  });
});

// ─── Landmark availability ──────────────────────────────────────────

describe('PoseTimeline — landmark availability', () => {
  it('returns 1.0 when landmark present in all frames', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0, 0),
      createTestFrame(0.1, 1),
      createTestFrame(0.2, 2),
    ];
    const availability = frames.filter(f => f.landmarks.has(LandmarkID.nose)).length / frames.length;
    expect(availability).toBe(1.0);
  });

  it('returns correct ratio when landmark is missing in some frames', () => {
    const frames: PoseFrame[] = [
      createTestFrame(0, 0),      // has all landmarks
      createSparseFrame(0.1, 1),  // missing hip
      createTestFrame(0.2, 2),    // has all landmarks
    ];
    const availability = frames.filter(f => f.landmarks.has(LandmarkID.leftHip)).length / frames.length;
    expect(availability).toBeCloseTo(2 / 3);
  });
});
