/**
 * useAnalysis.ts
 * SwingSwang
 *
 * Main analysis hook — orchestrates video selection and pipeline execution.
 */

import { useCallback } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { selectVideo, validateVideo } from '@/features/video/videoImporter';
import { runAnalysisPipeline } from '@/features/analysis/analysisPipeline';
import { Logger } from '@/utils/logger';
import { Alert } from 'react-native';
import { SwingConfig } from '@/types/swing';
import { checkRealEngineAvailability } from '@/features/pose/PoseEngineFactory';
import { PoseEngineConfig } from '@/features/pose/types';

export function useAnalysis() {
  const { state, dispatch } = useAnalysisContext();

  /** Open picker and load a video. */
  const selectAndLoadVideo = useCallback(async () => {
    try {
      dispatch({ type: 'SET_STATUS', payload: { type: 'selecting' } });

      const source = await selectVideo();

      if (!source) {
        dispatch({ type: 'SET_STATUS', payload: { type: 'idle' } });
        return;
      }

      // Validate
      const validation = validateVideo(source.metadata);

      if (!validation.isValid) {
        Alert.alert('Video Error', validation.errors.join('\n'));
        dispatch({ type: 'SET_STATUS', payload: { type: 'idle' } });
        return;
      }

      if (validation.warnings.length > 0) {
        Logger.video.warn('Video validation warnings', { warnings: validation.warnings });
      }

      dispatch({ type: 'SET_VIDEO', payload: source });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Logger.video.error('Video selection failed', { error: msg });
      Alert.alert('Error', msg);
      dispatch({ type: 'SET_STATUS', payload: { type: 'idle' } });
    }
  }, [dispatch]);

  /** Run the full analysis pipeline on the loaded video. Returns true on success. */
  const startAnalysis = useCallback(async (): Promise<boolean> => {
    if (!state.videoSource) {
      Logger.video.warn('startAnalysis called without video source');
      return false;
    }

    try {
      const availability = checkRealEngineAvailability();
      const engineConfig: PoseEngineConfig = {
        mode: availability.available ? 'REAL' : 'MOCK',
      };

      Logger.pose.info('Triggering analysis pipeline', { mode: engineConfig.mode });

      const result = await runAnalysisPipeline(
        state.videoSource.uri,
        state.videoSource.metadata,
        (status) => dispatch({ type: 'SET_STATUS', payload: status }),
        engineConfig,
        undefined, // isCancelled
        state.swingConfig
      );

      dispatch({ type: 'SET_TIMELINE', payload: result.timeline });
      dispatch({ type: 'SET_RESULT', payload: result.analysisResult });
      dispatch({ type: 'SET_STATUS', payload: { type: 'completed' } });

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      dispatch({ type: 'SET_STATUS', payload: { type: 'failed', error: msg } });
      return false;
    }
  }, [state.videoSource, state.swingConfig, dispatch]);

  /** Set swing configuration */
  const setSwingConfig = useCallback((config: SwingConfig) => {
    dispatch({ type: 'SET_SWING_CONFIG', payload: config });
  }, [dispatch]);

  /** Reset everything. */
  const resetAnalysis = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  /** Toggle debug mode. */
  const toggleDebug = useCallback(() => {
    dispatch({ type: 'TOGGLE_DEBUG' });
  }, [dispatch]);

  /** Clear swing history. */
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, [dispatch]);

  /** Set streak data directly. */
  const setStreak = useCallback((streakCount: number, lastActiveDate: string) => {
    dispatch({ type: 'SET_STREAK', payload: { streakCount, lastActiveDate } });
  }, [dispatch]);

  /** Add a friend directly. */
  const addFriend = useCallback((name: string, code: string) => {
    dispatch({ type: 'ADD_FRIEND', payload: { name, code, streak: 1 } });
  }, [dispatch]);

  return {
    videoSource: state.videoSource,
    status: state.status,
    poseTimeline: state.poseTimeline,
    analysisResult: state.analysisResult,
    debugMode: state.debugMode,
    history: state.history,
    streakCount: state.streakCount,
    lastActiveDate: state.lastActiveDate,
    isStreakLoaded: state.isStreakLoaded,
    myCode: state.myCode,
    friends: state.friends,
    isFriendDataLoaded: state.isFriendDataLoaded,
    swingConfig: state.swingConfig,
    selectAndLoadVideo,
    startAnalysis,
    setSwingConfig,
    resetAnalysis,
    toggleDebug,
    clearHistory,
    setStreak,
    addFriend,
  };
}
