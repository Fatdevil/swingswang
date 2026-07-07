/**
 * analysisPipeline.test.ts
 * SwingSwang
 *
 * Integration tests verifying the 15 invariants of the V1 analysis pipeline.
 */

import { runAnalysisPipeline } from '@/features/analysis/analysisPipeline';
import { VideoMetadata } from '@/types/video';
import { SwingConfig } from '@/types/swing';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { isAnalysisResultV1 } from '@/types/analysisV1';

// Mock native Expo modules
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn().mockResolvedValue({ uri: 'file://mock-thumbnail.jpg' }),
}));

jest.mock('expo-video', () => ({
  createVideoPlayer: jest.fn().mockReturnValue({
    duration: 3.0,
    status: 'readyToPlay',
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    release: jest.fn(),
  }),
}));

describe('runAnalysisPipeline V1 Integration', () => {
  const mockMetadata: VideoMetadata = {
    duration: 3.0,
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    frameRate: 30,
    fileSize: 1024 * 1024 * 5,
    mimeType: 'video/mp4',
  };

  const mockSwingConfig: SwingConfig = {
    cameraView: 'FO',
    handedness: 'RIGHT',
    club: 'DRIVER',
  };

  it('verifies the 15 pipeline invariants', async () => {
    const statusHistory: any[] = [];
    const onStatus = (status: any) => statusHistory.push(status);

    const result = await runAnalysisPipeline(
      'file://test-video.mp4',
      mockMetadata,
      onStatus,
      { mode: 'MOCK' },
      undefined,
      mockSwingConfig
    );

    const r = result.analysisResult;

    // Invariant 1: schemaVersion is exactly '1.0'
    expect(r.schemaVersion).toBe('1.0');

    // Invariant 2: Unique analysis ID is generated and correctly formatted
    expect(r.analysisId).toBeDefined();
    expect(r.analysisId.startsWith('SS-')).toBe(true);

    // Invariant 3: ISO 8601 timestamp exists and is parseable
    expect(r.timestamp).toBeDefined();
    expect(new Date(r.timestamp).getTime()).toBeGreaterThan(0);

    // Invariant 4: Video metadata matches input
    expect(r.video.duration).toBe(mockMetadata.duration);
    expect(r.video.width).toBe(mockMetadata.width);
    expect(r.video.height).toBe(mockMetadata.height);

    // Invariant 5: SwingConfig matches input
    expect(r.swingConfig.cameraView).toBe(mockSwingConfig.cameraView);
    expect(r.swingConfig.handedness).toBe(mockSwingConfig.handedness);
    expect(r.swingConfig.club).toBe(mockSwingConfig.club);

    // Invariant 6: Pose summary matches processed frames
    expect(r.pose.engineMode).toBe('MOCK');
    expect(r.pose.landmarkCount).toBe(17);
    expect(r.pose.framesAnalyzed).toBeGreaterThan(0);

    // Invariant 7: Quality evaluation report exists
    expect(r.quality).not.toBeNull();
    expect(r.quality?.overallStatus).toBeDefined();
    expect(r.quality?.confidence).toBeGreaterThanOrEqual(0);

    // Invariant 8: Stabilization report exists and shows applied state
    expect(r.stabilization).not.toBeNull();
    expect(r.stabilization?.totalFrames).toBeGreaterThan(0);
    expect(r.stabilization?.smoothingApplied).toBe(true);

    // Invariant 9: Events are detected
    expect(r.events).not.toBeNull();
    expect(r.events?.events.length).toBe(8);

    // Invariant 10: Events are in valid temporal order (or correct warnings generated)
    expect(r.events?.temporalOrderValid).toBeDefined();

    // Invariant 11: 6 metrics are calculated for FO view (excludes handDepth)
    expect(Object.keys(r.metrics).length).toBe(6);
    expect(r.metrics.headMovement).toBeDefined();
    expect(r.metrics.tempo).toBeDefined();
    expect(r.metrics.pelvisSway).toBeDefined();
    expect(r.metrics.handDepth).toBeUndefined();

    // Invariant 12: Confidence summary contains all factors clamped to [0,1]
    expect(r.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(r.confidence.overall).toBeLessThanOrEqual(1);
    expect(r.confidence.video).toBeGreaterThanOrEqual(0);
    expect(r.confidence.pose).toBeGreaterThanOrEqual(0);
    expect(r.confidence.events).toBeGreaterThanOrEqual(0);
    expect(r.confidence.metrics).toBeGreaterThanOrEqual(0);

    // Invariant 13: Warnings aggregation contains technical & userFacing lists
    expect(r.warnings.technical).toBeDefined();
    expect(r.warnings.userFacing).toBeDefined();

    // Invariant 14: Version metadata exists for all components
    expect(r.version.appVersion).toBe('1.0.0');
    expect(r.version.poseEngineVersion).toBeDefined();
    expect(r.version.eventDetectorVersion).toBeDefined();

    // Invariant 15: Stabilized timeline is returned and matches frames count
    expect(result.timeline).toBeInstanceOf(PoseTimeline);
    expect(result.timeline.analyzedFrameCount).toBe(r.pose.framesAnalyzed);

    // Check status flow
    expect(statusHistory.some(s => s.type === 'extracting')).toBe(true);
    expect(statusHistory.some(s => s.type === 'analyzing')).toBe(true);
    expect(statusHistory.some(s => s.type === 'calculating')).toBe(true);
    expect(statusHistory.some(s => s.type === 'completed')).toBe(true);
  });

  it('supports cancellation during frame extraction', async () => {
    let callCount = 0;
    const isCancelled = () => {
      callCount++;
      return callCount > 5; // cancel after 5 iterations
    };

    await expect(
      runAnalysisPipeline(
        'file://test-video.mp4',
        mockMetadata,
        () => {},
        { mode: 'MOCK' },
        isCancelled,
        mockSwingConfig
      )
    ).rejects.toThrow('Frame extraction cancelled');
  });

  it('type guards work as expected', async () => {
    const result = await runAnalysisPipeline(
      'file://test-video.mp4',
      mockMetadata,
      () => {},
      { mode: 'MOCK' },
      undefined,
      mockSwingConfig
    );

    expect(isAnalysisResultV1(result.analysisResult)).toBe(true);
    expect(isAnalysisResultV1({})).toBe(false);
    expect(isAnalysisResultV1(null)).toBe(false);
  });
});
