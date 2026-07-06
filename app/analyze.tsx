/**
 * analyze.tsx — Processing Screen (hidden from tabs)
 * SwingSwang
 *
 * Shows progress during analysis pipeline execution.
 */

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { statusDisplayText, statusProgress } from '../src/types/pose';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

export default function AnalyzeScreen() {
  useTheme(); // Subscribe to theme changes
  const { status } = useAnalysis();
  const progress = statusProgress(status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={COLORS.textPrimary} />
        <Text style={styles.statusText}>{statusDisplayText(status)}</Text>

        {progress !== null && (
          <ProgressBar
            progress={progress}
            showPercent
            style={styles.progressBar}
          />
        )}

        {status.type === 'analyzing' && (
          <Text style={styles.detailText}>
            Frame {status.framesComplete} of {status.framesTotal}
          </Text>
        )}

        {status.type === 'failed' && (
          <Text style={styles.errorText}>{status.error}</Text>
        )}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  statusText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold as any,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    marginTop: SPACING.lg,
  },
  detailText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});
