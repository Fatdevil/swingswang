/**
 * player.tsx — Swing Player
 * SwingSwang
 *
 * Video playback with skeleton overlay.
 */

import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { SkeletonOverlay } from '../src/components/pose/SkeletonOverlay';
import { Button } from '../src/components/ui/Button';
import { Badge } from '../src/components/ui/Badge';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../src/constants/theme';
import { reliabilityColor } from '../src/types/metrics';
import { reliabilityFromConfidence } from '../src/types/metrics';
import { useTheme } from '../src/context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PLAYBACK_RATES = [0.25, 0.5, 1.0];

export default function PlayerScreen() {
  useTheme(); // Subscribe to theme changes
  const { videoSource, poseTimeline } = useAnalysis();
  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIndex, setRateIndex] = useState(2); // 1.0x default
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [videoLayout, setVideoLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH * (16 / 9) });

  // Get current frame from timeline
  const currentFrame = poseTimeline?.frameAtTime(currentTime) ?? null;

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setCurrentTime((status.positionMillis || 0) / 1000);
    setDuration((status.durationMillis || 0) / 1000);
  }, []);

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const cycleRate = async () => {
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(nextIndex);
    if (videoRef.current) {
      await videoRef.current.setRateAsync(PLAYBACK_RATES[nextIndex], true);
    }
  };

  if (!videoSource) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Video</Text>
          <Text style={styles.emptyText}>Select and analyze a video from the Home tab.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const videoWidth = videoSource.metadata.width || 1080;
  const videoHeight = videoSource.metadata.height || 1920;
  const videoAspect = videoWidth / videoHeight;
  const displayWidth = SCREEN_WIDTH;
  const displayHeight = displayWidth / videoAspect;

  return (
    <SafeAreaView style={styles.container}>
      {/* Video + Overlay */}
      <View style={[styles.videoContainer, { height: Math.min(displayHeight, 500) }]}>
        <Video
          ref={videoRef}
          source={{ uri: videoSource.uri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setVideoLayout({ width, height });
          }}
        />

        {/* Skeleton overlay */}
        {showSkeleton && currentFrame && (
          <SkeletonOverlay
            poseFrame={currentFrame}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
            displayWidth={videoLayout.width}
            displayHeight={videoLayout.height}
          />
        )}

        {/* Frame info badge */}
        {currentFrame && (
          <View style={styles.frameBadge}>
            <Badge
              text={`${(currentFrame.averageConfidence * 100).toFixed(0)}%`}
              color={reliabilityColor(reliabilityFromConfidence(currentFrame.averageConfidence))}
            />
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>

        {/* Transport buttons */}
        <View style={styles.transportRow}>
          <Button
            title={isPlaying ? '⏸' : '▶'}
            onPress={togglePlayPause}
            variant="secondary"
            style={styles.transportBtn}
          />

          <Button
            title={`${PLAYBACK_RATES[rateIndex]}x`}
            onPress={cycleRate}
            variant="ghost"
            style={styles.transportBtn}
          />

          <Button
            title={showSkeleton ? '🦴 ON' : '🦴 OFF'}
            onPress={() => setShowSkeleton(!showSkeleton)}
            variant="ghost"
            style={styles.transportBtn}
          />
        </View>

        {/* Frame details */}
        {currentFrame && (
          <View style={styles.frameInfo}>
            <Text style={styles.frameInfoText}>
              Frame {currentFrame.frameIndex} • {currentFrame.detectedCount}/17 landmarks • {(currentFrame.averageConfidence * 100).toFixed(0)}% confidence
            </Text>
          </View>
        )}

        {!poseTimeline && (
          <Text style={styles.noDataText}>
            No pose data available. Run analysis from the Home tab.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  videoContainer: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  frameBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  controls: {
    flex: 1,
    padding: SPACING.lg,
  },
  timestamp: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium as any,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  transportBtn: {
    minWidth: 60,
    paddingHorizontal: SPACING.md,
  },
  frameInfo: {
    marginTop: SPACING.sm,
  },
  frameInfoText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  noDataText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
});
