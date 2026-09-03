/**
 * StreakCard.tsx
 * SwingSwang
 *
 * Displays the daily streak counter with tier-based flame colors.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';

interface StreakCardProps {
  streakCount: number;
}

function getStreakColor(streak: number): string {
  if (streak >= 500) return '#A855F7'; // Purple
  if (streak >= 100) return '#EF4444'; // Red
  if (streak >= 50) return '#F97316';  // Orange
  if (streak >= 10) return '#EAB308';  // Yellow
  return COLORS.accent;                // Emerald Green
}

export function StreakCard({ streakCount }: StreakCardProps) {
  const streakColor = getStreakColor(streakCount);
  const subtitle = streakCount > 0 ? 'Keep it going!' : 'Log in tomorrow';
  const dayUnit = streakCount === 1 ? 'day' : 'days';

  return (
    <View
      style={styles.streakBox}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Daily streak: ${streakCount} ${dayUnit}. ${subtitle}`}
    >
      <Text style={styles.streakLabel}>DAILY STREAK</Text>
      <View style={styles.streakRow}>
        <Ionicons name="flame" size={24} color={streakColor} />
        <Text style={[styles.streakValue, { color: streakColor }]}>
          {streakCount} {streakCount === 1 ? 'Day' : 'Days'}
        </Text>
      </View>
      <Text style={styles.streakSubtitle}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  streakBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    marginBottom: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  streakValue: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  streakSubtitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
  },
});
