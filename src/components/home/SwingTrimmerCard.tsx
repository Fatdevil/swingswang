/**
 * SwingTrimmerCard.tsx
 * SwingSwang
 *
 * Interactive trimmer card for selecting the swing portion of a video.
 * Crucial for slow-motion and long gallery videos to avoid processing
 * dozens of idle seconds.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';
import { SlowMotionInfo } from '@/types/video';

export interface SwingTrimmerCardProps {
  duration: number; // Video duration in seconds
  slowMotion?: SlowMotionInfo;
  startTime: number;
  endTime: number;
  onRangeChange: (range: { startTime: number; endTime: number }) => void;
  disabled?: boolean;
}

export function SwingTrimmerCard({
  duration,
  slowMotion,
  startTime,
  endTime,
  onRangeChange,
  disabled = false,
}: SwingTrimmerCardProps) {
  const safeDuration = Math.max(0.1, duration);
  const currentStart = Math.max(0, Math.min(startTime, safeDuration));
  const currentEnd = Math.max(currentStart + 0.5, Math.min(endTime, safeDuration));

  const speedMultiplier = slowMotion?.speedMultiplier ?? 1.0;
  const isSlowMo = !!slowMotion?.isSlowMotion;

  const clipDuration = Math.max(0.1, currentEnd - currentStart);
  const realDuration = clipDuration / speedMultiplier;
  const estimatedFrames = Math.round(clipDuration * 15);

  const startPercent = Math.max(0, Math.min(100, (currentStart / safeDuration) * 100));
  const widthPercent = Math.max(2, Math.min(100 - startPercent, (clipDuration / safeDuration) * 100));

  const adjustStart = (delta: number) => {
    if (disabled) return;
    const nextStart = Math.max(0, Math.min(currentStart + delta, currentEnd - 0.5));
    onRangeChange({ startTime: Number(nextStart.toFixed(1)), endTime: currentEnd });
  };

  const adjustEnd = (delta: number) => {
    if (disabled) return;
    const nextEnd = Math.min(safeDuration, Math.max(currentEnd + delta, currentStart + 0.5));
    onRangeChange({ startTime: currentStart, endTime: Number(nextEnd.toFixed(1)) });
  };

  const setFullRange = () => {
    if (disabled) return;
    onRangeChange({ startTime: 0, endTime: Number(safeDuration.toFixed(1)) });
  };

  const setPreset = (preset: 'FIRST_HALF' | 'SECOND_HALF' | 'CENTER_8S') => {
    if (disabled) return;
    if (preset === 'FIRST_HALF') {
      onRangeChange({ startTime: 0, endTime: Number((safeDuration / 2).toFixed(1)) });
    } else if (preset === 'SECOND_HALF') {
      onRangeChange({
        startTime: Number((safeDuration / 2).toFixed(1)),
        endTime: Number(safeDuration.toFixed(1)),
      });
    } else if (preset === 'CENTER_8S') {
      const mid = safeDuration / 2;
      const targetLen = Math.min(safeDuration, 8.0);
      const s = Math.max(0, mid - targetLen / 2);
      const e = Math.min(safeDuration, s + targetLen);
      onRangeChange({ startTime: Number(s.toFixed(1)), endTime: Number(e.toFixed(1)) });
    }
  };

  return (
    <Card title="Swing Trimmer" style={styles.card}>
      {isSlowMo && (
        <View style={styles.slowMoBanner}>
          <Ionicons name="speedometer-outline" size={18} color="#10B981" />
          <View style={styles.slowMoTextContainer}>
            <Text style={styles.slowMoTitle}>
              Slow-Motion {slowMotion.estimatedCaptureFps} FPS ({slowMotion.speedMultiplier}x)
            </Text>
            <Text style={styles.slowMoSubtitle}>
              Videon spelas upp långsamt. Klipp gärna till svingsekvensen för snabbare och mer exakt analys.
            </Text>
          </View>
        </View>
      )}

      {/* Visual Timeline Bar */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineTrack}>
          <View
            style={[
              styles.timelineSelection,
              { left: `${startPercent}%`, width: `${widthPercent}%` },
            ]}
          />
        </View>
        <View style={styles.timelineLabels}>
          <Text style={styles.timeLabel}>0.0s</Text>
          <Text style={styles.timeLabelMid}>
            Vald: {clipDuration.toFixed(1)}s ({estimatedFrames} rutor)
          </Text>
          <Text style={styles.timeLabel}>{safeDuration.toFixed(1)}s</Text>
        </View>
      </View>

      {/* Start and End controls */}
      <View style={styles.stepperContainer}>
        {/* START CONTROL */}
        <View style={styles.stepperBox}>
          <Text style={styles.stepperLabel}>START</Text>
          <Text style={styles.stepperValue}>{currentStart.toFixed(1)}s</Text>
          {isSlowMo && (
            <Text style={styles.stepperRealTime}>
              {(currentStart / speedMultiplier).toFixed(2)}s verklig
            </Text>
          )}
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.stepBtn, (disabled || currentStart <= 0) && styles.btnDisabled]}
              onPress={() => adjustStart(-1.0)}
              disabled={disabled || currentStart <= 0}
            >
              <Text style={styles.stepBtnText}>-1s</Text>
            </Pressable>
            <Pressable
              style={[styles.stepBtn, (disabled || currentStart <= 0) && styles.btnDisabled]}
              onPress={() => adjustStart(-0.5)}
              disabled={disabled || currentStart <= 0}
            >
              <Text style={styles.stepBtnText}>-0.5</Text>
            </Pressable>
            <Pressable
              style={[
                styles.stepBtn,
                (disabled || currentStart >= currentEnd - 0.5) && styles.btnDisabled,
              ]}
              onPress={() => adjustStart(0.5)}
              disabled={disabled || currentStart >= currentEnd - 0.5}
            >
              <Text style={styles.stepBtnText}>+0.5</Text>
            </Pressable>
            <Pressable
              style={[
                styles.stepBtn,
                (disabled || currentStart >= currentEnd - 1.0) && styles.btnDisabled,
              ]}
              onPress={() => adjustStart(1.0)}
              disabled={disabled || currentStart >= currentEnd - 1.0}
            >
              <Text style={styles.stepBtnText}>+1s</Text>
            </Pressable>
          </View>
        </View>

        {/* END CONTROL */}
        <View style={styles.stepperBox}>
          <Text style={styles.stepperLabel}>SLUT</Text>
          <Text style={styles.stepperValue}>{currentEnd.toFixed(1)}s</Text>
          {isSlowMo && (
            <Text style={styles.stepperRealTime}>
              {(currentEnd / speedMultiplier).toFixed(2)}s verklig
            </Text>
          )}
          <View style={styles.buttonRow}>
            <Pressable
              style={[
                styles.stepBtn,
                (disabled || currentEnd <= currentStart + 1.0) && styles.btnDisabled,
              ]}
              onPress={() => adjustEnd(-1.0)}
              disabled={disabled || currentEnd <= currentStart + 1.0}
            >
              <Text style={styles.stepBtnText}>-1s</Text>
            </Pressable>
            <Pressable
              style={[
                styles.stepBtn,
                (disabled || currentEnd <= currentStart + 0.5) && styles.btnDisabled,
              ]}
              onPress={() => adjustEnd(-0.5)}
              disabled={disabled || currentEnd <= currentStart + 0.5}
            >
              <Text style={styles.stepBtnText}>-0.5</Text>
            </Pressable>
            <Pressable
              style={[
                styles.stepBtn,
                (disabled || currentEnd >= safeDuration) && styles.btnDisabled,
              ]}
              onPress={() => adjustEnd(0.5)}
              disabled={disabled || currentEnd >= safeDuration}
            >
              <Text style={styles.stepBtnText}>+0.5</Text>
            </Pressable>
            <Pressable
              style={[
                styles.stepBtn,
                (disabled || currentEnd >= safeDuration) && styles.btnDisabled,
              ]}
              onPress={() => adjustEnd(1.0)}
              disabled={disabled || currentEnd >= safeDuration}
            >
              <Text style={styles.stepBtnText}>+1s</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Summary info box */}
      <View style={styles.summaryBox}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
        <Text style={styles.summaryText}>
          {isSlowMo ? (
            <>
              Analysintervall: <Text style={styles.boldText}>{clipDuration.toFixed(1)}s</Text> (~{realDuration.toFixed(2)}s verklig svingtid, {estimatedFrames} bildrutor vid 15 fps)
            </>
          ) : (
            <>
              Analysintervall: <Text style={styles.boldText}>{clipDuration.toFixed(1)}s</Text> ({estimatedFrames} bildrutor vid 15 fps)
            </>
          )}
        </Text>
      </View>

      {/* Quick Presets */}
      <View style={styles.presetRow}>
        <Pressable
          style={[
            styles.presetBtn,
            currentStart === 0 && currentEnd >= Number(safeDuration.toFixed(1)) && styles.presetBtnActive,
          ]}
          onPress={setFullRange}
          disabled={disabled}
        >
          <Text style={styles.presetText}>Hela videon</Text>
        </Pressable>

        {safeDuration >= 6 && (
          <>
            <Pressable
              style={styles.presetBtn}
              onPress={() => setPreset('FIRST_HALF')}
              disabled={disabled}
            >
              <Text style={styles.presetText}>1:a halvan</Text>
            </Pressable>
            <Pressable
              style={styles.presetBtn}
              onPress={() => setPreset('SECOND_HALF')}
              disabled={disabled}
            >
              <Text style={styles.presetText}>2:a halvan</Text>
            </Pressable>
            {safeDuration >= 10 && (
              <Pressable
                style={styles.presetBtn}
                onPress={() => setPreset('CENTER_8S')}
                disabled={disabled}
              >
                <Text style={styles.presetText}>Mitten (8s)</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: SPACING.sm,
  },
  slowMoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  slowMoTextContainer: {
    flex: 1,
  },
  slowMoTitle: {
    color: '#10B981',
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY,
    marginBottom: 2,
  },
  slowMoSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY,
    lineHeight: 16,
  },
  timelineContainer: {
    marginBottom: SPACING.md,
  },
  timelineTrack: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  timelineSelection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY,
  },
  timeLabelMid: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    fontFamily: FONT_FAMILY,
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  stepperBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  stepperLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
    fontFamily: FONT_FAMILY,
  },
  stepperValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    fontFamily: FONT_FAMILY,
    marginVertical: 2,
  },
  stepperRealTime: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: FONT_WEIGHT.medium,
    fontFamily: FONT_FAMILY,
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    justifyContent: 'center',
  },
  stepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: FONT_WEIGHT.semibold,
    fontFamily: FONT_FAMILY,
  },
  btnDisabled: {
    opacity: 0.3,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY,
    flex: 1,
  },
  boldText: {
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  presetBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: '#2563EB',
  },
  presetText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHT.medium,
  },
});
