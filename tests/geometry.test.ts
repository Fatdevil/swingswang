/**
 * geometry.test.ts
 * SwingSwang
 *
 * Tests for pure geometry functions.
 */

import {
  distance,
  midpoint,
  centroid,
  normalizedDistance,
  angleFromVertical,
  jointAngle,
  maximumDisplacement,
  referencePosition,
  positionalJitter,
  boundingBox,
  golferSizeRatio,
  mean,
  standardDeviation,
  coefficientOfVariation,
  Point2D,
} from '../src/utils/geometry';

// ─── distance ───────────────────────────────────────────────────────

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(0);
  });

  it('returns correct horizontal distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(1);
  });

  it('returns correct vertical distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(1);
  });

  it('returns correct diagonal distance (3-4-5 triangle)', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('handles negative coordinates', () => {
    expect(distance({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
  });
});

// ─── midpoint ───────────────────────────────────────────────────────

describe('midpoint', () => {
  it('returns correct midpoint', () => {
    const result = midpoint({ x: 0, y: 0 }, { x: 2, y: 4 });
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
  });

  it('returns same point for identical inputs', () => {
    const p = { x: 0.5, y: 0.3 };
    const result = midpoint(p, p);
    expect(result.x).toBe(0.5);
    expect(result.y).toBe(0.3);
  });

  it('handles normalized coordinates', () => {
    const result = midpoint({ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.4 });
    expect(result.x).toBeCloseTo(0.4);
    expect(result.y).toBeCloseTo(0.6);
  });
});

// ─── centroid ───────────────────────────────────────────────────────

describe('centroid', () => {
  it('returns null for empty array', () => {
    expect(centroid([])).toBeNull();
  });

  it('returns null when fewer than minimum required', () => {
    expect(centroid([{ x: 1, y: 1 }], 2)).toBeNull();
  });

  it('returns the single point for one point', () => {
    const result = centroid([{ x: 0.5, y: 0.3 }]);
    expect(result?.x).toBe(0.5);
    expect(result?.y).toBe(0.3);
  });

  it('returns correct centroid of three points', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 3 },
    ];
    const result = centroid(points);
    expect(result?.x).toBe(1);
    expect(result?.y).toBe(1);
  });
});

// ─── normalizedDistance ─────────────────────────────────────────────

describe('normalizedDistance', () => {
  it('returns null for zero reference', () => {
    expect(normalizedDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toBeNull();
  });

  it('returns null for near-zero reference', () => {
    expect(normalizedDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.005)).toBeNull();
  });

  it('returns 1.0 when distance equals reference', () => {
    expect(normalizedDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toBe(1);
  });

  it('returns 0.5 when distance is half reference', () => {
    expect(normalizedDistance({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 1)).toBeCloseTo(0.5);
  });

  it('returns 2.0 when distance is double reference', () => {
    expect(normalizedDistance({ x: 0, y: 0 }, { x: 2, y: 0 }, 1)).toBe(2);
  });
});

// ─── angleFromVertical ──────────────────────────────────────────────

describe('angleFromVertical', () => {
  it('returns 0 for straight vertical (upward in screen coords)', () => {
    // bottom at (0.5, 0.8), top at (0.5, 0.2) — straight up
    const angle = angleFromVertical({ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.2 });
    expect(angle).toBeCloseTo(0, 1);
  });

  it('returns positive for lean right', () => {
    const angle = angleFromVertical({ x: 0.5, y: 0.8 }, { x: 0.7, y: 0.2 });
    expect(angle).toBeGreaterThan(0);
  });

  it('returns negative for lean left', () => {
    const angle = angleFromVertical({ x: 0.5, y: 0.8 }, { x: 0.3, y: 0.2 });
    expect(angle).toBeLessThan(0);
  });

  it('returns 90 for horizontal right', () => {
    const angle = angleFromVertical({ x: 0.5, y: 0.5 }, { x: 1.0, y: 0.5 });
    expect(angle).toBeCloseTo(90, 0);
  });
});

// ─── jointAngle ─────────────────────────────────────────────────────

describe('jointAngle', () => {
  it('returns 90 for right angle', () => {
    const angle = jointAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(angle).toBeCloseTo(90, 1);
  });

  it('returns 180 for straight line', () => {
    const angle = jointAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(angle).toBeCloseTo(180, 1);
  });

  it('returns 0 for zero-length arm', () => {
    const angle = jointAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(angle).toBe(0);
  });
});

// ─── maximumDisplacement ────────────────────────────────────────────

describe('maximumDisplacement', () => {
  it('returns 0 for empty array', () => {
    expect(maximumDisplacement([], { x: 0, y: 0 })).toBe(0);
  });

  it('returns 0 when all positions are at reference', () => {
    const ref = { x: 0.5, y: 0.5 };
    expect(maximumDisplacement([ref, ref, ref], ref)).toBe(0);
  });

  it('returns correct maximum distance', () => {
    const ref = { x: 0, y: 0 };
    const positions = [
      { x: 1, y: 0 },
      { x: 3, y: 4 }, // distance 5 — max
      { x: 2, y: 0 },
    ];
    expect(maximumDisplacement(positions, ref)).toBe(5);
  });
});

// ─── referencePosition ──────────────────────────────────────────────

describe('referencePosition', () => {
  it('returns null for empty array', () => {
    expect(referencePosition([])).toBeNull();
  });

  it('uses first N positions for reference', () => {
    const positions = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 10, y: 10 }, // should NOT be included if firstCount=2
    ];
    const ref = referencePosition(positions, 2);
    expect(ref?.x).toBe(1);
    expect(ref?.y).toBe(1);
  });
});

// ─── positionalJitter ───────────────────────────────────────────────

describe('positionalJitter', () => {
  it('returns 0 for single point', () => {
    expect(positionalJitter([{ x: 0, y: 0 }])).toBe(0);
  });

  it('returns 0 for identical consecutive points', () => {
    const p = { x: 0.5, y: 0.5 };
    expect(positionalJitter([p, p, p])).toBe(0);
  });

  it('returns correct average displacement', () => {
    // 3 points: (0,0) → (1,0) → (2,0): displacements = [1, 1], avg = 1
    const jitter = positionalJitter([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(jitter).toBe(1);
  });
});

// ─── boundingBox ────────────────────────────────────────────────────

describe('boundingBox', () => {
  it('returns null for empty array', () => {
    expect(boundingBox([])).toBeNull();
  });

  it('returns correct box', () => {
    const box = boundingBox([
      { x: 0.2, y: 0.3 },
      { x: 0.8, y: 0.9 },
      { x: 0.5, y: 0.1 },
    ]);
    expect(box?.minX).toBe(0.2);
    expect(box?.maxX).toBe(0.8);
    expect(box?.minY).toBe(0.1);
    expect(box?.maxY).toBe(0.9);
    expect(box?.width).toBeCloseTo(0.6);
    expect(box?.height).toBeCloseTo(0.8);
  });
});

// ─── golferSizeRatio ────────────────────────────────────────────────

describe('golferSizeRatio', () => {
  it('returns 0 for empty points', () => {
    expect(golferSizeRatio([])).toBe(0);
  });

  it('returns 1.0 for full-frame coverage', () => {
    const ratio = golferSizeRatio([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(ratio).toBeCloseTo(1.0, 1);
  });
});

// ─── Statistics ─────────────────────────────────────────────────────

describe('mean', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('returns correct mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });
});

describe('standardDeviation', () => {
  it('returns 0 for single value', () => {
    expect(standardDeviation([5])).toBe(0);
  });

  it('returns 0 for identical values', () => {
    expect(standardDeviation([3, 3, 3])).toBe(0);
  });
});

describe('coefficientOfVariation', () => {
  it('returns 0 for near-zero mean', () => {
    expect(coefficientOfVariation([0, 0, 0])).toBe(0);
  });

  it('returns 0 for identical values', () => {
    expect(coefficientOfVariation([5, 5, 5])).toBe(0);
  });
});
