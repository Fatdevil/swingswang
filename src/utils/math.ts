/**
 * math.ts
 * SwingSwang
 *
 * General math utility functions.
 */

/** Clamp a value to a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Linear interpolation between a and b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Map a value from one range to another. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

/** Convert radians to degrees. */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/** Convert degrees to radians. */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Safe division — returns 0 if divisor is zero or near-zero. */
export function safeDivide(numerator: number, denominator: number, epsilon: number = 1e-10): number {
  if (Math.abs(denominator) < epsilon) return 0;
  return numerator / denominator;
}

/** Round to a specified number of decimal places. */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Format a number as a percentage string. */
export function toPercent(value: number, decimals: number = 0): string {
  return `${roundTo(value * 100, decimals)}%`;
}
