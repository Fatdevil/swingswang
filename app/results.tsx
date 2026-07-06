/**
 * results.tsx — Technical Results
 * SwingSwang
 *
 * Displays metric results, pose quality, and export options.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { MetricResultCard } from '../src/components/ui/MetricResultCard';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { exportToJSON, copyToClipboard } from '../src/features/analysis/analysisExporter';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../src/constants/theme';

export default function ResultsScreen() {
  const { analysisResult } = useAnalysis();

  if (!analysisResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyText}>
            Analyze a video from the Home tab to see results.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { metrics, pose, processing, warnings } = analysisResult;

  const handleExport = async () => {
    try {
      await copyToClipboard(analysisResult);
      Alert.alert('Copied', 'Analysis results copied to clipboard as JSON.');
    } catch {
      Alert.alert('Error', 'Failed to copy to clipboard.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>Analysis Results</Text>
        <Text style={styles.subtitle}>Phase 0 • Schema v{analysisResult.schemaVersion}</Text>

        {/* Metrics */}
        <Text style={styles.sectionTitle}>MEASUREMENTS</Text>
        <MetricResultCard result={metrics.headMovement} />
        <MetricResultCard result={metrics.torsoAngleChange} />
        <MetricResultCard result={metrics.hipMovementProxy} />

        {/* Pose Quality */}
        <Text style={styles.sectionTitle}>POSE QUALITY</Text>
        <Card>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Provider</Text>
            <Text style={styles.statValue}>{pose.providerName} {pose.providerVersion}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Landmarks</Text>
            <Text style={styles.statValue}>{pose.landmarkCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Frames analyzed</Text>
            <Text style={styles.statValue}>{pose.framesAnalyzed}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Reliable frames</Text>
            <Text style={styles.statValue}>{pose.framesReliable}</Text>
          </View>
          <ProgressBar
            progress={pose.averageConfidence}
            label="Average Confidence"
            color={pose.averageConfidence >= 0.7 ? COLORS.success : COLORS.warning}
            style={styles.confBar}
          />
        </Card>

        {/* Processing Stats */}
        <Text style={styles.sectionTitle}>PROCESSING</Text>
        <Card>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total time</Text>
            <Text style={styles.statValue}>{(processing.totalTimeMs / 1000).toFixed(1)}s</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Frames extracted</Text>
            <Text style={styles.statValue}>{processing.framesExtracted}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Empty frames</Text>
            <Text style={styles.statValue}>{processing.framesEmpty}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Avg frame time</Text>
            <Text style={styles.statValue}>{processing.averageFrameTimeMs.toFixed(1)}ms</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Analysis FPS</Text>
            <Text style={styles.statValue}>{processing.analysisFrameRate}</Text>
          </View>
        </Card>

        {/* Warnings */}
        {warnings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>WARNINGS</Text>
            <Card>
              {warnings.map((w, i) => (
                <Text key={i} style={styles.warningText}>⚠ {w}</Text>
              ))}
            </Card>
          </>
        )}

        {/* Export */}
        <View style={styles.exportSection}>
          <Button
            title="EXPORT JSON TO CLIPBOARD"
            onPress={handleExport}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold as any,
    marginTop: SPACING.xl,
  },
  subtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
  statValue: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontVariant: ['tabular-nums'],
  },
  confBar: {
    marginTop: SPACING.md,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
    marginBottom: 4,
  },
  exportSection: {
    marginTop: SPACING.xl,
  },
});
