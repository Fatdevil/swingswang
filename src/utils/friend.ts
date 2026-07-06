/**
 * friend.ts
 * SwingSwang
 *
 * Local persistence and logic for the friend system (generating codes, adding friends).
 */

import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const FRIEND_FILE_PATH = `${documentDirectory}friend_data.json`;

export interface Friend {
  name: string;
  code: string;
  streak: number;
}

export interface FriendState {
  myCode: string;
  friends: Friend[];
}

export function generateFriendCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let lettersPart = '';
  let numbersPart = '';
  for (let i = 0; i < 4; i++) {
    lettersPart += letters.charAt(Math.floor(Math.random() * letters.length));
    numbersPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return `${lettersPart}-${numbersPart}`;
}

export async function saveFriendDataLocally(data: FriendState) {
  try {
    await writeAsStringAsync(FRIEND_FILE_PATH, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save friend data', e);
  }
}

export async function loadFriendDataLocally(): Promise<FriendState | null> {
  try {
    const info = await getInfoAsync(FRIEND_FILE_PATH);
    if (info.exists) {
      const content = await readAsStringAsync(FRIEND_FILE_PATH);
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to load friend data', e);
  }
  return null;
}
