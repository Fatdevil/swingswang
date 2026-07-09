/**
 * score.ts
 * SwingSwang
 *
 * Algorithm to calculate overall golf swing score (1.0 to 10.0) based on metrics.
 */

import { AnalysisResult } from '../types/analysis';
import { AnalysisResultV1 } from '../types/analysisV1';

export function calculateSwingScore(result: AnalysisResult | AnalysisResultV1): number {
  const values: number[] = [];

  if ('schemaVersion' in result && result.schemaVersion === '1.0') {
    const headVal = result.metrics['headMovement']?.normalizedValue;
    const torsoVal = result.metrics['torsoAngleChange']?.normalizedValue;
    const hipVal = result.metrics['hipMovementProxy']?.normalizedValue;

    if (headVal !== null && headVal !== undefined) values.push(headVal);
    if (torsoVal !== null && torsoVal !== undefined) values.push(torsoVal);
    if (hipVal !== null && hipVal !== undefined) values.push(hipVal);
  } else {
    const oldResult = result as AnalysisResult;
    const headVal = oldResult.metrics.headMovement.normalizedValue;
    const torsoVal = oldResult.metrics.torsoAngleChange.normalizedValue;
    const hipVal = oldResult.metrics.hipMovementProxy.normalizedValue;

    if (headVal !== null && headVal !== undefined) values.push(headVal);
    if (torsoVal !== null && torsoVal !== undefined) values.push(torsoVal);
    if (hipVal !== null && hipVal !== undefined) values.push(hipVal);
  }

  // Fallback if no valid metrics are calculated
  if (values.length === 0) {
    return 1.0;
  }

  // Calculate average displacement
  const avgDisplacement = values.reduce((sum, val) => sum + val, 0) / values.length;

  // Convert to 1-10 scale. A displacement of 0 is 10/10.
  // An average displacement of 0.6 or higher drops to 1/10.
  const rawScore = 10 * (1 - avgDisplacement * 1.5);
  
  // Clamp and round to 1 decimal place
  const rounded = Math.round(rawScore * 10) / 10;
  return Math.max(1.0, Math.min(10.0, rounded));
}
