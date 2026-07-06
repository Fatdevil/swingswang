/**
 * coordinates.ts
 * SwingSwang
 *
 * Coordinate system conversion utilities.
 *
 * Coordinate Systems:
 * - Model output: Depends on pose engine. ExecuTorch COCO outputs pixel coords.
 * - Normalized: 0–1 range, origin top-left, Y-down. Used internally.
 * - Display: Scaled to video display size. Used for overlay rendering.
 */

import { Point2D } from './geometry';

/**
 * Normalize pixel coordinates to 0–1 range.
 * Origin top-left, Y increases downward.
 */
export function pixelToNormalized(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number
): Point2D {
  if (imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0 };
  return {
    x: x / imageWidth,
    y: y / imageHeight,
  };
}

/**
 * Convert normalized coordinates to display pixel coordinates.
 */
export function normalizedToDisplay(
  nx: number,
  ny: number,
  displayWidth: number,
  displayHeight: number
): Point2D {
  return {
    x: nx * displayWidth,
    y: ny * displayHeight,
  };
}

/**
 * Mirror X coordinate (for front-facing camera or mirrored video).
 */
export function mirrorX(point: Point2D): Point2D {
  return { x: 1.0 - point.x, y: point.y };
}

/**
 * Mirror Y coordinate.
 */
export function mirrorY(point: Point2D): Point2D {
  return { x: point.x, y: 1.0 - point.y };
}

/**
 * Scale a normalized point to fit within a display area,
 * accounting for aspect-fit scaling.
 *
 * When the video aspect ratio doesn't match the display area,
 * the video is centered with letterboxing/pillarboxing.
 * This function calculates the correct display position.
 */
export function normalizedToAspectFitDisplay(
  nx: number,
  ny: number,
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number
): Point2D {
  if (videoWidth <= 0 || videoHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    return { x: 0, y: 0 };
  }

  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;

  let scaledWidth: number;
  let scaledHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (videoAspect > displayAspect) {
    // Video is wider — fit to width, letterbox top/bottom
    scaledWidth = displayWidth;
    scaledHeight = displayWidth / videoAspect;
    offsetX = 0;
    offsetY = (displayHeight - scaledHeight) / 2;
  } else {
    // Video is taller — fit to height, pillarbox left/right
    scaledHeight = displayHeight;
    scaledWidth = displayHeight * videoAspect;
    offsetX = (displayWidth - scaledWidth) / 2;
    offsetY = 0;
  }

  return {
    x: offsetX + nx * scaledWidth,
    y: offsetY + ny * scaledHeight,
  };
}

/**
 * Round-trip test helper: normalize then denormalize should return ~original.
 */
export function roundTripPixelCoordinates(
  x: number,
  y: number,
  width: number,
  height: number
): Point2D {
  const normalized = pixelToNormalized(x, y, width, height);
  return normalizedToDisplay(normalized.x, normalized.y, width, height);
}
