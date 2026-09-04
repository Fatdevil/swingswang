import { AnalysisResultV1 } from '@/types/analysisV1';
import { AnalysisResultV2 } from '@/types/analysisV2';
import { migrateV1toV2 } from '@/types/migration/v1ToV2';

describe('V1 to V2 Migration', () => {
  const mockV1: AnalysisResultV1 = {
    schemaVersion: '1.0',
    analysisId: 'SS-20230101-120000-abcd',
    timestamp: '2023-01-01T12:00:00Z',
    video: {
      duration: 3.0,
      width: 1920,
      height: 1080,
      orientation: 'landscape',
      frameRate: 30,
      fileSize: null,
      mimeType: null,
    },
    swingConfig: {
      cameraView: 'FO',
      handedness: 'RIGHT',
      club: 'DRIVER',
    },
    processing: {
      totalTimeMs: 1000,
      framesExtracted: 90,
      framesAnalyzed: 90,
      framesEmpty: 0,
      framesReliable: 90,
      averageFrameTimeMs: 11,
      analysisFrameRate: 30,
      pipelineStages: {},
    },
    pose: {
      providerName: 'test',
      providerVersion: '1.0',
      landmarkCount: 33,
      framesAnalyzed: 90,
      framesReliable: 90,
      framesEmpty: 0,
      averageConfidence: 0.95,
      engineMode: 'REAL',
    },
    quality: null,
    stabilization: null,
    events: null,
    metrics: {},
    confidence: {
      video: 1,
      pose: 1,
      events: 1,
      metrics: 1,
      overall: 1,
    },
    warnings: {
      technical: [],
      userFacing: [],
    },
    version: {
      appVersion: '1.0.0',
      schemaVersion: '1.0',
      poseEngineVersion: '1.0',
      eventDetectorVersion: '1.0',
    },
  };

  it('migrates a valid V1 result to V2 with correct new fields', () => {
    const v2 = migrateV1toV2(mockV1);

    expect(v2.schemaVersion).toBe('2.0.0');
    expect(v2.subject).toBe('SELF_ADULT');
    expect(v2.audiencePolicy).toEqual({
      type: 'ADULT_SELF',
      policyVersion: '1.0.0',
    });

    expect(v2.pipelineTrace).toBeDefined();
    expect(v2.pipelineTrace.stages).toHaveLength(1);
    expect(v2.pipelineTrace.stages[0].name).toBe('migrated');

    expect(v2.migratedFrom).toBeDefined();
    expect(v2.migratedFrom?.schemaVersion).toBe('1.0');
    expect(v2.migratedFrom?.migratedAt).toBeDefined();

    // Check old fields are preserved
    expect(v2.analysisId).toBe(mockV1.analysisId);
    expect(v2.video).toEqual(mockV1.video);
    expect(v2.version.appVersion).toBe('1.0.0');
    expect(v2.version.schemaVersion).toBe('2.0.0');
  });

  it('is idempotent if already a V2 result', () => {
    const v2 = migrateV1toV2(mockV1);
    const v2Again = migrateV1toV2(v2);

    expect(v2Again).toBe(v2);
  });

  it('throws on unknown schema version', () => {
    const invalid = { ...mockV1, schemaVersion: '0.9' } as unknown as AnalysisResultV1;

    expect(() => migrateV1toV2(invalid)).toThrow('Unknown schema version, cannot assume adult provenance');
  });

  it('preserves all V1 fields in V2', () => {
    const v2 = migrateV1toV2(mockV1);

    expect(v2.swingConfig).toEqual(mockV1.swingConfig);
    expect(v2.processing).toEqual(mockV1.processing);
    expect(v2.pose).toEqual(mockV1.pose);
    expect(v2.quality).toEqual(mockV1.quality);
    expect(v2.stabilization).toEqual(mockV1.stabilization);
    expect(v2.events).toEqual(mockV1.events);
    expect(v2.metrics).toEqual(mockV1.metrics);
    expect(v2.confidence).toEqual(mockV1.confidence);
    expect(v2.warnings).toEqual(mockV1.warnings);
  });
});
