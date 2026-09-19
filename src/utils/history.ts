/**
 * history.ts
 * SwingSwang
 *
 * Local persistence for swing scores using expo-file-system legacy API.
 */

import { Platform } from 'react-native';
import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const HISTORY_FILE_PATH = `${documentDirectory}swing_history.json`;
const HISTORY_WEB_KEY = 'swingswang_history_data';

export async function saveHistoryLocally(scores: number[]) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(HISTORY_WEB_KEY, JSON.stringify({ scores }));
      }
      return;
    }
    await writeAsStringAsync(HISTORY_FILE_PATH, JSON.stringify({ scores }));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

function sanitizeScores(raw: unknown): number[] {
  if (raw && typeof raw === 'object' && 'scores' in raw && Array.isArray((raw as any).scores)) {
    return (raw as any).scores.filter((s: unknown): s is number =>
      typeof s === 'number' && Number.isFinite(s) && s >= 1.0 && s <= 10.0
    );
  }
  return [];
}

export async function loadHistoryLocally(): Promise<number[]> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const content = window.localStorage.getItem(HISTORY_WEB_KEY);
        if (content) {
          const parsed = JSON.parse(content);
          return sanitizeScores(parsed);
        }
      }
      return [];
    }
    const info = await getInfoAsync(HISTORY_FILE_PATH);
    if (info.exists) {
      const content = await readAsStringAsync(HISTORY_FILE_PATH);
      const parsed = JSON.parse(content);
      return sanitizeScores(parsed);
    }
  } catch (e) {
    console.error('Failed to load history', e);
  }
  return [];
}
