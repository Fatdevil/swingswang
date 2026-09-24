/**
 * swingWindowRefinement.test.ts
 * Two-pass sampling: whole clip at 15 fps, swing window densified to 30 fps.
 */

import {
  computeRefinementTimestamps,
  detectCoarseSwingWindow,
  mergePoseFrames,
} from '@/features/analysis/swingWindowRefinement';
import { runAnalysisPipeline } from '@/features/analysis/analysisPipeline';
import { MockPoseEngine } from '@/features/pose/MockPoseEngine';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { createTestPoseFrame } from '../helpers/poseFixtures';

jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn().mockResolvedValue({ uri: 'file://mock-thumbnail.jpg' }),
}));

const base15 = Array.from({ length: 46 }, (_, i) => i / 15); // 0..3 s at 15 fps

describe('computeRefinementTimestamps', () => {
  it('inserts one midpoint per interval overlapping the window for 15 → 30 fps', () => {
    const extra = computeRefinementTimestamps(base15, { startTime: 1.0, endTime: 2.0 }, 30);
    // 15 intervals inside [1, 2] plus the two straddling its edges
    expect(extra.length).toBe(17);
    expect(extra[0]).toBeCloseTo(14 / 15 + 1 / 30, 9);
    for (const t of extra) {
      expect(t).toBeGreaterThan(1.0 - 1 / 15);
      expect(t).toBeLessThan(2.0 + 1 / 15);
      // never duplicates an existing sample
      expect(base15.some((b) => Math.abs(b - t) < 1e-9)).toBe(false);
    }
  });

  it('adds nothing when the target rate does not exceed the base rate', () => {
    expect(computeRefinementTimestamps(base15, { startTime: 0, endTime: 3 }, 15)).toEqual([]);
  });

  it('fills larger gaps (missing detections) proportionally', () => {
    const extra = computeRefinementTimestamps([0, 0.2], { startTime: 0, endTime: 1 }, 30);
    expect(extra.length).toBe(5);
  });
});

describe('mergePoseFrames', () => {
  it('orders by timestamp and renumbers frameIndex', () => {
    const coarse = [createTestPoseFrame(0, 0), createTestPoseFrame(2 / 30, 1)];
    const refined = [createTestPoseFrame(1 / 30, 0)];
    const merged = mergePoseFrames(coarse, refined);
    expect(merged.map((f) => f.timestamp)).toEqual([0, 1 / 30, 2 / 30]);
    expect(merged.map((f) => f.frameIndex)).toEqual([0, 1, 2]);
  });
});

describe('swing window refinement in the pipeline', () => {
  const metadata = {
    duration: 3.0,
    width: 1080,
    height: 1920,
    orientation: 'portrait' as const,
    frameRate: 30,
    fileSize: 1024 * 1024 * 5,
    mimeType: 'video/mp4',
  };
  const config = { cameraView: 'FO' as const, handedness: 'RIGHT' as const, club: 'DRIVER' as const };

  it('finds a swing window in the mock swing', async () => {
    const engine = new MockPoseEngine();
    await engine.initialize();
    const frames = [];
    for (const t of base15) {
      const f = await engine.analyzeFrame('file://mock.jpg', t, frames.length);
      if (f) frames.push({ ...f, realTimestamp: f.timestamp });
    }
    const w = detectCoarseSwingWindow(frames, config, 15);
    expect(w).not.toBeNull();
    expect(w!.endTime).toBeGreaterThan(w!.startTime);
  });

  it('extracts extra frames only inside the swing window and merges them', async () => {
    (getThumbnailAsync as jest.Mock).mockClear();
    const { analysisResult, timeline } = await runAnalysisPipeline(
      'file://test-video.mp4', metadata, () => {}, { mode: 'MOCK' }, undefined, config,
    );

    const stage = analysisResult.pipelineTrace.stages.find((s) => s.name === 'swingWindowRefine');
    expect(stage).toBeDefined();
    const requested = stage!.outputSummary.extraFramesRequested as number;
    expect(requested).toBeGreaterThan(0);
    // far fewer than re-sampling the whole 3 s clip at 30 fps (+45 frames)
    expect(requested).toBeLessThan(45);

    const coarse = analysisResult.pipelineTrace.stages.find((s) => s.name === 'extraction')!;
    const coarseCount = coarse.outputSummary.framesExtracted as number;
    expect((getThumbnailAsync as jest.Mock).mock.calls.length).toBe(coarseCount + requested);
    expect(analysisResult.processing.framesExtracted).toBe(coarseCount + requested);

    // merged timeline is strictly time-ordered with contiguous frame indices
    const ts = timeline.frames.map((f) => f.timestamp);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    timeline.frames.forEach((f, i) => expect(f.frameIndex).toBe(i));
    expect(timeline.frames.length).toBe(analysisResult.pose.framesAnalyzed);
  });
});
