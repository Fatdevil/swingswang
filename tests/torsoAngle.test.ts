/**
 * torsoAngle.test.ts
 * SwingSwang
 *
 * Tests for torso angle change metric calculation.
 */

import { angleFromVertical } from '../src/utils/geometry';

// ─── Torso angle calculation ────────────────────────────────────────

describe('Torso angle — basic calculation', () => {
  it('upright torso returns ~0 degrees', () => {
    const hipMidpoint = { x: 0.5, y: 0.7 };
    const shoulderMidpoint = { x: 0.5, y: 0.3 };
    const angle = angleFromVertical(hipMidpoint, shoulderMidpoint);
    expect(Math.abs(angle)).toBeLessThan(1);
  });

  it('forward lean returns positive angle from vertical', () => {
    const hipMidpoint = { x: 0.5, y: 0.7 };
    const shoulderMidpoint = { x: 0.6, y: 0.3 }; // shifted right = forward lean in face-on view
    const angle = angleFromVertical(hipMidpoint, shoulderMidpoint);
    expect(angle).toBeGreaterThan(0);
  });

  it('backward lean returns negative angle', () => {
    const hipMidpoint = { x: 0.5, y: 0.7 };
    const shoulderMidpoint = { x: 0.4, y: 0.3 }; // shifted left
    const angle = angleFromVertical(hipMidpoint, shoulderMidpoint);
    expect(angle).toBeLessThan(0);
  });
});

// ─── Angle change across swing ──────────────────────────────────────

describe('Torso angle — change tracking', () => {
  it('calculates max angle change from address', () => {
    // Simulate swing: address → backswing → downswing
    const addressHip = { x: 0.50, y: 0.70 };
    const frames = [
      { shoulder: { x: 0.50, y: 0.30 } }, // address: upright
      { shoulder: { x: 0.52, y: 0.31 } }, // slight turn
      { shoulder: { x: 0.56, y: 0.32 } }, // more turn
      { shoulder: { x: 0.54, y: 0.30 } }, // coming back
    ];

    const addressAngle = angleFromVertical(addressHip, frames[0].shoulder);
    let maxChange = 0;

    for (const frame of frames) {
      const angle = angleFromVertical(addressHip, frame.shoulder);
      const change = Math.abs(angle - addressAngle);
      if (change > maxChange) maxChange = change;
    }

    expect(maxChange).toBeGreaterThan(0);
    expect(maxChange).toBeLessThan(90); // realistic golf swing range
  });

  it('no movement returns zero change', () => {
    const hip = { x: 0.5, y: 0.7 };
    const shoulder = { x: 0.5, y: 0.3 };
    const angle1 = angleFromVertical(hip, shoulder);
    const angle2 = angleFromVertical(hip, shoulder);
    expect(Math.abs(angle1 - angle2)).toBe(0);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe('Torso angle — edge cases', () => {
  it('handles collinear hip and shoulder (zero height difference)', () => {
    // This shouldn't happen in real pose data but test it
    const hip = { x: 0.3, y: 0.5 };
    const shoulder = { x: 0.7, y: 0.5 }; // same Y = horizontal
    const angle = angleFromVertical(hip, shoulder);
    expect(Math.abs(angle)).toBeCloseTo(90, 0);
  });

  it('handles very small torso (hip near shoulder)', () => {
    const hip = { x: 0.50, y: 0.51 };
    const shoulder = { x: 0.50, y: 0.49 };
    const angle = angleFromVertical(hip, shoulder);
    // Should still compute without NaN
    expect(isNaN(angle)).toBe(false);
  });
});
