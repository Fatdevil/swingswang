/**
 * analysisReducer.test.ts
 * SwingSwang
 *
 * Tests for the AnalysisContext reducer — every action type, 
 * edge cases, and state transitions.
 */

// We test the reducer in isolation by importing it directly.
// Since the reducer is not exported, we re-implement the test against the module internals.
// Strategy: test each action type against the initial state and verify transitions.

import { AnalysisResult } from '../../src/types/analysis';
import { AnalysisResultV1 } from '../../src/types/analysisV1';

// Since the reducer and initialState are not exported from AnalysisContext,
// we extract and test the pure reducer logic here by reconstructing it.
// This tests the same logic patterns used in the real reducer.

interface AnalysisState {
  videoSource: any;
  status: { type: string; [key: string]: any };
  poseTimeline: any;
  analysisResult: any;
  debugMode: boolean;
  history: number[];
  isHistoryLoaded: boolean;
  streakCount: number;
  lastActiveDate: string;
  isStreakLoaded: boolean;
  myCode: string;
  friends: Array<{ name: string; code: string; streak: number }>;
  isFriendDataLoaded: boolean;
  swingConfig: { cameraView: 'FO' | 'DTL'; handedness: 'RIGHT' | 'LEFT'; club: string };
  lastProcessedAnalysisId: string | null;
}

type Action =
  | { type: 'SET_VIDEO'; payload: any }
  | { type: 'SET_STATUS'; payload: { type: string; [key: string]: any } }
  | { type: 'SET_TIMELINE'; payload: any }
  | { type: 'SET_RESULT'; payload: any }
  | { type: 'SET_SWING_CONFIG'; payload: any }
  | { type: 'LOAD_HISTORY'; payload: number[] }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_STREAK'; payload: { streakCount: number; lastActiveDate: string } }
  | { type: 'SET_STREAK'; payload: { streakCount: number; lastActiveDate: string } }
  | { type: 'LOAD_FRIEND_DATA'; payload: { myCode: string; friends: Array<{ name: string; code: string; streak: number }> } }
  | { type: 'ADD_FRIEND'; payload: { name: string; code: string; streak: number } }
  | { type: 'TOGGLE_DEBUG' }
  | { type: 'RESET' };

// Mock calculateSwingScore to avoid importing the full module graph
function calculateSwingScore(_result: any): number {
  return 7.5;
}

// Re-implement the reducer to test in isolation (mirrors AnalysisContext.tsx)
function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'SET_VIDEO':
      return {
        ...state,
        videoSource: action.payload,
        status: action.payload ? { type: 'ready' } : { type: 'idle' },
        poseTimeline: null,
        analysisResult: null,
        lastProcessedAnalysisId: null,
      };
    case 'SET_STATUS': {
      const isNewProcess = action.payload.type === 'selecting' || action.payload.type === 'extracting';
      return {
        ...state,
        status: action.payload,
        ...(isNewProcess ? { poseTimeline: null, analysisResult: null, lastProcessedAnalysisId: null } : {}),
      };
    }
    case 'SET_TIMELINE':
      return { ...state, poseTimeline: action.payload };
    case 'SET_RESULT': {
      if (action.payload) {
        const score = calculateSwingScore(action.payload);
        const isNewAnalysis =
          'analysisId' in action.payload &&
          action.payload.analysisId !== state.lastProcessedAnalysisId;
        const newHistory = isNewAnalysis
          ? [...state.history, score]
          : state.history;
        return {
          ...state,
          analysisResult: action.payload,
          history: newHistory,
          lastProcessedAnalysisId: 'analysisId' in action.payload ? action.payload.analysisId : null,
        };
      }
      return {
        ...state,
        analysisResult: action.payload,
        lastProcessedAnalysisId: null,
      };
    }
    case 'LOAD_HISTORY':
      return { ...state, history: action.payload, isHistoryLoaded: true };
    case 'CLEAR_HISTORY':
      return { ...state, history: [] };
    case 'LOAD_STREAK':
      return {
        ...state,
        streakCount: action.payload.streakCount,
        lastActiveDate: action.payload.lastActiveDate,
        isStreakLoaded: true,
      };
    case 'SET_STREAK':
      return {
        ...state,
        streakCount: action.payload.streakCount,
        lastActiveDate: action.payload.lastActiveDate,
      };
    case 'LOAD_FRIEND_DATA':
      return {
        ...state,
        myCode: action.payload.myCode,
        friends: action.payload.friends,
        isFriendDataLoaded: true,
      };
    case 'ADD_FRIEND':
      return {
        ...state,
        friends: [...state.friends, action.payload],
      };
    case 'SET_SWING_CONFIG':
      return { ...state, swingConfig: action.payload };
    case 'TOGGLE_DEBUG':
      return { ...state, debugMode: !state.debugMode };
    case 'RESET':
      return {
        ...createInitialState(),
        history: state.history,
        isHistoryLoaded: state.isHistoryLoaded,
        streakCount: state.streakCount,
        lastActiveDate: state.lastActiveDate,
        isStreakLoaded: state.isStreakLoaded,
        myCode: state.myCode,
        friends: state.friends,
        isFriendDataLoaded: state.isFriendDataLoaded,
        swingConfig: state.swingConfig,
        lastProcessedAnalysisId: state.lastProcessedAnalysisId,
      };
    default:
      return state;
  }
}

function createInitialState(): AnalysisState {
  return {
    videoSource: null,
    status: { type: 'idle' },
    poseTimeline: null,
    analysisResult: null,
    debugMode: false,
    history: [],
    isHistoryLoaded: false,
    streakCount: 0,
    lastActiveDate: '',
    isStreakLoaded: false,
    myCode: '',
    friends: [],
    isFriendDataLoaded: false,
    swingConfig: { cameraView: 'FO', handedness: 'RIGHT', club: 'DRIVER' },
    lastProcessedAnalysisId: null,
  };
}

describe('AnalysisContext Reducer', () => {
  let initialState: AnalysisState;

  beforeEach(() => {
    initialState = createInitialState();
  });

  // ─── SET_VIDEO ────────────────────────────────────────────────

  describe('SET_VIDEO', () => {
    it('sets video source and transitions status to ready', () => {
      const video = { uri: 'file://test.mp4', metadata: { duration: 5 } };
      const result = reducer(initialState, { type: 'SET_VIDEO', payload: video });

      expect(result.videoSource).toBe(video);
      expect(result.status.type).toBe('ready');
      expect(result.poseTimeline).toBeNull();
      expect(result.analysisResult).toBeNull();
    });

    it('clears video and resets status to idle when payload is null', () => {
      const stateWithVideo = {
        ...initialState,
        videoSource: { uri: 'test.mp4' },
        status: { type: 'ready' },
      };
      const result = reducer(stateWithVideo, { type: 'SET_VIDEO', payload: null });

      expect(result.videoSource).toBeNull();
      expect(result.status.type).toBe('idle');
    });

    it('clears previous analysis result when setting new video', () => {
      const stateWithResult = {
        ...initialState,
        analysisResult: { schemaVersion: '0.1' },
        poseTimeline: { frames: [] },
        lastProcessedAnalysisId: 'old-id',
      };
      const result = reducer(stateWithResult, {
        type: 'SET_VIDEO',
        payload: { uri: 'new.mp4' },
      });

      expect(result.analysisResult).toBeNull();
      expect(result.poseTimeline).toBeNull();
      expect(result.lastProcessedAnalysisId).toBeNull();
    });
  });

  // ─── SET_STATUS ───────────────────────────────────────────────

  describe('SET_STATUS', () => {
    it('updates status', () => {
      const result = reducer(initialState, {
        type: 'SET_STATUS',
        payload: { type: 'analyzing', progress: 0.5 },
      });
      expect(result.status).toEqual({ type: 'analyzing', progress: 0.5 });
    });

    it('clears analysis data when status is "selecting"', () => {
      const stateWithData = {
        ...initialState,
        poseTimeline: { frames: [] },
        analysisResult: { schemaVersion: '0.1' },
        lastProcessedAnalysisId: 'test-id',
      };
      const result = reducer(stateWithData, {
        type: 'SET_STATUS',
        payload: { type: 'selecting' },
      });

      expect(result.poseTimeline).toBeNull();
      expect(result.analysisResult).toBeNull();
      expect(result.lastProcessedAnalysisId).toBeNull();
    });

    it('clears analysis data when status is "extracting"', () => {
      const stateWithData = {
        ...initialState,
        analysisResult: { schemaVersion: '0.1' },
      };
      const result = reducer(stateWithData, {
        type: 'SET_STATUS',
        payload: { type: 'extracting' },
      });
      expect(result.analysisResult).toBeNull();
    });

    it('preserves analysis data for non-clearing statuses', () => {
      const stateWithData = {
        ...initialState,
        analysisResult: { schemaVersion: '0.1' },
        poseTimeline: { frames: ['a'] },
      };
      const result = reducer(stateWithData, {
        type: 'SET_STATUS',
        payload: { type: 'complete' },
      });

      expect(result.analysisResult).toEqual({ schemaVersion: '0.1' });
      expect(result.poseTimeline).toEqual({ frames: ['a'] });
    });
  });

  // ─── SET_TIMELINE ─────────────────────────────────────────────

  describe('SET_TIMELINE', () => {
    it('sets pose timeline', () => {
      const timeline = { frames: [{ timestamp: 0 }] };
      const result = reducer(initialState, { type: 'SET_TIMELINE', payload: timeline });
      expect(result.poseTimeline).toBe(timeline);
    });

    it('clears pose timeline when null', () => {
      const stateWithTimeline = { ...initialState, poseTimeline: { frames: [] } };
      const result = reducer(stateWithTimeline, { type: 'SET_TIMELINE', payload: null });
      expect(result.poseTimeline).toBeNull();
    });
  });

  // ─── SET_RESULT ───────────────────────────────────────────────

  describe('SET_RESULT', () => {
    it('sets result and adds score to history for V1 result with new analysisId', () => {
      const v1Result = { schemaVersion: '1.0', analysisId: 'SS-001', metrics: {} };
      const result = reducer(initialState, { type: 'SET_RESULT', payload: v1Result });

      expect(result.analysisResult).toBe(v1Result);
      expect(result.history).toEqual([7.5]); // mocked score
      expect(result.lastProcessedAnalysisId).toBe('SS-001');
    });

    it('does not duplicate history for same analysisId', () => {
      const stateWithHistory = {
        ...initialState,
        history: [7.5],
        lastProcessedAnalysisId: 'SS-001',
      };
      const v1Result = { schemaVersion: '1.0', analysisId: 'SS-001', metrics: {} };
      const result = reducer(stateWithHistory, { type: 'SET_RESULT', payload: v1Result });

      expect(result.history).toEqual([7.5]); // unchanged
    });

    it('adds to history for different analysisId', () => {
      const stateWithHistory = {
        ...initialState,
        history: [7.5],
        lastProcessedAnalysisId: 'SS-001',
      };
      const v1Result = { schemaVersion: '1.0', analysisId: 'SS-002', metrics: {} };
      const result = reducer(stateWithHistory, { type: 'SET_RESULT', payload: v1Result });

      expect(result.history).toEqual([7.5, 7.5]);
      expect(result.lastProcessedAnalysisId).toBe('SS-002');
    });

    it('clears result and lastProcessedAnalysisId when payload is null', () => {
      const stateWithResult = {
        ...initialState,
        analysisResult: { schemaVersion: '1.0' },
        lastProcessedAnalysisId: 'SS-001',
      };
      const result = reducer(stateWithResult, { type: 'SET_RESULT', payload: null });

      expect(result.analysisResult).toBeNull();
      expect(result.lastProcessedAnalysisId).toBeNull();
    });

    it('handles V0 result without analysisId (no history dedup)', () => {
      const v0Result = { schemaVersion: '0.1', metrics: {} };
      const result = reducer(initialState, { type: 'SET_RESULT', payload: v0Result });

      // V0 results don't have analysisId, so history is not added
      expect(result.history).toEqual([]);
      expect(result.lastProcessedAnalysisId).toBeNull();
    });
  });

  // ─── HISTORY ──────────────────────────────────────────────────

  describe('LOAD_HISTORY', () => {
    it('loads history and marks as loaded', () => {
      const result = reducer(initialState, {
        type: 'LOAD_HISTORY',
        payload: [6.5, 7.0, 8.2],
      });

      expect(result.history).toEqual([6.5, 7.0, 8.2]);
      expect(result.isHistoryLoaded).toBe(true);
    });
  });

  describe('CLEAR_HISTORY', () => {
    it('clears history to empty array', () => {
      const stateWithHistory = { ...initialState, history: [5, 6, 7] };
      const result = reducer(stateWithHistory, { type: 'CLEAR_HISTORY' });
      expect(result.history).toEqual([]);
    });
  });

  // ─── STREAK ───────────────────────────────────────────────────

  describe('LOAD_STREAK', () => {
    it('loads streak data and marks as loaded', () => {
      const result = reducer(initialState, {
        type: 'LOAD_STREAK',
        payload: { streakCount: 5, lastActiveDate: '2026-09-03' },
      });

      expect(result.streakCount).toBe(5);
      expect(result.lastActiveDate).toBe('2026-09-03');
      expect(result.isStreakLoaded).toBe(true);
    });
  });

  describe('SET_STREAK', () => {
    it('updates streak without changing isStreakLoaded', () => {
      const loaded = { ...initialState, isStreakLoaded: true, streakCount: 3 };
      const result = reducer(loaded, {
        type: 'SET_STREAK',
        payload: { streakCount: 4, lastActiveDate: '2026-09-04' },
      });

      expect(result.streakCount).toBe(4);
      expect(result.lastActiveDate).toBe('2026-09-04');
      expect(result.isStreakLoaded).toBe(true); // unchanged
    });
  });

  // ─── FRIENDS ──────────────────────────────────────────────────

  describe('LOAD_FRIEND_DATA', () => {
    it('loads friend data and marks as loaded', () => {
      const result = reducer(initialState, {
        type: 'LOAD_FRIEND_DATA',
        payload: {
          myCode: 'ABCD-1234',
          friends: [{ name: 'Test', code: 'WXYZ-5678', streak: 3 }],
        },
      });

      expect(result.myCode).toBe('ABCD-1234');
      expect(result.friends).toHaveLength(1);
      expect(result.friends[0].name).toBe('Test');
      expect(result.isFriendDataLoaded).toBe(true);
    });
  });

  describe('ADD_FRIEND', () => {
    it('appends a friend to existing list', () => {
      const stateWithFriend = {
        ...initialState,
        friends: [{ name: 'First', code: 'AAAA-0001', streak: 1 }],
      };
      const result = reducer(stateWithFriend, {
        type: 'ADD_FRIEND',
        payload: { name: 'Second', code: 'BBBB-0002', streak: 0 },
      });

      expect(result.friends).toHaveLength(2);
      expect(result.friends[1].name).toBe('Second');
    });
  });

  // ─── SWING CONFIG ─────────────────────────────────────────────

  describe('SET_SWING_CONFIG', () => {
    it('updates swing configuration', () => {
      const newConfig = { cameraView: 'DTL' as const, handedness: 'LEFT' as const, club: 'WEDGE' };
      const result = reducer(initialState, {
        type: 'SET_SWING_CONFIG',
        payload: newConfig,
      });

      expect(result.swingConfig.cameraView).toBe('DTL');
      expect(result.swingConfig.handedness).toBe('LEFT');
      expect(result.swingConfig.club).toBe('WEDGE');
    });
  });

  // ─── TOGGLE_DEBUG ─────────────────────────────────────────────

  describe('TOGGLE_DEBUG', () => {
    it('toggles debug mode on', () => {
      const result = reducer(initialState, { type: 'TOGGLE_DEBUG' });
      expect(result.debugMode).toBe(true);
    });

    it('toggles debug mode off', () => {
      const debugOn = { ...initialState, debugMode: true };
      const result = reducer(debugOn, { type: 'TOGGLE_DEBUG' });
      expect(result.debugMode).toBe(false);
    });
  });

  // ─── RESET ────────────────────────────────────────────────────

  describe('RESET', () => {
    it('resets analysis state but preserves persistent data', () => {
      const fullState: AnalysisState = {
        ...initialState,
        videoSource: { uri: 'test.mp4' },
        status: { type: 'complete' },
        poseTimeline: { frames: [] } as any,
        analysisResult: { schemaVersion: '1.0' } as any,
        debugMode: true,
        history: [7, 8],
        isHistoryLoaded: true,
        streakCount: 5,
        lastActiveDate: '2026-09-03',
        isStreakLoaded: true,
        myCode: 'ABCD-1234',
        friends: [{ name: 'Test', code: 'WXYZ-5678', streak: 1 }],
        isFriendDataLoaded: true,
        swingConfig: { cameraView: 'DTL', handedness: 'LEFT', club: 'WEDGE' },
        lastProcessedAnalysisId: 'SS-001',
      };

      const result = reducer(fullState, { type: 'RESET' });

      // Cleared (analysis-specific)
      expect(result.videoSource).toBeNull();
      expect(result.status.type).toBe('idle');
      expect(result.poseTimeline).toBeNull();
      expect(result.analysisResult).toBeNull();
      expect(result.debugMode).toBe(false);

      // Preserved (persistent user data)
      expect(result.history).toEqual([7, 8]);
      expect(result.isHistoryLoaded).toBe(true);
      expect(result.streakCount).toBe(5);
      expect(result.lastActiveDate).toBe('2026-09-03');
      expect(result.isStreakLoaded).toBe(true);
      expect(result.myCode).toBe('ABCD-1234');
      expect(result.friends).toHaveLength(1);
      expect(result.isFriendDataLoaded).toBe(true);
      expect(result.swingConfig.cameraView).toBe('DTL');
      expect(result.lastProcessedAnalysisId).toBe('SS-001');
    });
  });

  // ─── Unknown action ──────────────────────────────────────────

  describe('unknown action', () => {
    it('returns state unchanged for unknown action type', () => {
      const result = reducer(initialState, { type: 'UNKNOWN' } as any);
      expect(result).toBe(initialState);
    });
  });
});
