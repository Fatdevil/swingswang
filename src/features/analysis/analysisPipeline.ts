/**
 * analysisPipeline.ts
 * SwingSwang
 *
 * Full analysis pipeline orchestrator.
 */

import { AnalysisResult, PoseSummary, buildAnalysisResult } from '../../types/analysis';
import { ProcessingStatus, ProcessingStats } from '../../types/pose';
import { VideoMetadata } from '../../types/video';
import { createPoseEngine } from '../pose/ExecuTorchAdapter';
import { extractFrames } from '../video/frameExtractor';
import { processVideoFrames } from '../pose/poseProcessor';
import { buildTimeline } from '../timeline/timelineBuilder';
import { calculateAllMetrics } from '../metrics/MetricEngine';
import { PoseTimeline } from '../timeline/PoseTimeline';
import { ANALYSIS_FRAME_RATE } from '../../constants/config';
import { Logger, PerformanceTimer } from '../../utils/logger';

/** Pipeline result including timeline for video player overlay. */
export interface PipelineResult {
  readonly analysisResult: AnalysisResult;
  readonly timeline: PoseTimeline;
}

/**
 * Run the complete analysis pipeline.
 *
 * VideoSource → Extract Frames → Pose Detection → Timeline → Metrics → Result
 */
export async function runAnalysisPipeline(
  videoUri: string,
  metadata: VideoMetadata,
  onStatus: (status: ProcessingStatus) => void
): Promise<PipelineResult> {
  const pipelineTimer = new PerformanceTimer('analysisPipeline');

  try {
    // 1. Initialize pose engine
    const engine = createPoseEngine();
    await engine.initialize();

    // 2. Extract frames
    onStatus({ type: 'extracting', progress: 0 });

    const frames = await extractFrames(
      videoUri,
      metadata.duration,
      ANALYSIS_FRAME_RATE,
      (progress) => onStatus({ type: 'extracting', progress })
    );

    if (frames.length === 0) {
      throw new Error('No frames could be extracted from the video.');
    }

    Logger.video.info(`Extracted ${frames.length} frames`);

    // 3. Run pose detection
    onStatus({ type: 'analyzing', progress: 0, framesComplete: 0, framesTotal: frames.length });

    const poseFrames = await processVideoFrames(
      frames,
      engine,
      (complete, total) => onStatus({
        type: 'analyzing',
        progress: complete / total,
        framesComplete: complete,
        framesTotal: total,
      })
    );

    if (poseFrames.length === 0) {
      throw new Error('No person detected in any frame. Ensure the golfer is visible in the video.');
    }

    // 4. Build timeline
    const pipelineElapsed = pipelineTimer.elapsed();
    const timeline = buildTimeline(poseFrames, frames.length, pipelineElapsed, ANALYSIS_FRAME_RATE);

    // 5. Calculate metrics
    onStatus({ type: 'calculating' });
    const metrics = calculateAllMetrics(timeline);

    // 6. Build result
    const totalTimeMs = pipelineTimer.stop();

    const processing: ProcessingStats = {
      totalTimeMs,
      framesExtracted: frames.length,
      framesAnalyzed: poseFrames.length,
      framesEmpty: frames.length - poseFrames.length,
      framesReliable: timeline.reliableFrameCount,
      averageFrameTimeMs: poseFrames.length > 0
        ? poseFrames.reduce((s, f) => s + f.processingTimeMs, 0) / poseFrames.length
        : 0,
      analysisFrameRate: ANALYSIS_FRAME_RATE,
    };

    const poseSummary: PoseSummary = {
      providerName: engine.name,
      providerVersion: engine.version,
      landmarkCount: engine.landmarkCount,
      framesAnalyzed: poseFrames.length,
      framesReliable: timeline.reliableFrameCount,
      averageConfidence: timeline.averageConfidence,
    };

    const analysisResult = buildAnalysisResult(metadata, processing, poseSummary, metrics);

    // Cleanup
    engine.dispose();

    onStatus({ type: 'completed' });

    Logger.pose.info('Pipeline complete', {
      totalTimeMs: totalTimeMs.toFixed(0),
      framesAnalyzed: poseFrames.length,
      reliableFrames: timeline.reliableFrameCount,
    });

    return { analysisResult, timeline };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.pose.error('Pipeline failed', { error: errorMsg });
    onStatus({ type: 'failed', error: errorMsg });
    throw error;
  }
}
