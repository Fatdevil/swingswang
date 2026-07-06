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
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

export default function DebugScreen() {
  useTheme(); // Subscribe to theme changes
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
