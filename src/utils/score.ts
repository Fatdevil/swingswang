/**
 * score.ts
 * SwingSwang
 *
 * Algorithm to calculate overall golf swing score (1.0 to 10.0) based on metrics.
 */

import { AnalysisResult } from '../types/analysis';
import { AnalysisResultV1 } from '../types/analysisV1';
import { AnalysisResultV2 } from '../types/analysisV2';

export function calculateSwingScore(result: AnalysisResult | AnalysisResultV1 | AnalysisResultV2): number | null {
  // If video quality gate failed, do not produce a swing score
  if ('quality' in result && result.quality && (result.quality.overallStatus === 'FAIL' || !result.quality.analysisRecommended)) {
    return null;
  }

  const values: number[] = [];

  if ('schemaVersion' in result && (result.schemaVersion === '1.0' || result.schemaVersion === '2.0.0')) {
    const head = result.metrics['headMovement'];
    const torso = result.metrics['torsoAngleChange'];
    const hip = result.metrics['hipMovementProxy'];

    if (head?.status === 'RELIABLE' && head.normalizedValue !== null && head.normalizedValue !== undefined) {
      values.push(head.normalizedValue);
    }
    if (torso?.status === 'RELIABLE' && torso.normalizedValue !== null && torso.normalizedValue !== undefined) {
      values.push(torso.normalizedValue);
    }
    if (hip?.status === 'RELIABLE' && hip.normalizedValue !== null && hip.normalizedValue !== undefined) {
      values.push(hip.normalizedValue);
    }
  } else {
    const oldResult = result as AnalysisResult;
    const head = oldResult.metrics.headMovement;
    const torso = oldResult.metrics.torsoAngleChange;
    const hip = oldResult.metrics.hipMovementProxy;

    if (head && head.normalizedValue !== null && head.normalizedValue !== undefined) values.push(head.normalizedValue);
    if (torso && torso.normalizedValue !== null && torso.normalizedValue !== undefined) values.push(torso.normalizedValue);
    if (hip && hip.normalizedValue !== null && hip.normalizedValue !== undefined) values.push(hip.normalizedValue);
  }

  // Fallback: If no reliable metrics are available, return null rather than an artificial 1.0
  if (values.length === 0) {
    return null;
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
