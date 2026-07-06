/**
 * Card.tsx
 * SwingSwang
 *
 * Reusable card container.
 */

import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY } from '../../constants/theme';

interface CardProps {
  children: ReactNode;
  title?: string;
  elevated?: boolean;
  style?: ViewStyle;
}

export function Card({ children, title, elevated = false, style }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  elevated: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.divider,
  },
  title: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
  },
});
