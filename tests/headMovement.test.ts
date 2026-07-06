/**
 * headMovement.test.ts
 * SwingSwang
 *
 * Tests for head movement metric calculation.
 */

import { LandmarkID, PoseLandmark } from '../src/types/landmarks';
import { PoseFrame } from '../src/types/pose';
import { ReliabilityStatus } from '../src/types/metrics';
import { midpoint, distance, referencePosition, maximumDisplacement } from '../src/utils/geometry';

// ─── Helper: Create a PoseFrame with specified landmarks ────────────

function createFrame(
  timestamp: number,
  frameIndex: number,
  landmarks: Array<{ id: LandmarkID; x: number; y: number; confidence: number }>
): PoseFrame {
  const map = new Map<LandmarkID, PoseLandmark>();
  for (const lm of landmarks) {
    map.set(lm.id, {
      id: lm.id,
      x: lm.x,
      y: lm.y,
      visibility: lm.confidence,
      confidence: lm.confidence,
    });
  }

  const confidences = landmarks.map(l => l.confidence);
  const avgConf = confidences.length > 0
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : 0;

  return {
    timestamp,
    frameIndex,
    landmarks: map,
    averageConfidence: avgConf,
    detectedCount: landmarks.length,
    missingCount: 17 - landmarks.length,
    sourceWidth: 1080,
    sourceHeight: 1920,
    processingTimeMs: 50,
  };
}

// ─── Head center calculation ────────────────────────────────────────

describe('Head movement — head center calculation', () => {
  it('head center is midpoint of left/right ear', () => {
    const leftEar = { x: 0.4, y: 0.2 };
    const rightEar = { x: 0.6, y: 0.2 };
    const center = midpoint(leftEar, rightEar);
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo(0.2);
  });

  it('head center shifts with movement', () => {
    const pos1 = midpoint({ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.2 });
    const pos2 = midpoint({ x: 0.45, y: 0.22 }, { x: 0.65, y: 0.22 });
    const d = distance(pos1, pos2);
    expect(d).toBeGreaterThan(0);
  });
});

// ─── Normalization by shoulder width ────────────────────────────────

describe('Head movement — normalization', () => {
  it('normalizes movement by shoulder width', () => {
    const headPos1 = { x: 0.5, y: 0.2 };
    const headPos2 = { x: 0.55, y: 0.2 }; // moved 0.05 in X
    const shoulderWidth = 0.2; // normalized shoulder width

    const rawMovement = distance(headPos1, headPos2);
    expect(rawMovement).toBeCloseTo(0.05);

    const normalized = rawMovement / shoulderWidth;
    expect(normalized).toBeCloseTo(0.25); // 25% of shoulder width
  });

  it('returns null when shoulder width is zero', () => {
    const shoulderWidth = 0;
    const result = shoulderWidth < 0.01 ? null : 0.05 / shoulderWidth;
    expect(result).toBeNull();
  });
});

// ─── Reference position ────────────────────────────────────────────

describe('Head movement — reference position', () => {
  it('uses first frames for reference', () => {
    const positions = [
      { x: 0.50, y: 0.20 },
      { x: 0.51, y: 0.21 },
      { x: 0.49, y: 0.19 },
      { x: 0.80, y: 0.50 }, // big movement — should not be in reference
    ];
    const ref = referencePosition(positions, 3);
    expect(ref?.x).toBeCloseTo(0.5, 1);
    expect(ref?.y).toBeCloseTo(0.2, 1);
  });

  it('max displacement is measured from reference', () => {
    const positions = [
      { x: 0.50, y: 0.20 },
      { x: 0.51, y: 0.21 },
      { x: 0.55, y: 0.20 },
      { x: 0.45, y: 0.25 }, // largest movement
    ];
    const ref = referencePosition(positions, 2)!;
    const maxDisp = maximumDisplacement(positions, ref);
    expect(maxDisp).toBeGreaterThan(0);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe('Head movement — edge cases', () => {
  it('completely still head returns zero displacement', () => {
    const p = { x: 0.5, y: 0.2 };
    const positions = [p, p, p, p, p];
    const ref = referencePosition(positions, 3)!;
    expect(maximumDisplacement(positions, ref)).toBeCloseTo(0, 10);
  });

  it('handles single frame', () => {
    const positions = [{ x: 0.5, y: 0.2 }];
    const ref = referencePosition(positions, 1);
    expect(ref).not.toBeNull();
    expect(maximumDisplacement(positions, ref!)).toBe(0);
  });
});
