/**
 * score.ts
 * SwingSwang
 *
 * Algorithm to calculate overall golf swing score (1.0 to 10.0) based on metrics.
 */

import { AnalysisResult } from '../types/analysis';

export function calculateSwingScore(result: AnalysisResult): number {
  // Retrieve normalized metric values (closer to 0 is more stable/better)
  const head = result.metrics.headMovement.normalizedValue ?? 0.0;
  const torso = result.metrics.torsoAngleChange.normalizedValue ?? 0.0;
  const hip = result.metrics.hipMovementProxy.normalizedValue ?? 0.0;

  // Calculate average displacement
  const avgDisplacement = (head + torso + hip) / 3;

  // Convert to 1-10 scale. A displacement of 0 is 10/10.
  // An average displacement of 0.6 or higher drops to 1/10.
  const rawScore = 10 * (1 - avgDisplacement * 1.5);
  
  // Clamp and round to 1 decimal place
  const rounded = Math.round(rawScore * 10) / 10;
  return Math.max(1.0, Math.min(10.0, rounded));
}
