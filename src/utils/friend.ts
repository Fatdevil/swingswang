/**
 * friend.ts
 * SwingSwang
 *
 * Local persistence and logic for the friend system (generating codes, adding friends).
 */

import { Platform } from 'react-native';
import { documentDirectory, writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const FRIEND_FILE_PATH = `${documentDirectory}friend_data.json`;
const FRIEND_WEB_KEY = 'swingswang_friend_data';

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
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(FRIEND_WEB_KEY, JSON.stringify(data));
      }
      return;
    }
    await writeAsStringAsync(FRIEND_FILE_PATH, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save friend data', e);
  }
}

export async function loadFriendDataLocally(): Promise<FriendState | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const content = window.localStorage.getItem(FRIEND_WEB_KEY);
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') {
            return {
              myCode: typeof parsed.myCode === 'string' ? parsed.myCode : generateFriendCode(),
              friends: Array.isArray(parsed.friends)
                ? parsed.friends.filter((f: any) => f && typeof f.name === 'string' && typeof f.code === 'string')
                : [],
            };
          }
        }
      }
      return null;
    }
    const info = await getInfoAsync(FRIEND_FILE_PATH);
    if (info.exists) {
      const content = await readAsStringAsync(FRIEND_FILE_PATH);
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          myCode: typeof parsed.myCode === 'string' ? parsed.myCode : generateFriendCode(),
          friends: Array.isArray(parsed.friends)
            ? parsed.friends.filter((f: any) => f && typeof f.name === 'string' && typeof f.code === 'string')
            : [],
        };
      }
    }
  } catch (e) {
    console.error('Failed to load friend data', e);
  }
  return null;
}
