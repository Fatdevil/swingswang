/**
 * hipProxy.test.ts
 * SwingSwang
 *
 * Tests for hip movement proxy metric.
 */

import { midpoint, distance, referencePosition, maximumDisplacement, normalizedDistance } from '../src/utils/geometry';

// ─── Hip midpoint tracking ──────────────────────────────────────────

describe('Hip proxy — midpoint tracking', () => {
  it('calculates hip midpoint correctly', () => {
    const leftHip = { x: 0.4, y: 0.6 };
    const rightHip = { x: 0.6, y: 0.6 };
    const mid = midpoint(leftHip, rightHip);
    expect(mid.x).toBeCloseTo(0.5);
    expect(mid.y).toBeCloseTo(0.6);
  });

  it('detects lateral hip sway', () => {
    const positions = [
      midpoint({ x: 0.40, y: 0.60 }, { x: 0.60, y: 0.60 }), // address
      midpoint({ x: 0.42, y: 0.60 }, { x: 0.62, y: 0.60 }), // slight sway
      midpoint({ x: 0.45, y: 0.60 }, { x: 0.65, y: 0.60 }), // more sway
    ];

    const ref = referencePosition(positions, 1)!;
    const maxDisp = maximumDisplacement(positions, ref);
    expect(maxDisp).toBeGreaterThan(0);
  });
});

// ─── Normalization by hip width ─────────────────────────────────────

describe('Hip proxy — normalization', () => {
  it('normalizes by hip width', () => {
    const leftHip = { x: 0.4, y: 0.6 };
    const rightHip = { x: 0.6, y: 0.6 };
    const hipWidth = distance(leftHip, rightHip); // 0.2

    const movement = { x: 0.55, y: 0.60 };
    const reference = { x: 0.50, y: 0.60 };
    const rawDisp = distance(movement, reference); // 0.05

    const normalized = normalizedDistance(movement, reference, hipWidth);
    expect(normalized).toBeCloseTo(0.25); // 25% of hip width
  });

  it('returns null for zero hip width', () => {
    const result = normalizedDistance({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 0);
    expect(result).toBeNull();
  });

  it('returns null for very small hip width', () => {
    const result = normalizedDistance({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 0.005);
    expect(result).toBeNull();
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe('Hip proxy — edge cases', () => {
  it('no movement returns zero', () => {
    const p = { x: 0.5, y: 0.6 };
    const positions = [p, p, p];
    const ref = referencePosition(positions, 2)!;
    expect(maximumDisplacement(positions, ref)).toBe(0);
  });

  it('lateral-only movement (X-axis)', () => {
    const positions = [
      { x: 0.50, y: 0.60 },
      { x: 0.55, y: 0.60 }, // only X changed
    ];
    const d = distance(positions[0], positions[1]);
    expect(d).toBeCloseTo(0.05);
  });

  it('vertical-only movement should still be captured', () => {
    const positions = [
      { x: 0.50, y: 0.60 },
      { x: 0.50, y: 0.65 }, // only Y changed (squat motion)
    ];
    const d = distance(positions[0], positions[1]);
    expect(d).toBeCloseTo(0.05);
  });
});
