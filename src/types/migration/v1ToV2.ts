import { AnalysisResultV1 } from '../analysisV1';
import { AnalysisResultV2, isAnalysisResultV2 } from '../analysisV2';

export function migrateV1toV2(v1: AnalysisResultV1 | AnalysisResultV2): AnalysisResultV2 {
  if (isAnalysisResultV2(v1)) {
    return v1;
  }

  if (v1.schemaVersion !== '1.0') {
    throw new Error('Unknown schema version, cannot assume adult provenance');
  }

  const now = new Date().toISOString();

  return {
    schemaVersion: '2.0.0',
    analysisId: v1.analysisId,
    timestamp: v1.timestamp,
    
    subject: 'SELF_ADULT',
    audiencePolicy: {
      type: 'ADULT_SELF',
      policyVersion: '1.0.0'
    },
    pipelineTrace: {
      stages: [
        {
          name: 'migrated',
          startMs: 0,
          durationMs: 0,
          status: 'OK',
          inputSummary: {},
          outputSummary: {}
        }
      ],
      totalDurationMs: 0,
      engineProvider: 'legacy',
      engineVersion: v1.version.poseEngineVersion
    },
    
    video: v1.video,
    swingConfig: v1.swingConfig,
    processing: v1.processing,
    pose: v1.pose,
    quality: v1.quality,
    stabilization: v1.stabilization,
    events: v1.events,
    metrics: v1.metrics,
    confidence: v1.confidence,
    warnings: v1.warnings,
    
    version: {
      ...v1.version,
      schemaVersion: '2.0.0'
    },
    
    migratedFrom: {
      schemaVersion: '1.0',
      migratedAt: now
    }
  };
}
