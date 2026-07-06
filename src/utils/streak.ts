/**
 * streak.ts
 * SwingSwang
 *
 * Daily streak logic and persistence.
 */

import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const STREAK_FILE_PATH = `${documentDirectory}streak_data.json`;

export interface StreakData {
  streakCount: number;
  lastActiveDate: string; // YYYY-MM-DD local format
}

export async function saveStreakLocally(data: StreakData) {
  try {
    await writeAsStringAsync(STREAK_FILE_PATH, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save streak', e);
  }
}

export async function loadStreakLocally(): Promise<StreakData | null> {
  try {
    const info = await getInfoAsync(STREAK_FILE_PATH);
    if (info.exists) {
      const content = await readAsStringAsync(STREAK_FILE_PATH);
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to load streak', e);
  }
  return null;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateDaysDiff(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str + 'T00:00:00');
  const d2 = new Date(date2Str + 'T00:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}
