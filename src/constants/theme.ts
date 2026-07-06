/**
 * theme.ts
 * SwingSwang
 *
 * Minimal black/white theme with yin-yang inspiration.
 * Mobile-first, modern, balanced.
 */

export const COLORS = {
  /** Primary background — deep black. */
  background: '#0A0A0A',
  /** Slightly elevated surface. */
  surface: '#141414',
  /** Card backgrounds. */
  card: '#1C1C1E',
  /** Elevated card / active state. */
  cardElevated: '#2C2C2E',
  /** Primary text — clean white. */
  textPrimary: '#FAFAFA',
  /** Secondary text — muted. */
  textSecondary: '#A1A1AA',
  /** Tertiary text — very muted. */
  textTertiary: '#71717A',
  /** Primary accent — warm white with slight warmth. */
  accent: '#F5F5F4',
  /** Accent muted. */
  accentMuted: '#D4D4D8',
  /** Success / reliable. */
  success: '#22C55E',
  /** Warning / marginal. */
  warning: '#EAB308',
  /** Error / not reliable. */
  error: '#EF4444',
  /** Info / processing. */
  info: '#3B82F6',
  /** Border — subtle. */
  border: '#27272A',
  /** Divider line. */
  divider: '#1E1E1E',
  /** Skeleton overlay — vibrant but not distracting. */
  skeletonBone: 'rgba(250, 250, 250, 0.6)',
  /** Skeleton joint. */
  skeletonJoint: 'rgba(250, 250, 250, 0.9)',
  /** Overlay background. */
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

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
