/**
 * PracticeHub.tsx
 * SwingSwang
 *
 * Practice hub card with daily tip and interactive drill checklist.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';

const PRACTICE_TIPS = [
  "Keep your spine steady. Spine angle stability is key to consistent strikes.",
  "Tempo is everything. Focus on a smooth 3:1 swing rhythm.",
  "Keep your head centered. Avoid swaying left or right during the backswing.",
  "Hip motion should be a rotation, not a lateral slide.",
  "Relax your hands. Heavy grip tension kills your clubhead speed.",
];

interface PracticeHubProps {
  streakCount: number;
  hasAnalysisResult: boolean;
}

export function PracticeHub({ streakCount, hasAnalysisResult }: PracticeHubProps) {
  const [drillDone, setDrillDone] = useState(false);

  const todayIndex = new Date().getDay() % PRACTICE_TIPS.length;
  const tipOfTheDay = PRACTICE_TIPS[todayIndex];

  return (
    <Card title="PRACTICE HUB" style={styles.practiceCard}>
      {/* Daily Tip */}
      <View style={styles.tipBox}>
        <View style={styles.tipHeader}>
          <Ionicons name="bulb" size={16} color={COLORS.warning} />
          <Text style={styles.tipTitle}>TIP OF THE DAY</Text>
        </View>
        <Text style={styles.tipText}>{tipOfTheDay}</Text>
      </View>

      {/* Drills Checklist */}
      <View style={styles.drillSection}>
        <Text style={styles.drillTitle}>TODAY'S DRILLS</Text>
        
        {/* Drill 1: Active Streak */}
        <View style={styles.drillRow}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
          <Text style={[styles.drillText, styles.drillCompleted]}>
            Log in streak active ({streakCount}d)
          </Text>
        </View>

        {/* Drill 2: Analyze Swing */}
        <View style={styles.drillRow}>
          <Ionicons 
            name={hasAnalysisResult ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={hasAnalysisResult ? COLORS.accent : COLORS.textTertiary} 
          />
          <Text style={[
            styles.drillText, 
            hasAnalysisResult && styles.drillCompleted
          ]}>
            Record or analyze a swing
          </Text>
        </View>

        {/* Drill 3: Manual Practice Drill */}
        <Pressable onPress={() => setDrillDone(!drillDone)} style={styles.drillRow}>
          <Ionicons 
            name={drillDone ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={drillDone ? COLORS.accent : COLORS.textTertiary} 
          />
          <Text style={[
            styles.drillText, 
            drillDone && styles.drillCompleted
          ]}>
            Drill: 15 head-still practice rotations
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  practiceCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    marginVertical: SPACING.sm,
  },
  tipBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: SPACING.sm,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  tipTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
  },
  tipText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
  },
  drillSection: {
    marginTop: 4,
  },
  drillTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 6,
  },
  drillText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
  },
  drillCompleted: {
    color: COLORS.textTertiary,
    textDecorationLine: 'line-through',
  },
});
