/**
 * player.tsx — Swing Player
 * SwingSwang
 *
 * Video playback with skeleton overlay using expo-video.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { VideoView } from 'expo-video';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { useVideoPlayer } from '../src/hooks/useVideoPlayer';
import { SkeletonOverlay } from '../src/components/pose/SkeletonOverlay';
import { Button } from '../src/components/ui/Button';
import { Badge } from '../src/components/ui/Badge';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY } from '../src/constants/theme';
import { reliabilityColor } from '../src/types/metrics';
import { reliabilityFromConfidence } from '../src/types/metrics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PLAYBACK_RATES = [0.25, 0.5, 1.0];

export default function PlayerScreen() {
  const { videoSource, poseTimeline } = useAnalysis();

  const {
    player,
    isPlaying,
    currentTime,
    duration,
    currentFrame,
    togglePlayPause,
    setRate,
  } = useVideoPlayer(videoSource?.uri ?? '', poseTimeline);

  const [rateIndex, setRateIndex] = useState(2); // 1.0x default
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [videoLayout, setVideoLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH * (16 / 9) });

  const cycleRate = () => {
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(nextIndex);
    setRate(PLAYBACK_RATES[nextIndex]);
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
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
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
    fontFamily: FONT_FAMILY,
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
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  noDataText: {
    fontFamily: FONT_FAMILY,
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
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
  },
});
