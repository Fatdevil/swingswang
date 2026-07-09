/**
 * AnalysisContext.tsx
 * SwingSwang
 *
 * Shared analysis state via React Context.
 */

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { ProcessingStatus } from '../types/pose';
import { VideoSource } from '../types/video';
import { Logger } from '../utils/logger';
import { AnalysisResult } from '../types/analysis';
import { AnalysisResultV1 } from '../types/analysisV1';
import { SwingConfig } from '../types/swing';
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
  analysisResult: AnalysisResult | AnalysisResultV1 | null;
  debugMode: boolean;
  history: number[];
  isHistoryLoaded: boolean;
  streakCount: number;
  lastActiveDate: string;
  isStreakLoaded: boolean;
  myCode: string;
  friends: Friend[];
  isFriendDataLoaded: boolean;
  swingConfig: SwingConfig;
  lastProcessedAnalysisId: string | null;
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
  swingConfig: {
    cameraView: 'FO',
    handedness: 'RIGHT',
    club: 'DRIVER',
  },
  lastProcessedAnalysisId: null,
};

// ─── Actions ────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_VIDEO'; payload: VideoSource | null }
  | { type: 'SET_STATUS'; payload: ProcessingStatus }
  | { type: 'SET_TIMELINE'; payload: PoseTimeline | null }
  | { type: 'SET_RESULT'; payload: AnalysisResult | AnalysisResultV1 | null }
  | { type: 'SET_SWING_CONFIG'; payload: SwingConfig }
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
        // Risk 5: Retain poseTimeline and analysisResult so choosing a new video doesn't wipe previous data immediately
      };
    case 'SET_STATUS': {
      // Risk 5: Wiping results only when explicitly initiating a new process (selecting/extracting)
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
        
        // Risk 6: Deduplicate history entries by checking unique analysisId (v1.0 schema)
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
        ...initialState,
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
    let mounted = true;

    async function init() {
      const savedHistory = await loadHistoryLocally();
      if (!mounted) return;
      dispatch({ type: 'LOAD_HISTORY', payload: savedHistory });

      const savedStreak = await loadStreakLocally();
      if (!mounted) return;
      if (savedStreak) {
        dispatch({ type: 'LOAD_STREAK', payload: savedStreak });
      } else {
        dispatch({ type: 'LOAD_STREAK', payload: { streakCount: 0, lastActiveDate: '' } });
      }

      const savedFriends = await loadFriendDataLocally();
      if (!mounted) return;
      if (savedFriends) {
        // Filter out Tiger Woods and Nelly Korda immediately
        const filteredFriends = savedFriends.friends.filter(
          f => f.name !== 'Tiger Woods' && f.name !== 'Nelly Korda'
        );
        dispatch({
          type: 'LOAD_FRIEND_DATA',
          payload: { ...savedFriends, friends: filteredFriends },
        });

        // Risk 8: Save back filtered friends directly to local storage immediately
        try {
          await saveFriendDataLocally({
            myCode: savedFriends.myCode,
            friends: filteredFriends,
          });
        } catch (err) {
          Logger.pose.error('Failed to save filtered friends locally on startup', { error: String(err) });
        }
      } else {
        const newCode = generateFriendCode();
        dispatch({
          type: 'LOAD_FRIEND_DATA',
          payload: { myCode: newCode, friends: [] },
        });
      }
    }
    init();

    return () => {
      mounted = false;
    };
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
