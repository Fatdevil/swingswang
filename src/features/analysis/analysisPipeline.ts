/**
 * analysisPipeline.ts
 * SwingSwang – Analysis Pipeline Orchestrator
 *
 * Full analysis pipeline orchestrator.
 *
 * Pipeline sequence:
 * VideoUri → Extract Frames → Pose Detection → Raw Timeline → Quality Check
 * → Pose Stabilization → Event Detection → Metrics Calculation → Confidence Scopes
 * → Warning Aggregation → AnalysisResultV2
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
import { normalizeTimestampToRealSeconds } from '@/features/video/slowMotionDetector';

// V1 features imports
import { evaluateVideoQuality } from '@/features/quality/VideoQualityEngine';
import { stabilizePoseTimeline } from '@/features/stabilization/PoseStabilizer';
import { RuleBasedSwingEventDetectorV1 } from '@/features/events/RuleBasedSwingEventDetectorV1';
import { createDefaultRegistry } from '@/features/metrics/defaultRegistry';
import { MetricResultV1 } from '@/features/metrics/registry';
import { SwingConfig } from '@/types/swing';
import {
  AnalysisResultV2,
  generateAnalysisId,
  PoseSummaryV2,
  ProcessingStatsV2,
  ConfidenceSummary,
  VersionMetadataV2,
  PipelineTrace,
  PipelineStageTrace,
} from '@/types/analysisV2';
import { WarningCollection, AnalysisWarning, aggregateWarnings } from '@/types/warnings';

/** Pipeline result including timeline for video player overlay. */
export interface PipelineResult {
  readonly analysisResult: AnalysisResultV2;
  readonly timeline: PoseTimeline;
}

/**
 * Run the complete V2 analysis pipeline.
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
  timeRange?: { startTime: number; endTime: number },
): Promise<PipelineResult> {
  const pipelineTimer = new PerformanceTimer('analysisPipeline');

  // Load configuration defaults if none provided
  const config: SwingConfig = swingConfig ?? {
    cameraView: 'FO',
    handedness: 'RIGHT',
    club: 'DRIVER',
  };

  if (!engineConfig) {
    throw new Error('engineConfig is required — the pipeline must not default to mock mode.');
  }
  const engine = createPoseEngine(engineConfig);
  let frames: any[] = [];

  try {
    const stageTimings: Record<string, number> = {};
    const stageTraces: PipelineStageTrace[] = [];

    // 1. Initialize pose engine
    const initStartMs = pipelineTimer.elapsed();
    const initTimer = new PerformanceTimer('stage.init');
    await engine.initialize();
    const initDurationMs = initTimer.stop();
    stageTimings['init'] = initDurationMs;
    stageTraces.push({
      name: 'init',
      startMs: initStartMs,
      durationMs: initDurationMs,
      status: 'OK',
      inputSummary: { engine: engine.name },
      outputSummary: { state: 'initialized' },
    });

    // 2. Extract frames
    const extStartMs = pipelineTimer.elapsed();
    onStatus({ type: 'extracting', progress: 0 });
    const extractionTimer = new PerformanceTimer('stage.extraction');
    frames = await extractFrames(
      videoUri,
      metadata.duration,
      ANALYSIS_FRAME_RATE,
      (progress) => onStatus({ type: 'extracting', progress }),
      isCancelled,
      timeRange
    );
    const extDurationMs = extractionTimer.stop();
    stageTimings['extraction'] = extDurationMs;
    stageTraces.push({
      name: 'extraction',
      startMs: extStartMs,
      durationMs: extDurationMs,
      status: frames.length > 0 ? 'OK' : 'ERROR',
      inputSummary: { duration: metadata.duration, timeRange },
      outputSummary: { framesExtracted: frames.length },
    });

    if (frames.length === 0) {
      throw new Error('No frames could be extracted from the video.');
    }

    Logger.video.info(`Extracted ${frames.length} frames`);

    // 3. Run pose detection
    const poseStartMs = pipelineTimer.elapsed();
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
    const poseDurationMs = poseTimer.stop();
    stageTimings['pose'] = poseDurationMs;
    stageTraces.push({
      name: 'pose',
      startMs: poseStartMs,
      durationMs: poseDurationMs,
      status: poseFrames.length > 0 ? 'OK' : 'ERROR',
      inputSummary: { frames: frames.length },
      outputSummary: { trackedFrames: poseFrames.length },
    });

    if (poseFrames.length === 0) {
      throw new Error('No person detected in any frame. Ensure the golfer is visible in the video.');
    }

    const clipDuration = timeRange
      ? Math.max(0.1, Math.min(metadata.duration, timeRange.endTime) - Math.max(0, timeRange.startTime))
      : metadata.duration;
    const totalVideoFrames = Math.round(clipDuration * (metadata.frameRate || 30));

    const analyzedMetadata: VideoMetadata = timeRange
      ? {
          ...metadata,
          duration: clipDuration,
          sourceDuration: metadata.duration,
        }
      : metadata;

    // Preserve media file timestamp for video player/overlay synchronization.
    // Calculate realTimestamp for real-world elapsed time (slow-motion tempo and velocity).
    const speedMultiplier = metadata.slowMotion?.speedMultiplier ?? 1.0;
    const effectiveAnalysisFps = ANALYSIS_FRAME_RATE * speedMultiplier;
    const enrichedPoseFrames = poseFrames.map(f => ({
      ...f,
      realTimestamp: metadata.slowMotion?.isSlowMotion
        ? normalizeTimestampToRealSeconds(f.timestamp, metadata.slowMotion)
        : f.timestamp,
    }));

    // 4. Build raw timeline for quality checks (using media timestamps for video player sync)
    const rawTimeline = buildTimeline(enrichedPoseFrames, totalVideoFrames, pipelineTimer.elapsed(), effectiveAnalysisFps);

    // 5. Evaluate video quality (Finding 4: Quality Gate against analyzed clip duration)
    const qualStartMs = pipelineTimer.elapsed();
    const qualityTimer = new PerformanceTimer('stage.quality');
    const qualityResult = evaluateVideoQuality(rawTimeline, analyzedMetadata);
    const qualDurationMs = qualityTimer.stop();
    stageTimings['quality'] = qualDurationMs;
    const isQualityFailed = qualityResult.overallStatus === 'FAIL' || !qualityResult.analysisRecommended;
    stageTraces.push({
      name: 'quality',
      startMs: qualStartMs,
      durationMs: qualDurationMs,
      status: isQualityFailed ? 'WARN' : 'OK',
      inputSummary: { timeline: 'raw' },
      outputSummary: { status: qualityResult.overallStatus },
    });

    // 6. Run pose stabilization
    const stabStartMs = pipelineTimer.elapsed();
    const stabilizationTimer = new PerformanceTimer('stage.stabilization');
    const stabilizationResult = stabilizePoseTimeline(enrichedPoseFrames);
    const stabilizedFrames = stabilizationResult.frames;
    const stabilizedTimeline = buildTimeline(
      stabilizedFrames,
      totalVideoFrames,
      pipelineTimer.elapsed(),
      effectiveAnalysisFps
    );
    const stabDurationMs = stabilizationTimer.stop();
    stageTimings['stabilization'] = stabDurationMs;
    const stabReport = stabilizationResult.report;
    stageTraces.push({
      name: 'stabilization',
      startMs: stabStartMs,
      durationMs: stabDurationMs,
      status: stabReport.outliersDetected > stabReport.totalFrames * 0.2 ? 'WARN' : 'OK',
      inputSummary: { frames: poseFrames.length },
      outputSummary: { outliers: stabReport.outliersDetected },
    });

    // 7. Detect swing events
    const eventsStartMs = pipelineTimer.elapsed();
    const eventsTimer = new PerformanceTimer('stage.events');
    const eventDetector = new RuleBasedSwingEventDetectorV1();
    const eventResult = eventDetector.detect(stabilizedTimeline, config);
    const eventsDurationMs = eventsTimer.stop();
    stageTimings['events'] = eventsDurationMs;
    stageTraces.push({
      name: 'events',
      startMs: eventsStartMs,
      durationMs: eventsDurationMs,
      status: eventResult.warnings.length > 0 ? 'WARN' : 'OK',
      inputSummary: { timeline: 'stabilized' },
      outputSummary: { detectedEvents: eventResult.detectedCount },
    });

    // 8. Calculate all metrics using registry
    const metricsStartMs = pipelineTimer.elapsed();
    onStatus({ type: 'calculating' });
    const metricsTimer = new PerformanceTimer('stage.metrics');
    const registry = createDefaultRegistry();
    const metricsMap = registry.calculateAvailable(stabilizedTimeline, config, eventResult);
    const metrics: Record<string, MetricResultV1> = {};
    for (const [id, value] of metricsMap.entries()) {
      if (isQualityFailed) {
        metrics[id] = {
          ...value,
          status: 'NOT_RELIABLE',
          confidence: Math.min(value.confidence, 0.3),
          warnings: [...value.warnings, 'Metric unverified due to video quality gate failure.'],
        };
      } else {
        metrics[id] = value;
      }
    }
    const metricsDurationMs = metricsTimer.stop();
    stageTimings['metrics'] = metricsDurationMs;
    stageTraces.push({
      name: 'metrics',
      startMs: metricsStartMs,
      durationMs: metricsDurationMs,
      status: isQualityFailed ? 'WARN' : 'OK',
      inputSummary: { events: eventResult.detectedCount },
      outputSummary: { metricsCount: Object.keys(metrics).length },
    });

    // 9. Calculate confidence summary
    const confStartMs = pipelineTimer.elapsed();
    const detectedEvents = eventResult.events.filter(e => e.timestampMs !== null);
    const eventsConfidence = detectedEvents.length > 0
      ? detectedEvents.reduce((acc, curr) => acc + curr.confidence, 0) / detectedEvents.length
      : 0.0;

    const metricKeys = Object.keys(metrics);
    const metricsConfidence = metricKeys.length > 0
      ? metricKeys.reduce((acc, key) => acc + metrics[key].confidence, 0) / metricKeys.length
      : 0.0;

    const rawOverallConfidence = (
      qualityResult.confidence * 0.2 +
      stabilizedTimeline.averageConfidence * 0.3 +
      eventsConfidence * 0.3 +
      metricsConfidence * 0.2
    );

    const overallConfidence = isQualityFailed ? Math.min(rawOverallConfidence, 0.3) : rawOverallConfidence;

    const confidenceSummary: ConfidenceSummary = {
      video: qualityResult.confidence,
      pose: stabilizedTimeline.averageConfidence,
      events: eventsConfidence,
      metrics: metricsConfidence,
      overall: Math.min(1.0, Math.max(0.0, overallConfidence)),
    };
    const confDurationMs = pipelineTimer.elapsed() - confStartMs;
    stageTraces.push({
      name: 'confidence',
      startMs: confStartMs,
      durationMs: confDurationMs,
      status: 'OK',
      inputSummary: { source: 'metrics & events' },
      outputSummary: { overallScore: overallConfidence },
    });

    // 10. Aggregate warnings
    const warnStartMs = pipelineTimer.elapsed();
    const videoWarnings: AnalysisWarning[] = qualityResult.warnings.map(w => ({
      code: w.code,
      source: 'VIDEO_QUALITY',
      severity: w.severity,
      message: w.message,
      userMessage: w.severity === 'error' || w.severity === 'warning' ? w.message : undefined,
    }));

    if (isQualityFailed) {
      videoWarnings.unshift({
        code: 'QUALITY_GATE_FAIL',
        source: 'VIDEO_QUALITY',
        severity: 'error',
        message: 'Video quality check failed. Analysis results may be inaccurate.',
        userMessage: 'Video failed quality standards (lighting, occlusion, or blur). Results marked unverified.',
      });
    }

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
    const warnDurationMs = pipelineTimer.elapsed() - warnStartMs;
    stageTraces.push({
      name: 'warnings',
      startMs: warnStartMs,
      durationMs: warnDurationMs,
      status: warnings.technical.length > 0 ? 'WARN' : 'OK',
      inputSummary: { source: 'pipeline results' },
      outputSummary: { warningCount: warnings.technical.length },
    });

    // 11. Build result structures
    const totalTimeMs = pipelineTimer.stop();

    const processing: ProcessingStatsV2 = {
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

    const poseSummaryV2: PoseSummaryV2 = {
      providerName: engine.name,
      providerVersion: engine.version,
      landmarkCount: engine.landmarkCount,
      framesAnalyzed: poseFrames.length,
      framesReliable: stabilizedTimeline.reliableFrameCount,
      framesEmpty: frames.length - poseFrames.length,
      averageConfidence: stabilizedTimeline.averageConfidence,
      engineMode: engineConfig?.mode === 'REAL' ? 'REAL' : 'MOCK',
    };

    const pipelineTrace: PipelineTrace = {
      stages: stageTraces,
      totalDurationMs: totalTimeMs,
      engineProvider: engine.name,
      engineVersion: engine.version,
    };

    const version: VersionMetadataV2 = {
      appVersion: '1.0.0',
      schemaVersion: '2.0.0',
      poseEngineVersion: engine.version,
      eventDetectorVersion: eventDetector.version,
    };

    const analysisResult: AnalysisResultV2 = {
      schemaVersion: '2.0.0',
      analysisId: generateAnalysisId(),
      timestamp: new Date().toISOString(),
      subject: 'SELF_ADULT',
      audiencePolicy: { type: 'ADULT_SELF', policyVersion: '1.0.0' },
      video: analyzedMetadata,
      swingConfig: config,
      processing,
      pose: poseSummaryV2,
      quality: qualityResult,
      stabilization: stabReport,
      events: eventResult,
      metrics,
      confidence: confidenceSummary,
      warnings,
      version,
      pipelineTrace,
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
    // Clean up temporary extracted frames to prevent storage leaks (Finding 3: protect source video)
    if (frames && frames.length > 0) {
      try {
        const { deleteAsync } = require('expo-file-system/legacy');
        if (deleteAsync) {
          for (const frame of frames) {
            const uri = frame.imageUri;
            // Never attempt to delete the user's source video, data URIs, or blob URIs
            if (
              uri &&
              uri !== videoUri &&
              !uri.startsWith('data:') &&
              !uri.startsWith('blob:') &&
              uri.startsWith('file://')
            ) {
              try {
                await deleteAsync(uri, { idempotent: true });
              } catch (e) {
                Logger.video.warn(`Failed to clean up temporary frame: ${uri}`, { error: String(e) });
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
