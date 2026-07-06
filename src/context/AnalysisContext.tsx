/**
 * AnalysisContext.tsx
 * SwingSwang
 *
 * Shared analysis state via React Context.
 */

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { ProcessingStatus } from '../types/pose';
import { VideoSource } from '../types/video';
import { AnalysisResult } from '../types/analysis';
import { PoseTimeline } from '../features/timeline/PoseTimeline';
import { calculateSwingScore } from '../utils/score';
import { saveHistoryLocally, loadHistoryLocally } from '../utils/history';
import { saveStreakLocally, loadStreakLocally, StreakData } from '../utils/streak';
import {
  saveFriendDataLocally,
  loadFriendDataLocally,
  generateFriendCode,
  Friend,
  FriendState,
} from '../utils/friend';

// ─── State ──────────────────────────────────────────────────────────

export interface AnalysisState {
  videoSource: VideoSource | null;
  status: ProcessingStatus;
  poseTimeline: PoseTimeline | null;
  analysisResult: AnalysisResult | null;
  debugMode: boolean;
  history: number[];
  isHistoryLoaded: boolean;
  streakCount: number;
  lastActiveDate: string;
  isStreakLoaded: boolean;
  myCode: string;
  friends: Friend[];
  isFriendDataLoaded: boolean;
}

const initialState: AnalysisState = {
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
};

// ─── Actions ────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_VIDEO'; payload: VideoSource | null }
  | { type: 'SET_STATUS'; payload: ProcessingStatus }
  | { type: 'SET_TIMELINE'; payload: PoseTimeline | null }
  | { type: 'SET_RESULT'; payload: AnalysisResult | null }
  | { type: 'LOAD_HISTORY'; payload: number[] }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_STREAK'; payload: StreakData }
  | { type: 'SET_STREAK'; payload: StreakData }
  | { type: 'LOAD_FRIEND_DATA'; payload: FriendState }
  | { type: 'ADD_FRIEND'; payload: Friend }
  | { type: 'TOGGLE_DEBUG' }
  | { type: 'RESET' };

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'SET_VIDEO':
      return {
        ...state,
        videoSource: action.payload,
        status: action.payload ? { type: 'ready' } : { type: 'idle' },
        poseTimeline: null,
        analysisResult: null,
      };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_TIMELINE':
      return { ...state, poseTimeline: action.payload };
    case 'SET_RESULT': {
      if (action.payload) {
        const score = calculateSwingScore(action.payload);
        return {
          ...state,
          analysisResult: action.payload,
          history: [...state.history, score],
        };
      }
      return { ...state, analysisResult: action.payload };
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
    case 'TOGGLE_DEBUG':
      return { ...state, debugMode: !state.debugMode };
    case 'RESET':
      return {
        ...initialState,
        history: state.history,
        isHistoryLoaded: state.isHistoryLoaded,
        streakCount: state.streakCount,
        lastActiveDate: state.lastActiveDate,
        isStreakLoaded: state.isStreakLoaded,
        myCode: state.myCode,
        friends: state.friends,
        isFriendDataLoaded: state.isFriendDataLoaded,
      };
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────

interface AnalysisContextValue {
  state: AnalysisState;
  dispatch: React.Dispatch<Action>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load history, streak, and friends at startup
  useEffect(() => {
    async function init() {
      const savedHistory = await loadHistoryLocally();
      dispatch({ type: 'LOAD_HISTORY', payload: savedHistory });

      const savedStreak = await loadStreakLocally();
      if (savedStreak) {
        dispatch({ type: 'LOAD_STREAK', payload: savedStreak });
      } else {
        dispatch({ type: 'LOAD_STREAK', payload: { streakCount: 0, lastActiveDate: '' } });
      }

      const savedFriends = await loadFriendDataLocally();
      if (savedFriends) {
        dispatch({ type: 'LOAD_FRIEND_DATA', payload: savedFriends });
      } else {
        // Seed first code and default mock friends
        const newCode = generateFriendCode();
        const initialFriends: Friend[] = [
          { name: 'Tiger Woods', code: 'TGWD-1997', streak: 45 },
          { name: 'Nelly Korda', code: 'NKRD-2024', streak: 12 },
        ];
        dispatch({
          type: 'LOAD_FRIEND_DATA',
          payload: { myCode: newCode, friends: initialFriends },
        });
      }
    }
    init();
  }, []);

  // Save history on changes
  useEffect(() => {
    if (state.isHistoryLoaded) {
      saveHistoryLocally(state.history);
    }
  }, [state.history, state.isHistoryLoaded]);

  // Save streak on changes
  useEffect(() => {
    if (state.isStreakLoaded) {
      saveStreakLocally({
        streakCount: state.streakCount,
        lastActiveDate: state.lastActiveDate,
      });
    }
  }, [state.streakCount, state.lastActiveDate, state.isStreakLoaded]);

  // Save friends on changes
  useEffect(() => {
    if (state.isFriendDataLoaded) {
      saveFriendDataLocally({
        myCode: state.myCode,
        friends: state.friends,
      });
    }
  }, [state.myCode, state.friends, state.isFriendDataLoaded]);

  return (
    <AnalysisContext.Provider value={{ state, dispatch }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext(): AnalysisContextValue {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysisContext must be used within an AnalysisProvider');
  }
  return context;
}
