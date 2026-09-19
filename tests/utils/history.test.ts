let fileStorage: Record<string, string> = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  writeAsStringAsync: jest.fn(async (path: string, content: string) => {
    fileStorage[path] = content;
  }),
  readAsStringAsync: jest.fn(async (path: string) => {
    return fileStorage[path] || '';
  }),
  getInfoAsync: jest.fn(async (path: string) => ({
    exists: path in fileStorage,
  })),
}));

import { loadHistoryLocally, saveHistoryLocally } from '@/utils/history';

describe('history persistence', () => {
  beforeEach(() => {
    fileStorage = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('loads empty history when no data exists', async () => {
    const scores = await loadHistoryLocally();
    expect(scores).toEqual([]);
  });

  it('saves and loads valid numeric scores', async () => {
    await saveHistoryLocally([7.5, 8.2, 9.0]);
    const loaded = await loadHistoryLocally();
    expect(loaded).toEqual([7.5, 8.2, 9.0]);
  });

  it('sanitizes non-numeric, NaN, or out-of-range scores from storage', async () => {
    const corruptedPayload = JSON.stringify({
      scores: [7.5, 'invalid', null, NaN, -1, 15.0, 8.0, {}],
    });
    fileStorage['file:///mock/documents/swing_history.json'] = corruptedPayload;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('swingswang_history_data', corruptedPayload);
    }

    const loaded = await loadHistoryLocally();
    // Should filter out everything except valid numbers between 1.0 and 10.0
    expect(loaded).toEqual([7.5, 8.0]);
  });

  it('handles corrupted or non-object JSON safely', async () => {
    fileStorage['file:///mock/documents/swing_history.json'] = 'not-valid-json';
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('swingswang_history_data', 'not-valid-json');
    }
    const loaded = await loadHistoryLocally();
    expect(loaded).toEqual([]);
  });
});
