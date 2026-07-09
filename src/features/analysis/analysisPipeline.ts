/**
 * analysisPipeline.ts
 * SwingSwang – Analysis Pipeline Orchestrator
 *
 * Full analysis pipeline orchestrator.
 *
 * Pipeline sequence:
 * VideoUri → Extract Frames → Pose Detection → Raw Timeline → Quality Check
 * → Pose Stabilization → Event Detection → Metrics Calculation → Confidence Scopes
 * → Warning Aggregation → AnalysisResultV1
 */

import { ProcessingStatus } from '@/types/pose';
import { VideoMetadata } from '@/types/video';
import { createPoseEngine } from '@/features/pose/PoseEngineFactory';
import { PoseEngineConfig } from '@/features/pose/types';
import { extractFrames } from '@/features/video/frameExtractor';
import { processVideoFrames } from '@/features/pose/poseProcessor';
import { buildTimeline } from '@/features/timeline/timelineBuilder';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { ANALYSIS_FRAME_RATE } from '@/constants/config';
import { Logger, PerformanceTimer } from '@/utils/logger';

// V1 features imports
import { evaluateVideoQuality } from '@/features/quality/VideoQualityEngine';
import { stabilizePoseTimeline } from '@/features/stabilization/PoseStabilizer';
import { RuleBasedSwingEventDetectorV1 } from '@/features/events/RuleBasedSwingEventDetectorV1';
import { createDefaultRegistry } from '@/features/metrics/defaultRegistry';
import { MetricResultV1 } from '@/features/metrics/registry';
import { SwingConfig } from '@/types/swing';
import {
  AnalysisResultV1,
  generateAnalysisId,
  PoseSummaryV1,
  ProcessingStatsV1,
  ConfidenceSummary,
} from '@/types/analysisV1';
import { WarningCollection, AnalysisWarning, aggregateWarnings } from '@/types/warnings';

/** Pipeline result including timeline for video player overlay. */
export interface PipelineResult {
  readonly analysisResult: AnalysisResultV1;
  readonly timeline: PoseTimeline;
}

/**
 * Run the complete V1 analysis pipeline.
 *
 * Enforces quality check, stabilization, event detection, metric calculation,
 * confidence scoring, and structured warnings aggregation.
 */
export async function runAnalysisPipeline(
  videoUri: string,
  metadata: VideoMetadata,
  onStatus: (status: ProcessingStatus) => void,
  engineConfig?: PoseEngineConfig,
  isCancelled?: () => boolean,
  swingConfig?: SwingConfig,
): Promise<PipelineResult> {
  const pipelineTimer = new PerformanceTimer('analysisPipeline');

  // Load configuration defaults if none provided
  const config: SwingConfig = swingConfig ?? {
    cameraView: 'FO',
    handedness: 'RIGHT',
    club: 'DRIVER',
  };

  const engine = createPoseEngine(engineConfig ?? { mode: 'MOCK' });
  let frames: any[] = [];

  try {
    const stageTimings: Record<string, number> = {};
 
    // 1. Initialize pose engine
    const initTimer = new PerformanceTimer('stage.init');
    await engine.initialize();
    stageTimings['init'] = initTimer.stop();
 
    // 2. Extract frames
    onStatus({ type: 'extracting', progress: 0 });
    const extractionTimer = new PerformanceTimer('stage.extraction');
    frames = await extractFrames(
      videoUri,
      metadata.duration,
      ANALYSIS_FRAME_RATE,
      (progress) => onStatus({ type: 'extracting', progress }),
      isCancelled
    );
    stageTimings['extraction'] = extractionTimer.stop();
 
    if (frames.length === 0) {
      throw new Error('No frames could be extracted from the video.');
    }
 
    Logger.video.info(`Extracted ${frames.length} frames`);
 
    // 3. Run pose detection
    onStatus({ type: 'analyzing', progress: 0, framesComplete: 0, framesTotal: frames.length });
    const poseTimer = new PerformanceTimer('stage.pose');
    const poseFrames = await processVideoFrames(
      frames,
      engine,
      (complete, total) => onStatus({
        type: 'analyzing',
        progress: complete / total,
        framesComplete: complete,
        framesTotal: total,
      }),
      isCancelled,
      metadata.width,
      metadata.height
    );
    stageTimings['pose'] = poseTimer.stop();

    if (poseFrames.length === 0) {
      throw new Error('No person detected in any frame. Ensure the golfer is visible in the video.');
    }

    const totalVideoFrames = Math.round(metadata.duration * (metadata.frameRate || 30));

    // 4. Build raw timeline for quality checks
    const rawTimeline = buildTimeline(poseFrames, totalVideoFrames, pipelineTimer.elapsed(), ANALYSIS_FRAME_RATE);

    // 5. Evaluate video quality
    const qualityTimer = new PerformanceTimer('stage.quality');
    const qualityResult = evaluateVideoQuality(rawTimeline, metadata);
    stageTimings['quality'] = qualityTimer.stop();

    // 6. Run pose stabilization
    const stabilizationTimer = new PerformanceTimer('stage.stabilization');
    const stabilizationResult = stabilizePoseTimeline(poseFrames);
    const stabilizedFrames = stabilizationResult.frames;
    const stabilizedTimeline = buildTimeline(
      stabilizedFrames,
      totalVideoFrames,
      pipelineTimer.elapsed(),
      ANALYSIS_FRAME_RATE
    );
    stageTimings['stabilization'] = stabilizationTimer.stop();

    // 7. Detect swing events
    const eventsTimer = new PerformanceTimer('stage.events');
    const eventDetector = new RuleBasedSwingEventDetectorV1();
    const eventResult = eventDetector.detect(stabilizedTimeline, config);
    stageTimings['events'] = eventsTimer.stop();

    // 8. Calculate all metrics using registry
    onStatus({ type: 'calculating' });
    const metricsTimer = new PerformanceTimer('stage.metrics');
    const registry = createDefaultRegistry();
    const metricsMap = registry.calculateAvailable(stabilizedTimeline, config, eventResult);
    const metrics: Record<string, MetricResultV1> = {};
    for (const [id, value] of metricsMap.entries()) {
      metrics[id] = value;
    }
    stageTimings['metrics'] = metricsTimer.stop();

    // 9. Calculate confidence summary
    const detectedEvents = eventResult.events.filter(e => e.timestampMs !== null);
    const eventsConfidence = detectedEvents.length > 0
      ? detectedEvents.reduce((acc, curr) => acc + curr.confidence, 0) / detectedEvents.length
      : 0.0;

    const metricKeys = Object.keys(metrics);
    const metricsConfidence = metricKeys.length > 0
      ? metricKeys.reduce((acc, key) => acc + metrics[key].confidence, 0) / metricKeys.length
      : 0.0;

    const overallConfidence = (
      qualityResult.confidence * 0.2 +
      stabilizedTimeline.averageConfidence * 0.3 +
      eventsConfidence * 0.3 +
      metricsConfidence * 0.2
    );

    const confidenceSummary: ConfidenceSummary = {
      video: qualityResult.confidence,
      pose: stabilizedTimeline.averageConfidence,
      events: eventsConfidence,
      metrics: metricsConfidence,
      overall: Math.min(1.0, Math.max(0.0, overallConfidence)),
    };

    // 10. Aggregate warnings
    const videoWarnings: AnalysisWarning[] = qualityResult.warnings.map(w => ({
      code: w.code,
      source: 'VIDEO_QUALITY',
      severity: w.severity,
      message: w.message,
      userMessage: w.severity === 'error' || w.severity === 'warning' ? w.message : undefined,
    }));

    const poseWarnings: AnalysisWarning[] = [];
    if (stabilizedTimeline.averageConfidence < 0.5) {
      poseWarnings.push({
        code: 'LOW_POSE_CONFIDENCE',
        source: 'POSE_ENGINE',
        severity: 'warning',
        message: `Average pose confidence is low: ${stabilizedTimeline.averageConfidence.toFixed(2)}`,
        userMessage: 'Pose tracking confidence is low. Ensure good lighting and visibility.',
      });
    }

    const stabWarnings: AnalysisWarning[] = [];
    const stabReport = stabilizationResult.report;
    if (stabReport.outliersDetected > stabReport.totalFrames * 0.2) {
      stabWarnings.push({
        code: 'HIGH_JITTER_OUTLIERS',
        source: 'STABILIZATION',
        severity: 'warning',
        message: `High number of outliers detected: ${stabReport.outliersDetected}/${stabReport.totalFrames}`,
        userMessage: 'Camera shake or high jitter detected during swing.',
      });
    }

    const eventWarnings: AnalysisWarning[] = eventResult.warnings.map((msg, idx) => ({
      code: `EVENT_DETECTION_WARN_${idx}`,
      source: 'EVENT_DETECTION',
      severity: 'warning',
      message: msg,
      userMessage: msg,
    }));

    const metricWarnings: AnalysisWarning[] = [];
    for (const [id, metric] of Object.entries(metrics)) {
      for (const warning of metric.warnings) {
        metricWarnings.push({
          code: `METRIC_WARN_${id.toUpperCase()}`,
          source: 'METRIC',
          severity: metric.status === 'NOT_RELIABLE' ? 'error' : 'warning',
          message: `${metric.name}: ${warning}`,
          userMessage: warning,
        });
      }
    }

    const warnings = aggregateWarnings(
      videoWarnings,
      poseWarnings,
      stabWarnings,
      eventWarnings,
      metricWarnings,
    );

    // 11. Build result structures
    const totalTimeMs = pipelineTimer.stop();

    const processing: ProcessingStatsV1 = {
      totalTimeMs,
      framesExtracted: frames.length,
      framesAnalyzed: poseFrames.length,
      framesEmpty: frames.length - poseFrames.length,
      framesReliable: stabilizedTimeline.reliableFrameCount,
      averageFrameTimeMs: poseFrames.length > 0
        ? poseFrames.reduce((s, f) => s + f.processingTimeMs, 0) / poseFrames.length
        : 0,
      analysisFrameRate: ANALYSIS_FRAME_RATE,
      pipelineStages: stageTimings,
    };

    const poseSummaryV1: PoseSummaryV1 = {
      providerName: engine.name,
      providerVersion: engine.version,
      landmarkCount: engine.landmarkCount,
      framesAnalyzed: poseFrames.length,
      framesReliable: stabilizedTimeline.reliableFrameCount,
      framesEmpty: frames.length - poseFrames.length,
      averageConfidence: stabilizedTimeline.averageConfidence,
      engineMode: engineConfig?.mode === 'REAL' ? 'REAL' : 'MOCK',
    };

    const analysisResult: AnalysisResultV1 = {
      schemaVersion: '1.0',
      analysisId: generateAnalysisId(),
      timestamp: new Date().toISOString(),
      video: metadata,
      swingConfig: config,
      processing,
      pose: poseSummaryV1,
      quality: qualityResult,
      stabilization: stabReport,
      events: eventResult,
      metrics,
      confidence: confidenceSummary,
      warnings,
      version: {
        appVersion: '1.0.0',
        schemaVersion: '1.0',
        poseEngineVersion: engine.version,
        eventDetectorVersion: eventDetector.version,
      },
    };

    onStatus({ type: 'completed' });

    Logger.pose.info('Pipeline complete', {
      totalTimeMs: totalTimeMs.toFixed(0),
      framesAnalyzed: poseFrames.length,
      reliableFrames: stabilizedTimeline.reliableFrameCount,
    });

    return { analysisResult, timeline: stabilizedTimeline };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    Logger.pose.error('Pipeline failed', { error: errorMsg });
    onStatus({ type: 'failed', error: errorMsg });
    throw error;
  } finally {
    engine.dispose();
    // Clean up temporary extracted frames to prevent storage leaks
    if (frames && frames.length > 0) {
      try {
        const FileSystem = require('expo-file-system');
        if (FileSystem && FileSystem.deleteAsync) {
          for (const frame of frames) {
            if (frame.imageUri) {
              try {
                await FileSystem.deleteAsync(frame.imageUri, { idempotent: true });
              } catch (e) {
                Logger.video.warn(`Failed to clean up temporary frame: ${frame.imageUri}`, { error: String(e) });
              }
            }
          }
        }
      } catch (e) {
        Logger.video.warn('FileSystem not available for frame cleanup in this environment', { error: String(e) });
      }
    }
  }
}
