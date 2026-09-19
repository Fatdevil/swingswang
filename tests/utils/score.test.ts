import { calculateSwingScore } from '@/utils/score';
import { AnalysisResultV2 } from '@/types/analysisV2';

describe('calculateSwingScore', () => {
  const baseResult: Partial<AnalysisResultV2> = {
    schemaVersion: '2.0.0',
    analysisId: 'SS-TEST-001',
    quality: {
      overallStatus: 'PASS',
      analysisRecommended: true,
      confidence: 0.95,
      checks: {} as any,
      warnings: [],
    },
    metrics: {
      headMovement: {
        normalizedValue: 0.1,
        status: 'RELIABLE',
      } as any,
      torsoAngleChange: {
        normalizedValue: 0.15,
        status: 'RELIABLE',
      } as any,
      hipMovementProxy: {
        normalizedValue: 0.08,
        status: 'RELIABLE',
      } as any,
    },
  };

  it('calculates a valid score for reliable metrics with passing quality', () => {
    const score = calculateSwingScore(baseResult as AnalysisResultV2);
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(1.0);
    expect(score).toBeLessThanOrEqual(10.0);
  });

  it('returns null when quality gate failed', () => {
    const failedQuality = {
      ...baseResult,
      quality: {
        ...baseResult.quality!,
        overallStatus: 'FAIL' as const,
        analysisRecommended: false,
      },
    };
    const score = calculateSwingScore(failedQuality as AnalysisResultV2);
    expect(score).toBeNull();
  });

  it('returns null when analysis is not recommended', () => {
    const notRecommended = {
      ...baseResult,
      quality: {
        ...baseResult.quality!,
        overallStatus: 'WARNING' as const,
        analysisRecommended: false,
      },
    };
    const score = calculateSwingScore(notRecommended as AnalysisResultV2);
    expect(score).toBeNull();
  });

  it('returns null when all metrics are NOT_RELIABLE', () => {
    const unreliableMetrics = {
      ...baseResult,
      metrics: {
        headMovement: {
          normalizedValue: 0.1,
          status: 'NOT_RELIABLE' as const,
        } as any,
        torsoAngleChange: {
          normalizedValue: 0.15,
          status: 'NOT_RELIABLE' as const,
        } as any,
      },
    };
    const score = calculateSwingScore(unreliableMetrics as unknown as AnalysisResultV2);
    expect(score).toBeNull();
  });

  it('returns null when metrics object is empty', () => {
    const emptyMetrics = {
      ...baseResult,
      metrics: {},
    };
    const score = calculateSwingScore(emptyMetrics as AnalysisResultV2);
    expect(score).toBeNull();
  });
});
