/**
 * history.ts
 * SwingSwang
 *
 * Local persistence for swing scores using expo-file-system legacy API.
 */

import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const HISTORY_FILE_PATH = `${documentDirectory}swing_history.json`;

export async function saveHistoryLocally(scores: number[]) {
  try {
    await writeAsStringAsync(HISTORY_FILE_PATH, JSON.stringify({ scores }));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export async function loadHistoryLocally(): Promise<number[]> {
  try {
    const info = await getInfoAsync(HISTORY_FILE_PATH);
    if (info.exists) {
      const content = await readAsStringAsync(HISTORY_FILE_PATH);
      const parsed = JSON.parse(content);
      return parsed.scores || [];
    }
  } catch (e) {
    console.error('Failed to load history', e);
  }
  return [];
}
