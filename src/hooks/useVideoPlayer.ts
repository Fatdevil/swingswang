/**
 * useVideoPlayer.ts
 * SwingSwang
 *
 * Manages video playback state using modern expo-video.
 * Also provides the current PoseFrame from the timeline if available.
 */

import { useState, useCallback, useEffect } from 'react';
import { useVideoPlayer as useExpoVideoPlayer, VideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import { PoseTimeline } from '../features/timeline/PoseTimeline';
import type { PoseFrame } from '../types/pose';
import { ANALYSIS_FRAME_RATE } from '../constants/config';

export interface UseVideoPlayerReturn {
  /** The native expo-video VideoPlayer instance. */
  player: VideoPlayer;
  /** Reactive playback states. */
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  /** Current PoseFrame from timeline (if available). */
  currentFrame: PoseFrame | null;
  /** Toggle play/pause. */
  togglePlayPause: () => void;
  /** Seek to a specific time in seconds. */
  seekTo: (timeSeconds: number) => void;
  /** Set playback rate. */
  setRate: (rate: number) => void;
}

export function useVideoPlayer(
  uri: string,
  timeline: PoseTimeline | null = null
): UseVideoPlayerReturn {
  const player = useExpoVideoPlayer(uri || '', (p) => {
    p.loop = true;
    // Notify on time update matching the analysis frame rate for precise frame tracking
    p.timeUpdateEventInterval = 1 / ANALYSIS_FRAME_RATE;
  });

  const [isPlaying, setIsPlaying] = useState(player ? player.playing : false);
  const [currentTime, setCurrentTime] = useState(player ? player.currentTime : 0);
  const [duration, setDuration] = useState(player ? player.duration : 0);

  // Subscribe to time updates
  useEventListener(player, 'timeUpdate', (payload) => {
    setCurrentTime(payload.currentTime);
  });

  // Subscribe to playing state changes
  useEventListener(player, 'playingChange', (payload) => {
    setIsPlaying(payload.isPlaying);
  });

  // Subscribe to status changes to get correct duration when ready
  useEventListener(player, 'statusChange', () => {
    if (player) {
      setDuration(player.duration);
    }
  });

  // Keep state variables synchronized when player changes
  useEffect(() => {
    if (player) {
      setIsPlaying(player.playing);
      setCurrentTime(player.currentTime);
      setDuration(player.duration);
    }
  }, [player, uri]);

  // Get current frame from timeline
  const currentFrame = timeline?.frameAtTime(currentTime) ?? null;

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player]);

  const seekTo = useCallback((timeSeconds: number) => {
    if (!player) return;
    player.currentTime = timeSeconds;
  }, [player]);

  const setRate = useCallback((rate: number) => {
    if (!player) return;
    player.playbackRate = rate;
  }, [player]);

  return {
    player,
    isPlaying,
    currentTime,
    duration,
    currentFrame,
    togglePlayPause,
    seekTo,
    setRate,
  };
}
