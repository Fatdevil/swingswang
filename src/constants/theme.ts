/**
 * theme.ts
 * SwingSwang
 *
 * Minimal black/white theme with yin-yang inspiration.
 * Mobile-first, modern, balanced.
 */

import { getActiveThemeColors } from '../context/ThemeContext';

export const COLORS = new Proxy({} as any, {
  get(_, prop: string) {
    const active = getActiveThemeColors();
    return active[prop as keyof typeof active] || '#000000';
  }
});

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
