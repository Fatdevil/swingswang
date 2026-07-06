/**
 * VideoPlayer.tsx
 * SwingSwang
 *
 * Video player wrapper using expo-video's VideoView.
 * Exposes imperative controls via ref.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLORS } from '../../constants/theme';

export interface VideoPlayerRef {
  play(): void;
  pause(): void;
  seekTo(time: number): void;
  setRate(rate: number): void;
}

export interface VideoPlayerProps {
  /** Local URI of the video file. */
  uri: string;
  /** Called on each time update with the current timestamp in seconds. */
  onTimeUpdate?: (timestamp: number) => void;
  /** Called when playback status changes. */
  onStatusChange?: (status: { isPlaying: boolean; duration: number }) => void;
  /** Custom container style. */
  style?: ViewStyle;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ uri, onTimeUpdate, onStatusChange, style }, ref) {
    const player = useVideoPlayer(uri, (p) => {
      p.loop = false;
      p.muted = false;
    });

    const timeUpdateRef = useRef(onTimeUpdate);
    timeUpdateRef.current = onTimeUpdate;

    const statusChangeRef = useRef(onStatusChange);
    statusChangeRef.current = onStatusChange;

    // Poll for time updates (expo-video doesn't have a direct onTimeUpdate callback)
    useEffect(() => {
      const interval = setInterval(() => {
        if (player && timeUpdateRef.current) {
          timeUpdateRef.current(player.currentTime);
        }
      }, 1000 / 30); // ~30fps polling

      return () => clearInterval(interval);
    }, [player]);

    // Listen for status changes
    useEffect(() => {
      if (!player) return;

      const subscription = player.addListener('statusChange', (payload) => {
        if (statusChangeRef.current) {
          statusChangeRef.current({
            isPlaying: player.playing,
            duration: player.duration,
          });
        }
      });

      return () => {
        subscription.remove();
      };
    }, [player]);

    useImperativeHandle(
      ref,
      () => ({
        play() {
          player.play();
        },
        pause() {
          player.pause();
        },
        seekTo(time: number) {
          player.currentTime = time;
        },
        setRate(rate: number) {
          player.playbackRate = rate;
        },
      }),
      [player],
    );

    return (
      <View style={[styles.container, style]}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
        />
      </View>
    );
  },
);

export default VideoPlayer;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
});
