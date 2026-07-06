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

// ─── State ──────────────────────────────────────────────────────────

export interface AnalysisState {
  videoSource: VideoSource | null;
  status: ProcessingStatus;
  poseTimeline: PoseTimeline | null;
  analysisResult: AnalysisResult | null;
  debugMode: boolean;
  history: number[];
  isHistoryLoaded: boolean;
}

const initialState: AnalysisState = {
  videoSource: null,
  status: { type: 'idle' },
  poseTimeline: null,
  analysisResult: null,
  debugMode: false,
  history: [],
  isHistoryLoaded: false,
};

// ─── Actions ────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_VIDEO'; payload: VideoSource | null }
  | { type: 'SET_STATUS'; payload: ProcessingStatus }
  | { type: 'SET_TIMELINE'; payload: PoseTimeline | null }
  | { type: 'SET_RESULT'; payload: AnalysisResult | null }
  | { type: 'LOAD_HISTORY'; payload: number[] }
  | { type: 'CLEAR_HISTORY' }
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
    case 'TOGGLE_DEBUG':
      return { ...state, debugMode: !state.debugMode };
    case 'RESET':
      return {
        ...initialState,
        history: state.history,
        isHistoryLoaded: state.isHistoryLoaded,
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

  // Load history at startup
  useEffect(() => {
    async function initHistory() {
      const saved = await loadHistoryLocally();
      dispatch({ type: 'LOAD_HISTORY', payload: saved });
    }
    initHistory();
  }, []);

  // Save history on changes
  useEffect(() => {
    if (state.isHistoryLoaded) {
      saveHistoryLocally(state.history);
    }
  }, [state.history, state.isHistoryLoaded]);

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
