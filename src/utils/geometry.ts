/**
 * geometry.ts
 * SwingSwang
 *
 * Pure geometry helper functions.
 * All functions are deterministic, side-effect free, and independently testable.
 */

/** A 2D point. */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

// ─── Basic Operations ───────────────────────────────────────────────

/** Euclidean distance between two points. */
export function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Midpoint between two points. */
export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Centroid (average position) of multiple points.
 * Returns null if fewer than minimumRequired points are provided.
 */
export function centroid(
  points: readonly Point2D[],
  minimumRequired: number = 1
): Point2D | null {
  if (points.length < minimumRequired) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  return { x: sumX / points.length, y: sumY / points.length };
}

// ─── Normalization ──────────────────────────────────────────────────

/**
 * Distance between two points, normalized by a reference distance.
 * Returns null if reference is too small (prevents division by near-zero).
 */
export function normalizedDistance(
  a: Point2D,
  b: Point2D,
  referenceDistance: number,
  minimumReference: number = 0.01
): number | null {
  if (referenceDistance < minimumReference) return null;
  return distance(a, b) / referenceDistance;
}

// ─── Angles ─────────────────────────────────────────────────────────

/**
 * Angle of the vector from `bottom` to `top` relative to vertical (Y-axis up).
 * Returns degrees. 0° = straight up. Positive = lean right. Negative = lean left.
 *
 * Note: In normalized screen coordinates, Y increases downward.
 * The "vertical" direction is (0, -1) in screen coords.
 */
export function angleFromVertical(bottom: Point2D, top: Point2D): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y; // negative = up in screen coords
  // atan2 of horizontal deviation vs vertical extent
  // Use -dy because screen Y increases downward, but "vertical" means upward
  const radians = Math.atan2(dx, -dy);
  return radians * (180 / Math.PI);
}

/**
 * Angle at vertex formed by points a → vertex → b.
 * Returns degrees in range 0–180.
 */
export function jointAngle(a: Point2D, vertex: Point2D, b: Point2D): number {
  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = b.x - vertex.x;
  const v2y = b.y - vertex.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// ─── Displacement Tracking ──────────────────────────────────────────

/**
 * Maximum displacement from a reference point across all positions.
 * Returns 0 if positions array is empty.
 */
export function maximumDisplacement(
  positions: readonly Point2D[],
  reference: Point2D
): number {
  let maxDist = 0;
  for (const pos of positions) {
    const d = distance(pos, reference);
    if (d > maxDist) maxDist = d;
  }
  return maxDist;
}

/**
 * Calculate a reference position from the first N positions.
 * Uses the centroid of the first `firstCount` positions.
 * Returns null if not enough positions.
 */
export function referencePosition(
  positions: readonly Point2D[],
  firstCount: number = 5
): Point2D | null {
  const count = Math.min(firstCount, positions.length);
  if (count < 1) return null;
  return centroid(positions.slice(0, count));
}

// ─── Stability ──────────────────────────────────────────────────────

/**
 * Positional jitter — average frame-to-frame displacement.
 * Returns 0 if fewer than 2 positions.
 * Lower values = more stable.
 */
export function positionalJitter(positions: readonly Point2D[]): number {
  if (positions.length < 2) return 0;

  let totalDisplacement = 0;
  for (let i = 1; i < positions.length; i++) {
    totalDisplacement += distance(positions[i - 1], positions[i]);
  }
  return totalDisplacement / (positions.length - 1);
}

// ─── Bounding Box ───────────────────────────────────────────────────

/** Axis-aligned bounding box. */
export interface BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Calculate bounding box of a set of points.
 * Returns null if no points.
 */
export function boundingBox(points: readonly Point2D[]): BoundingBox | null {
  if (points.length === 0) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Ratio of the golfer's bounding box to the frame size.
 * Returns the diagonal of the bounding box divided by the frame diagonal.
 */
export function golferSizeRatio(
  points: readonly Point2D[],
  frameWidth: number = 1,
  frameHeight: number = 1
): number {
  const box = boundingBox(points);
  if (!box) return 0;

  const golferDiag = Math.sqrt(box.width * box.width + box.height * box.height);
  const frameDiag = Math.sqrt(frameWidth * frameWidth + frameHeight * frameHeight);

  if (frameDiag === 0) return 0;
  return golferDiag / frameDiag;
}

// ─── Statistics ─────────────────────────────────────────────────────

/** Calculate the mean of an array of numbers. Returns 0 for empty arrays. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Calculate the standard deviation of an array of numbers. */
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  let sumSqDiff = 0;
  for (const v of values) {
    const diff = v - avg;
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff / (values.length - 1));
}

/**
 * Coefficient of variation (CV) — ratio of std dev to mean.
 * Returns 0 if mean is near zero.
 */
export function coefficientOfVariation(values: readonly number[]): number {
  const avg = mean(values);
  if (Math.abs(avg) < 1e-10) return 0;
  return standardDeviation(values) / Math.abs(avg);
}
