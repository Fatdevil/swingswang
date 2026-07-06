/**
 * ThemeContext.tsx
 * SwingSwang
 *
 * Theme provider and state management for White/Black, Black/White, and White/Light Green themes.
 * Persists theme state locally using expo-file-system.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const THEME_FILE_PATH = `${documentDirectory}app_theme.json`;

export type ThemeKey = 'white-black' | 'black-white' | 'white-green';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  cardElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentMuted: string;
  border: string;
  divider: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  buttonBackground: string;
  buttonText: string;
  selectedState: string;
  skeletonBone: string;
  skeletonJoint: string;
  overlay: string;
}

export const THEMES: Record<ThemeKey, ThemeColors> = {
  'white-black': {
    background: '#FFFFFF',
    surface: '#F4F4F5',
    card: '#E4E4E7',
    cardElevated: '#D4D4D8',
    textPrimary: '#0A0A0A',
    textSecondary: '#52525B',
    textTertiary: '#82828C',
    accent: '#000000',
    accentMuted: '#52525B',
    border: '#E4E4E7',
    divider: '#E4E4E7',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
    buttonBackground: '#000000',
    buttonText: '#FFFFFF',
    selectedState: '#000000',
    skeletonBone: 'rgba(0, 0, 0, 0.15)',
    skeletonJoint: 'rgba(0, 0, 0, 0.4)',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
  'black-white': {
    background: '#0A0A0A',
    surface: '#141414',
    card: '#1C1C1E',
    cardElevated: '#2C2C2E',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    accent: '#FAFAFA',
    accentMuted: '#D4D4D8',
    border: '#27272A',
    divider: '#1E1E1E',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
    buttonBackground: '#FAFAFA',
    buttonText: '#0A0A0A',
    selectedState: '#FAFAFA',
    skeletonBone: 'rgba(250, 250, 250, 0.6)',
    skeletonJoint: 'rgba(250, 250, 250, 0.9)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  'white-green': {
    background: '#FFFFFF',
    surface: '#F0FDF4', // Light green wash
    card: '#DCFCE7', // Slightly darker green wash
    cardElevated: '#BBF7D0',
    textPrimary: '#0A5C36', // Muted dark forest green text for premium contrast
    textSecondary: '#166534',
    textTertiary: '#3F6212',
    accent: '#10B981', // Emerald green
    accentMuted: '#34D399',
    border: '#E2E8F0',
    divider: '#F1F5F9',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
    buttonBackground: '#10B981',
    buttonText: '#FFFFFF',
    selectedState: '#10B981',
    skeletonBone: 'rgba(16, 185, 129, 0.15)',
    skeletonJoint: 'rgba(16, 185, 129, 0.4)',
    overlay: 'rgba(0, 0, 0, 0.3)',
  },
};

// Global reference for static Proxy resolution in theme.ts
let activeColors: ThemeColors = THEMES['black-white'];

export function getActiveThemeColors(): ThemeColors {
  return activeColors;
}

interface ThemeContextValue {
  themeKey: ThemeKey;
  colors: ThemeColors;
  setThemeKey: (key: ThemeKey) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('black-white');
  const [loading, setLoading] = useState(true);

  // Load persisted theme on start
  useEffect(() => {
    async function loadTheme() {
      try {
        const info = await getInfoAsync(THEME_FILE_PATH);
        if (info.exists) {
          const content = await readAsStringAsync(THEME_FILE_PATH);
          const parsed = JSON.parse(content);
          if (THEMES[parsed.theme as ThemeKey]) {
            setThemeKeyState(parsed.theme);
            activeColors = THEMES[parsed.theme as ThemeKey];
          }
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      } finally {
        setLoading(false);
      }
    }
    loadTheme();
  }, []);

  const setThemeKey = async (key: ThemeKey) => {
    setThemeKeyState(key);
    activeColors = THEMES[key];
    try {
      await writeAsStringAsync(THEME_FILE_PATH, JSON.stringify({ theme: key }));
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const colors = THEMES[themeKey];

  return (
    <ThemeContext.Provider value={{ themeKey, colors, setThemeKey }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
