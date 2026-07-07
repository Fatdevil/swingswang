/**
 * debug.tsx — Debug Screen
 * SwingSwang
 *
 * Technical debug information for development.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { getRecentLogs, LogEntry, LogLevel } from '../src/utils/logger';
import { LANDMARK_NAMES, LandmarkID } from '../src/types/landmarks';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY } from '../src/constants/theme';
export default function DebugScreen() {
  const { analysisResult, poseTimeline, status, videoSource } = useAnalysis();
  const [showLogs, setShowLogs] = useState(false);
  const [showRawJSON, setShowRawJSON] = useState(false);

  const logs = getRecentLogs();

  // Get last frame for landmark display
  const lastFrame = poseTimeline?.frames[poseTimeline.frames.length - 1] ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Debug Console</Text>

        {/* Status */}
        <Card title="Pipeline Status">
          <Text style={styles.mono}>
            Status: {JSON.stringify(status)}
          </Text>
          <Text style={styles.mono}>
            Video: {videoSource ? 'loaded' : 'none'}
          </Text>
          <Text style={styles.mono}>
            Timeline: {poseTimeline ? `${poseTimeline.analyzedFrameCount} frames` : 'none'}
          </Text>
          <Text style={styles.mono}>
            Result: {analysisResult ? 'available' : 'none'}
          </Text>
        </Card>

        {/* Timeline Stats */}
        {poseTimeline && (
          <Card title="Timeline Stats" style={styles.section}>
            <Text style={styles.mono}>Frames analyzed: {poseTimeline.analyzedFrameCount}</Text>
            <Text style={styles.mono}>Frames reliable: {poseTimeline.reliableFrameCount}</Text>
            <Text style={styles.mono}>Avg confidence: {poseTimeline.averageConfidence.toFixed(4)}</Text>
            <Text style={styles.mono}>Time range: {poseTimeline.startTime.toFixed(3)}s – {poseTimeline.endTime.toFixed(3)}s</Text>
            <Text style={styles.mono}>Analysis FPS: {poseTimeline.analyzedFPS}</Text>
            <Text style={styles.mono}>Processing: {poseTimeline.processingDuration.toFixed(0)}ms</Text>
          </Card>
        )}

        {/* Last Frame Landmarks */}
        {lastFrame && (
          <Card title={`Frame ${lastFrame.frameIndex} Landmarks`} style={styles.section}>
            <View style={styles.landmarkHeader}>
              <Text style={[styles.mono, styles.lmName]}>Landmark</Text>
              <Text style={[styles.mono, styles.lmCoord]}>X</Text>
              <Text style={[styles.mono, styles.lmCoord]}>Y</Text>
              <Text style={[styles.mono, styles.lmConf]}>Conf</Text>
            </View>
            {Array.from(lastFrame.landmarks.entries())
              .sort(([a], [b]) => a - b)
              .map(([id, lm]) => (
                <View key={id} style={styles.landmarkRow}>
                  <Text style={[styles.mono, styles.lmName, { color: lm.confidence > 0.5 ? COLORS.success : COLORS.error }]}>
                    {LANDMARK_NAMES[id as LandmarkID]}
                  </Text>
                  <Text style={[styles.mono, styles.lmCoord]}>{lm.x.toFixed(3)}</Text>
                  <Text style={[styles.mono, styles.lmCoord]}>{lm.y.toFixed(3)}</Text>
                  <Text style={[styles.mono, styles.lmConf]}>{(lm.confidence * 100).toFixed(0)}%</Text>
                </View>
              ))}
          </Card>
        )}

        {/* V1 Diagnostics */}
        {analysisResult && 'schemaVersion' in analysisResult && (analysisResult as any).schemaVersion === '1.0' && (
          <>
            {/* Confidence summary */}
            <Card title="V1 Confidence Scores" style={styles.section}>
              <Text style={styles.mono}>Overall: {((analysisResult as any).confidence.overall * 100).toFixed(0)}%</Text>
              <Text style={styles.mono}>Video quality: {((analysisResult as any).confidence.video * 100).toFixed(0)}%</Text>
              <Text style={styles.mono}>Pose estimation: {((analysisResult as any).confidence.pose * 100).toFixed(0)}%</Text>
              <Text style={styles.mono}>Swing events: {((analysisResult as any).confidence.events * 100).toFixed(0)}%</Text>
              <Text style={styles.mono}>Biomechanics: {((analysisResult as any).confidence.metrics * 100).toFixed(0)}%</Text>
            </Card>

            {/* Quality gate */}
            {(analysisResult as any).quality && (
              <Card title="Video Quality Gate" style={styles.section}>
                <Text style={styles.mono}>Overall status: {(analysisResult as any).quality.overallStatus}</Text>
                <Text style={styles.mono}>Confidence: {((analysisResult as any).quality.confidence * 100).toFixed(0)}%</Text>
                <Text style={styles.mono}>Body visibility: {(analysisResult as any).quality.checks.bodyVisibility.status}</Text>
                <Text style={styles.mono}>Golfer size: {(analysisResult as any).quality.checks.golferSize.status} (ratio: {((analysisResult as any).quality.checks.golferSize.bodyRatio * 100).toFixed(1)}%)</Text>
                <Text style={styles.mono}>Pose coverage: {(analysisResult as any).quality.checks.poseCoverage.status} (reliable ratio: {((analysisResult as any).quality.checks.poseCoverage.reliableRatio * 100).toFixed(1)}%)</Text>
                <Text style={styles.mono}>Video suitability: {(analysisResult as any).quality.checks.videoSuitability.status}</Text>
              </Card>
            )}

            {/* Stabilization report */}
            {(analysisResult as any).stabilization && (
              <Card title="Stabilization Report" style={styles.section}>
                <Text style={styles.mono}>Total frames: {(analysisResult as any).stabilization.totalFrames}</Text>
                <Text style={styles.mono}>Filtered landmarks: {(analysisResult as any).stabilization.landmarksFiltered}</Text>
                <Text style={styles.mono}>Outliers removed: {(analysisResult as any).stabilization.outliersDetected}</Text>
                <Text style={styles.mono}>Gaps interpolated: {(analysisResult as any).stabilization.gapsInterpolated}</Text>
                <Text style={styles.mono}>Gaps rejected: {(analysisResult as any).stabilization.gapsRejected}</Text>
                <Text style={styles.mono}>Adaptive smoothing: {(analysisResult as any).stabilization.smoothingApplied ? 'Yes' : 'No'}</Text>
              </Card>
            )}

            {/* Swing events */}
            {(analysisResult as any).events && (
              <Card title="Detected Swing Events" style={styles.section}>
                <Text style={styles.mono}>Total detected: {(analysisResult as any).events.detectedCount}</Text>
                <Text style={styles.mono}>Reliable events: {(analysisResult as any).events.reliableCount}</Text>
                {((analysisResult as any).events.events as any[]).map((e, idx) => (
                  <Text key={e.event + idx} style={styles.mono}>
                    • {e.event}: {e.timestampMs !== null ? `${(e.timestampMs / 1000).toFixed(3)}s` : 'Not detected'} ({e.status}, {Math.round(e.confidence * 100)}%)
                  </Text>
                ))}
              </Card>
            )}

            {/* V1 Metrics */}
            <Card title="Registered Metrics (V1)" style={styles.section}>
              {Object.keys((analysisResult as any).metrics).map((key) => {
                const metric = (analysisResult as any).metrics[key];
                return (
                  <Text key={key} style={styles.mono}>
                    • {metric.name} ({metric.id}): {metric.value !== null ? metric.value.toFixed(2) : 'null'} {metric.unit} ({metric.status}, {Math.round(metric.confidence * 100)}%)
                  </Text>
                );
              })}
            </Card>
          </>
        )}

        {/* Logs */}
        <View style={styles.section}>
          <Button
            title={showLogs ? 'HIDE LOGS' : `SHOW LOGS (${logs.length})`}
            onPress={() => setShowLogs(!showLogs)}
            variant="ghost"
          />
        </View>

        {showLogs && (
          <Card title="Recent Logs" style={styles.section}>
            {logs.slice(-50).reverse().map((log, i) => (
              <Text
                key={i}
                style={[styles.logLine, { color: logColor(log.level) }]}
              >
                [{log.level}][{log.category}] {log.message}
              </Text>
            ))}
          </Card>
        )}

        {/* Raw JSON */}
        {analysisResult && (
          <View style={styles.section}>
            <Button
              title={showRawJSON ? 'HIDE JSON' : 'SHOW RAW JSON'}
              onPress={() => setShowRawJSON(!showRawJSON)}
              variant="ghost"
            />
          </View>
        )}

        {showRawJSON && analysisResult && (
          <Card style={styles.section}>
            <Text style={styles.mono} selectable>
              {JSON.stringify(analysisResult, null, 2)}
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function logColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.Error: return COLORS.error;
    case LogLevel.Warn: return COLORS.warning;
    case LogLevel.Info: return COLORS.info;
    case LogLevel.Debug: return COLORS.textTertiary;
    default: return COLORS.textTertiary;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
  },
  title: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold as any,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  section: {
    marginTop: SPACING.md,
  },
  mono: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  landmarkHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: 4,
    marginBottom: 4,
  },
  landmarkRow: {
    flexDirection: 'row',
    paddingVertical: 1,
  },
  lmName: {
    flex: 3,
  },
  lmCoord: {
    flex: 1.5,
    textAlign: 'right',
  },
  lmConf: {
    flex: 1,
    textAlign: 'right',
  },
  logLine: {
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});
