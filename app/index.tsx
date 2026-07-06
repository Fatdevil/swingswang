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
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY } from '../src/constants/theme';
export default function HomeScreen() {
  const router = useRouter();
  const {
    videoSource,
    status,
    analysisResult,
    selectAndLoadVideo,
    startAnalysis,
    resetAnalysis,
    history,
    clearHistory,
  } = useAnalysis();

  const handleAnalyze = async () => {
    const success = await startAnalysis();
    if (success) {
      router.push('/player');
    }
  };

  const averageScore = history.length > 0
    ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(1)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Top Widgets Row (Average Score & Future Slot) */}
        <View style={styles.topRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>AVG SCORE</Text>
            <Text style={styles.scoreValue}>
              {averageScore !== null ? `${averageScore}/10` : '-/10'}
            </Text>
            <View style={styles.scoreFooter}>
              <Text style={styles.scoreSubtitle}>
                {history.length} {history.length === 1 ? 'swing' : 'swings'}
              </Text>
              {history.length > 0 && (
                <Pressable onPress={clearHistory} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.placeholderBox}>
            <Ionicons name="add" size={24} color={COLORS.textTertiary} style={{ opacity: 0.3 }} />
            <Text style={styles.placeholderText}>Reserved Slot</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionSection}>
          {/* Status indicator */}
          {status.type !== 'idle' && status.type !== 'ready' && (
            <Text style={styles.statusText}>{statusDisplayText(status)}</Text>
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
    paddingTop: SPACING.xl,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    width: '100%',
  },
  scoreBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreValue: {
    fontFamily: FONT_FAMILY,
    color: COLORS.accent, // modern light green
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  scoreFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  scoreSubtitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
  },
  clearBtn: {
    padding: 2,
  },
  placeholderBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  placeholderText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
    opacity: 0.7,
  },
  actionSection: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  statusText: {
    fontFamily: FONT_FAMILY,
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
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
  metaValue: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontVariant: ['tabular-nums'],
  },
  completeText: {
    fontFamily: FONT_FAMILY,
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
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginBottom: SPACING.md,
    opacity: 0.5,
  },
  instructionText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  plusSymbol: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
});
