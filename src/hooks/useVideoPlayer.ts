/**
 * useVideoPlayer.ts
 * SwingSwang
 *
 * Manages video playback state: currentTime, isPlaying, duration.
 * Also provides the current PoseFrame from the timeline if available.
 */

import { useCallback, useRef, useState } from 'react';
import { Video, AVPlaybackStatus } from 'expo-av';
import { PoseTimeline } from '../features/timeline/PoseTimeline';
import type { PoseFrame } from '../types/pose';

export interface UseVideoPlayerReturn {
  /** Ref to attach to expo-av Video component. */
  videoRef: React.RefObject<Video | null>;
  /** Whether video is currently playing. */
  isPlaying: boolean;
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total duration in seconds. */
  duration: number;
  /** Current PoseFrame from timeline (if available). */
  currentFrame: PoseFrame | null;
  /** Toggle play/pause. */
  togglePlayPause: () => Promise<void>;
  /** Seek to a specific time. */
  seekTo: (timeSeconds: number) => Promise<void>;
  /** Set playback rate. */
  setRate: (rate: number) => Promise<void>;
  /** Callback to pass to Video onPlaybackStatusUpdate. */
  onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void;
}

export function useVideoPlayer(
  timeline: PoseTimeline | null = null,
): UseVideoPlayerReturn {
  const videoRef = useRef<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Get current frame from timeline
  const currentFrame = timeline?.frameAtTime(currentTime) ?? null;

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setCurrentTime((status.positionMillis || 0) / 1000);
    setDuration((status.durationMillis || 0) / 1000);
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [isPlaying]);

  const seekTo = useCallback(async (timeSeconds: number) => {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(timeSeconds * 1000);
  }, []);

  const setRate = useCallback(async (rate: number) => {
    if (!videoRef.current) return;
    await videoRef.current.setRateAsync(rate, true);
  }, []);

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    currentFrame,
    togglePlayPause,
    seekTo,
    setRate,
    onPlaybackStatusUpdate,
  };
}
