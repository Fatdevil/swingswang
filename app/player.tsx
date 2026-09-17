/**
 * player.tsx — Swing Player
 * SwingSwang
 *
 * Video playback with skeleton overlay using expo-video.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { VideoView } from 'expo-video';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const { videoSource, poseTimeline, analysisResult } = useAnalysis();

  const {
    player,
    isPlaying,
    currentTime,
    duration,
    currentFrame,
    togglePlayPause,
    seekTo,
    setRate,
  } = useVideoPlayer(videoSource?.uri ?? '', poseTimeline);

  const [rateIndex, setRateIndex] = useState(2); // 1.0x default
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [videoLayout, setVideoLayout] = useState({ width: SCREEN_WIDTH, height: 500 });

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

  const isMockEngine =
    (analysisResult?.pose as any)?.engineMode === 'MOCK' ||
    analysisResult?.pose?.providerName === 'MockPoseEngine';

  const detectedEvents =
    (analysisResult as any)?.events?.events?.filter(
      (e: any) => e.timestampMs !== null && typeof e.timestampMs === 'number'
    ) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Mock Mode Disclaimer Banner */}
        {isMockEngine && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerIcon}>ℹ️</Text>
            <View style={styles.mockBannerTextContainer}>
              <Text style={styles.mockBannerTitle}>Simuleringsläge (Webbläsare)</Text>
              <Text style={styles.mockBannerText}>
                Du kör i webbläsaren där native AI-moduler (MediaPipe / ExecuTorch) inte kan laddas. En syntetisk testdocka visas för att testa gränssnittet. För skarp analys av din verkliga kropp krävs mobilappen (iOS/Android).
              </Text>
            </View>
          </View>
        )}

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
              title="⏪ -1s"
              onPress={() => seekTo(Math.max(0, currentTime - 1))}
              variant="ghost"
              style={styles.scrubBtn}
            />

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
              title={showSkeleton ? '🦴 PÅ' : '🦴 AV'}
              onPress={() => setShowSkeleton(!showSkeleton)}
              variant="ghost"
              style={styles.transportBtn}
            />

            <Button
              title="+1s ⏩"
              onPress={() => seekTo(Math.min(duration, currentTime + 1))}
              variant="ghost"
              style={styles.scrubBtn}
            />
          </View>

          {/* Swing Events Quick Jump */}
          {detectedEvents.length > 0 && (
            <View style={styles.eventsSection}>
              <Text style={styles.sectionLabel}>HÄNDELSER I SVINGEN (SNABBVAL)</Text>
              <View style={styles.eventsRow}>
                {detectedEvents.map((evt: any) => {
                  const eventSec = (evt.timestampMs ?? 0) / 1000;
                  const isCurrent = Math.abs(currentTime - eventSec) < 0.25;
                  return (
                    <TouchableOpacity
                      key={evt.event}
                      style={[styles.eventChip, isCurrent && styles.eventChipActive]}
                      onPress={() => seekTo(eventSec)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.eventChipText, isCurrent && styles.eventChipTextActive]}>
                        {formatEventName(evt.event)} ({eventSec.toFixed(1)}s)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Frame details */}
          {currentFrame && (
            <View style={styles.frameInfo}>
              <Text style={styles.frameInfoText}>
                Frame {currentFrame.frameIndex} • {currentFrame.detectedCount}/17 punkter • {(currentFrame.averageConfidence * 100).toFixed(0)}% konfidens
              </Text>
            </View>
          )}

          {!poseTimeline && (
            <Text style={styles.noDataText}>
              Ingen pose-data tillgänglig. Kör analys från Start-fliken.
            </Text>
          )}

          {/* Link to Results */}
          {analysisResult && (
            <View style={styles.resultsActionSection}>
              <Button
                title="📊 Visa fullständiga analysresultat"
                onPress={() => router.push('/results')}
                variant="primary"
                style={styles.resultsBtn}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatEventName(name: string): string {
  const map: Record<string, string> = {
    ADDRESS: 'Address',
    TAKEAWAY: 'Takeaway',
    MID_BACKSWING: 'Baksving',
    TOP: 'Topp',
    MID_DOWNSWING: 'Nedsving',
    IMPACT_PROXY: 'Träff',
    MID_FOLLOW_THROUGH: 'Genomsving',
    FINISH: 'Avslut',
  };
  return map[name] || name;
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
  scrollContent: {
    paddingBottom: SPACING.xxl * 2,
  },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  mockBannerIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  mockBannerTextContainer: {
    flex: 1,
  },
  mockBannerTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold as any,
    color: '#eab308',
    marginBottom: 2,
  },
  mockBannerText: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  videoContainer: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
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
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  transportBtn: {
    minWidth: 55,
    paddingHorizontal: SPACING.sm,
  },
  scrubBtn: {
    minWidth: 55,
    paddingHorizontal: SPACING.xs,
  },
  eventsSection: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  eventsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  eventChip: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  eventChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  eventChipText: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  eventChipTextActive: {
    color: '#000',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  frameInfo: {
    marginTop: SPACING.xs,
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
  resultsActionSection: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  resultsBtn: {
    width: '100%',
    maxWidth: 360,
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
