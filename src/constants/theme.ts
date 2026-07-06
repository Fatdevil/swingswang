/**
 * theme.ts
 * SwingSwang
 *
 * Minimal light theme with white background and modern light green accents.
 * Mobile-first, modern, clean contrast.
 */

import { Platform } from 'react-native';

export const COLORS = {
  /** Primary background — crisp white. */
  background: '#FFFFFF',
  /** Slightly elevated surface. */
  surface: '#F8FAFC',
  /** Card backgrounds. */
  card: '#F1F5F9',
  /** Elevated card / active state. */
  cardElevated: '#E2E8F0',
  /** Primary text — Charcoal / Dark Grey. */
  textPrimary: '#1F2937',
  /** Secondary text — Medium Grey. */
  textSecondary: '#4B5563',
  /** Tertiary text — Light Grey. */
  textTertiary: '#9CA3AF',
  /** Primary accent — modern emerald green. */
  accent: '#10B981',
  /** Accent muted. */
  accentMuted: '#34D399',
  /** Success / reliable. */
  success: '#10B981',
  /** Warning / marginal. */
  warning: '#F59E0B',
  /** Error / not reliable. */
  error: '#EF4444',
  /** Info / processing. */
  info: '#3B82F6',
  /** Border — subtle. */
  border: '#E2E8F0',
  /** Divider line. */
  divider: '#F1F5F9',
  /** Skeleton overlay — light green bones. */
  skeletonBone: 'rgba(16, 185, 129, 0.15)',
  /** Skeleton joint. */
  skeletonJoint: 'rgba(16, 185, 129, 0.4)',
  /** Overlay background. */
  overlay: 'rgba(15, 23, 42, 0.3)',
} as const;

export const FONT_FAMILY = 'KGRedHands';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  hero: 36,
} as const;

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,
};
