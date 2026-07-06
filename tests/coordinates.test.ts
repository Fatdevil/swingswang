/**
 * coordinates.test.ts
 * SwingSwang
 *
 * Tests for coordinate conversion functions.
 */

import {
  pixelToNormalized,
  normalizedToDisplay,
  mirrorX,
  mirrorY,
  normalizedToAspectFitDisplay,
  roundTripPixelCoordinates,
} from '../src/utils/coordinates';

// ─── pixelToNormalized ──────────────────────────────────────────────

describe('pixelToNormalized', () => {
  it('converts top-left corner', () => {
    const result = pixelToNormalized(0, 0, 1920, 1080);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('converts bottom-right corner', () => {
    const result = pixelToNormalized(1920, 1080, 1920, 1080);
    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
  });

  it('converts center', () => {
    const result = pixelToNormalized(960, 540, 1920, 1080);
    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
  });

  it('handles zero dimensions gracefully', () => {
    const result = pixelToNormalized(100, 100, 0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('handles negative dimensions gracefully', () => {
    const result = pixelToNormalized(100, 100, -10, -10);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

// ─── normalizedToDisplay ────────────────────────────────────────────

describe('normalizedToDisplay', () => {
  it('scales to display dimensions', () => {
    const result = normalizedToDisplay(0.5, 0.5, 400, 300);
    expect(result.x).toBe(200);
    expect(result.y).toBe(150);
  });

  it('maps corners correctly', () => {
    expect(normalizedToDisplay(0, 0, 400, 300)).toEqual({ x: 0, y: 0 });
    expect(normalizedToDisplay(1, 1, 400, 300)).toEqual({ x: 400, y: 300 });
  });
});

// ─── mirrorX ────────────────────────────────────────────────────────

describe('mirrorX', () => {
  it('mirrors X coordinate', () => {
    const result = mirrorX({ x: 0.3, y: 0.7 });
    expect(result.x).toBeCloseTo(0.7);
    expect(result.y).toBe(0.7);
  });

  it('keeps center unchanged', () => {
    const result = mirrorX({ x: 0.5, y: 0.5 });
    expect(result.x).toBeCloseTo(0.5);
  });

  it('swaps 0 and 1', () => {
    expect(mirrorX({ x: 0, y: 0 }).x).toBe(1);
    expect(mirrorX({ x: 1, y: 0 }).x).toBe(0);
  });
});

// ─── mirrorY ────────────────────────────────────────────────────────

describe('mirrorY', () => {
  it('mirrors Y coordinate', () => {
    const result = mirrorY({ x: 0.3, y: 0.2 });
    expect(result.x).toBe(0.3);
    expect(result.y).toBeCloseTo(0.8);
  });
});

// ─── normalizedToAspectFitDisplay ───────────────────────────────────

describe('normalizedToAspectFitDisplay', () => {
  it('handles matching aspect ratios (no letterbox)', () => {
    // 16:9 video in 16:9 display
    const result = normalizedToAspectFitDisplay(0.5, 0.5, 1920, 1080, 400, 225);
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(112.5);
  });

  it('handles wider video (letterboxing top/bottom)', () => {
    // 16:9 video in 4:3 display → pillarbox? No, 16:9 > 4:3, so fit to width, letterbox top/bottom
    const result = normalizedToAspectFitDisplay(0, 0, 1920, 1080, 400, 400);
    // videoAspect = 1.78, displayAspect = 1.0
    // scaledWidth = 400, scaledHeight = 400/1.78 ≈ 225
    // offsetY = (400-225)/2 ≈ 87.5
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(87.5, 0);
  });

  it('handles taller video (pillarboxing left/right)', () => {
    // 9:16 video in 16:9 display → pillarbox
    const result = normalizedToAspectFitDisplay(0, 0, 1080, 1920, 400, 225);
    // videoAspect = 0.5625, displayAspect = 1.78
    // scaledHeight = 225, scaledWidth = 225*0.5625 ≈ 126.6
    // offsetX = (400-126.6)/2 ≈ 136.7
    expect(result.x).toBeCloseTo(136.7, 0);
    expect(result.y).toBeCloseTo(0);
  });

  it('handles zero dimensions gracefully', () => {
    const result = normalizedToAspectFitDisplay(0.5, 0.5, 0, 0, 400, 300);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

// ─── roundTripPixelCoordinates ──────────────────────────────────────

describe('roundTripPixelCoordinates', () => {
  it('round-trips pixel coordinates', () => {
    const result = roundTripPixelCoordinates(500, 300, 1920, 1080);
    expect(result.x).toBeCloseTo(500, 5);
    expect(result.y).toBeCloseTo(300, 5);
  });

  it('round-trips corner coordinates', () => {
    const result = roundTripPixelCoordinates(0, 0, 1920, 1080);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });
});
