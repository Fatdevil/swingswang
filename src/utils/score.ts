/**
 * score.ts
 * SwingSwang
 *
 * Algorithm to calculate overall golf swing score (1.0 to 10.0) based on metrics.
 */

import { AnalysisResult } from '../types/analysis';
import { AnalysisResultV1 } from '../types/analysisV1';

export function calculateSwingScore(result: AnalysisResult | AnalysisResultV1): number {
  let head = 0.0;
  let torso = 0.0;
  let hip = 0.0;

  if ('schemaVersion' in result && result.schemaVersion === '1.0') {
    head = result.metrics['headMovement']?.normalizedValue ?? 0.0;
    torso = result.metrics['torsoAngleChange']?.normalizedValue ?? 0.0;
    hip = result.metrics['hipMovementProxy']?.normalizedValue ?? 0.0;
  } else {
    const oldResult = result as AnalysisResult;
    head = oldResult.metrics.headMovement.normalizedValue ?? 0.0;
    torso = oldResult.metrics.torsoAngleChange.normalizedValue ?? 0.0;
    hip = oldResult.metrics.hipMovementProxy.normalizedValue ?? 0.0;
  }

  // Calculate average displacement
  const avgDisplacement = (head + torso + hip) / 3;

  // Convert to 1-10 scale. A displacement of 0 is 10/10.
  // An average displacement of 0.6 or higher drops to 1/10.
  const rawScore = 10 * (1 - avgDisplacement * 1.5);
  
  // Clamp and round to 1 decimal place
  const rounded = Math.round(rawScore * 10) / 10;
  return Math.max(1.0, Math.min(10.0, rounded));
}
