/**
 * ScoreCard.tsx
 * SwingSwang
 *
 * Displays the average swing score with history count and clear button.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';

interface ScoreCardProps {
  history: number[];
  onClearHistory: () => void;
}

export function ScoreCard({ history, onClearHistory }: ScoreCardProps) {
  const averageScore = history.length > 0
    ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(1)
    : null;

  return (
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
          <Pressable onPress={onClearHistory} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={14} color={COLORS.error} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: COLORS.accent,
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
});
