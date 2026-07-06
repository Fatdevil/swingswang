/**
 * index.tsx — Home Screen
 * SwingSwang
 *
 * Hero landing + video selection + analysis trigger.
 */

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { isProcessing, statusDisplayText } from '../src/types/pose';
import { formatDuration, formatResolution, formatFileSize } from '../src/types/video';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

export default function HomeScreen() {
  const router = useRouter();
  useTheme(); // Subscribe to theme changes
  const {
    videoSource,
    status,
    analysisResult,
    selectAndLoadVideo,
    startAnalysis,
    resetAnalysis,
  } = useAnalysis();

  const handleAnalyze = async () => {
    const success = await startAnalysis();
    if (success) {
      router.push('/player');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Settings Button */}
      <Pressable
        onPress={() => router.push('/settings')}
        style={styles.settingsButton}
      >
        <Ionicons name="settings-outline" size={24} color={COLORS.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>SWING{'\n'}SWANG</Text>
          <Text style={styles.heroTagline}>
            Analyze your swing.{'\n'}
            Understand your movement.{'\n'}
            Improve one swing at a time.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionSection}>
          {/* Status indicator */}
          {status.type !== 'idle' && status.type !== 'ready' && (
            <Text style={styles.statusText}>{statusDisplayText(status)}</Text>
          )}

          {/* No video loaded */}
          {!videoSource && (
            <Text style={styles.instructionText}>
              Tap the <Text style={styles.plusSymbol}>+</Text> button below to select and analyze a golf swing.
            </Text>
          )}

          {/* Video loaded — show info and process button */}
          {videoSource && !analysisResult && (
            <>
              <Card title="Selected Video" style={styles.videoCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{formatDuration(videoSource.metadata.duration)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Resolution</Text>
                  <Text style={styles.metaValue}>
                    {formatResolution(videoSource.metadata.width, videoSource.metadata.height)}
                  </Text>
                </View>
                {videoSource.metadata.fileSize && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Size</Text>
                    <Text style={styles.metaValue}>{formatFileSize(videoSource.metadata.fileSize)}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Orientation</Text>
                  <Text style={styles.metaValue}>{videoSource.metadata.orientation}</Text>
                </View>
              </Card>

              <Button
                title="PROCESS VIDEO"
                onPress={handleAnalyze}
                variant="primary"
                loading={isProcessing(status)}
                disabled={isProcessing(status)}
                style={styles.processBtn}
              />

              <Button
                title="Choose different video"
                onPress={selectAndLoadVideo}
                variant="ghost"
              />
            </>
          )}

          {/* Analysis complete */}
          {analysisResult && (
            <>
              <Card title="Analysis Complete" style={styles.videoCard}>
                <Text style={styles.completeText}>
                  {analysisResult.processing.framesAnalyzed} frames analyzed • {' '}
                  {analysisResult.pose.framesReliable} reliable
                </Text>
              </Card>

              <Button
                title="VIEW RESULTS"
                onPress={() => router.push('/results')}
                variant="primary"
                style={styles.processBtn}
              />

              <Button
                title="VIEW PLAYER"
                onPress={() => router.push('/player')}
                variant="secondary"
                style={styles.secondaryBtn}
              />

              <Button
                title="Start over"
                onPress={resetAnalysis}
                variant="ghost"
              />
            </>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.version}>Phase 0 • v0.1.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
  },
  heroSection: {
    marginTop: SPACING.xxl * 2,
  },
  heroTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.hero + 12,
    fontWeight: FONT_WEIGHT.black as any,
    lineHeight: 52,
    letterSpacing: 2,
  },
  heroTagline: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.md,
    lineHeight: 24,
    marginTop: SPACING.md,
  },
  actionSection: {
    marginBottom: SPACING.xl,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  videoCard: {
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
  metaValue: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontVariant: ['tabular-nums'],
  },
  completeText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.sm,
  },
  processBtn: {
    marginTop: SPACING.sm,
  },
  secondaryBtn: {
    marginTop: SPACING.sm,
  },
  version: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginBottom: SPACING.md,
    opacity: 0.5,
  },
  instructionText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  plusSymbol: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  settingsButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.lg,
    zIndex: 10,
    padding: SPACING.xs,
  },
});
