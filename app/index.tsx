/**
 * index.tsx — Home Screen
 * SwingSwang
 *
 * Hero landing + video selection + analysis trigger.
 * Orchestrates extracted home components.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { checkRealEngineAvailability } from '../src/features/pose/PoseEngineFactory';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { isProcessing, statusDisplayText } from '../src/types/pose';
import { formatDuration, formatResolution, formatFileSize } from '../src/types/video';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY } from '../src/constants/theme';
import { getLocalDateString, calculateDaysDiff } from '../src/utils/streak';
import { FriendsCard } from '../src/components/home/FriendsCard';
import { ScoreCard } from '../src/components/home/ScoreCard';
import { StreakCard } from '../src/components/home/StreakCard';
import { PracticeHub } from '../src/components/home/PracticeHub';
import { SwingSetupCard } from '../src/components/home/SwingSetupCard';

export default function HomeScreen() {
  const router = useRouter();
  const {
    videoSource,
    status,
    analysisResult,
    selectAndLoadVideo,
    startAnalysis,
    resetAnalysis,
    history,
    clearHistory,
    streakCount,
    lastActiveDate,
    isStreakLoaded,
    setStreak,
    myCode,
    friends,
    addFriend,
    swingConfig,
    setSwingConfig,
    debugMode,
  } = useAnalysis();

  const engineAvailability = checkRealEngineAvailability();
  const isMockBlocked = !__DEV__ && !debugMode && !engineAvailability.available;

  const handleAnalyze = async () => {
    const success = await startAnalysis();
    if (success) {
      router.push('/player');
    }
  };

  // Daily streak checking (Risk 10: Run on mount/focus, not polling every 5s)
  useEffect(() => {
    if (!isStreakLoaded) return;

    const checkStreak = () => {
      const todayStr = getLocalDateString();
      const lastActive = lastActiveDate;

      // 1. New user (first log in)
      if (!lastActive) {
        setStreak(1, todayStr);
        return;
      }

      const diff = calculateDaysDiff(lastActive, todayStr);

      // 2. Next day (clock struck midnight or opened next day)
      if (diff === 1) {
        setStreak(streakCount + 1, todayStr);
      } 
      // 3. Broken streak (more than 1 day missed)
      else if (diff > 1) {
        setStreak(1, todayStr);
      }
      // If diff === 0, it's the same day, so do nothing.
    };

    // Check immediately upon rendering
    checkStreak();

    // Check when app resumes from background
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkStreak();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isStreakLoaded, streakCount, lastActiveDate, setStreak]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Friends System Top Card */}
        <FriendsCard
          myCode={myCode}
          friends={friends}
          streakCount={streakCount}
          onAddFriend={addFriend}
        />

        {/* Score & Streak Row */}
        <View style={styles.topRow}>
          <ScoreCard history={history} onClearHistory={clearHistory} />
          <StreakCard streakCount={streakCount} />
        </View>

        {/* Practice Hub (shows when no active video/results) */}
        {!videoSource && !analysisResult && (
          <PracticeHub
            streakCount={streakCount}
            hasAnalysisResult={!!analysisResult}
          />
        )}

        {/* Actions */}
        <View style={styles.actionSection}>
          {/* Status indicator */}
          {status.type !== 'idle' && status.type !== 'ready' && (
            <Text style={styles.statusText} accessibilityRole="alert" accessibilityLiveRegion="polite">{statusDisplayText(status)}</Text>
          )}

          {/* No video loaded — show primary capture/import actions */}
          {!videoSource && !analysisResult && (
            <>
              <Button
                title="RECORD NEW SWING"
                onPress={() => router.push('/camera' as any)}
                variant="primary"
                style={styles.processBtn}
                accessibilityLabel="Record new swing"
                accessibilityHint="Opens the camera to record your golf swing"
              />
              <Button
                title="Import video from gallery"
                onPress={selectAndLoadVideo}
                variant="ghost"
                accessibilityLabel="Import video from gallery"
                accessibilityHint="Opens your photo library to select a swing video"
              />
            </>
          )}

          {/* Video loaded — show info and process button */}
          {videoSource && !analysisResult && (
            <>
              <Card title="Selected Video" style={styles.videoCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Analysis Engine</Text>
                  <Text 
                    style={[
                      styles.metaValue, 
                      { 
                        color: engineAvailability.available ? '#10B981' : '#F59E0B', 
                        fontWeight: 'bold' 
                      }
                    ]}
                  >
                    {engineAvailability.available ? 'REAL (ExecuTorch Linked)' : 'MOCK (Simulation)'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{formatDuration(videoSource.metadata.duration)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Resolution</Text>
                  <Text style={styles.metaValue}>
                    {formatResolution(videoSource.metadata.width, videoSource.metadata.height)}
                  </Text>
                </View>
                {videoSource.metadata.fileSize && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Size</Text>
                    <Text style={styles.metaValue}>{formatFileSize(videoSource.metadata.fileSize)}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Orientation</Text>
                  <Text style={styles.metaValue}>{videoSource.metadata.orientation}</Text>
                </View>
              </Card>

              {!engineAvailability.available && (
                <View style={styles.mockCallout} accessible={true} accessibilityRole="alert" accessibilityLabel="Running in Simulation Mode. Create a Native Development Build to enable real pose inference.">
                  <Ionicons name="warning" size={16} color="#F59E0B" />
                  <Text style={styles.mockCalloutText}>
                    Running in Simulation Mode. Create a Native Development Build to enable real YOLO pose inference.
                  </Text>
                </View>
              )}

              {/* Swing Configuration Selectors */}
              <SwingSetupCard
                swingConfig={swingConfig}
                onConfigChange={setSwingConfig}
              />

              {isMockBlocked && (
                <Card title="Production Alert" style={StyleSheet.flatten([styles.videoCard, { borderColor: COLORS.error, borderWidth: 1.5 }])}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY }}>
                    ⚠️ Mock Analysis is disabled in production. A Development Build with native pose modules is required to analyze swings.
                  </Text>
                </Card>
              )}

              <Button
                title={isMockBlocked ? "MOCK DISABLED" : "PROCESS VIDEO"}
                onPress={handleAnalyze}
                variant="primary"
                loading={isProcessing(status)}
                disabled={isProcessing(status) || isMockBlocked}
                style={styles.processBtn}
                accessibilityLabel={isMockBlocked ? "Processing disabled in production" : "Process video for analysis"}
                accessibilityHint={isMockBlocked ? undefined : "Double tap to start analyzing your swing video"}
              />

              <Button
                title="Choose different video"
                onPress={selectAndLoadVideo}
                variant="ghost"
                accessibilityLabel="Choose different video"
                accessibilityHint="Opens your photo library to select a different video"
              />
            </>
          )}

          {/* Analysis complete */}
          {analysisResult && (
            <>
              <Card title="Analysis Complete" style={styles.videoCard}>
                <Text style={styles.completeText} accessible={true} accessibilityLabel={`Analysis complete. ${analysisResult.processing.framesAnalyzed} frames analyzed, ${analysisResult.pose.framesReliable} reliable.`}>
                  {analysisResult.processing.framesAnalyzed} frames analyzed • {' '}
                  {analysisResult.pose.framesReliable} reliable
                </Text>
              </Card>

              <Button
                title="VIEW RESULTS"
                onPress={() => router.push('/results')}
                variant="primary"
                style={styles.processBtn}
                accessibilityLabel="View analysis results"
                accessibilityHint="Shows detailed metrics and measurements from your swing"
              />

              <Button
                title="VIEW PLAYER"
                onPress={() => router.push('/player')}
                variant="secondary"
                style={styles.secondaryBtn}
                accessibilityLabel="View swing playback"
                accessibilityHint="Opens the video player with pose overlay"
              />

              <Button
                title="Start over"
                onPress={resetAnalysis}
                variant="ghost"
                accessibilityLabel="Start over"
                accessibilityHint="Clears the current analysis and returns to video selection"
              />
            </>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.version}>Phase 0 • v0.1.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    width: '100%',
    height: 90,
  },
  actionSection: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  statusText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  videoCard: {
    marginBottom: SPACING.md,
  },
  mockCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  mockCalloutText: {
    fontFamily: FONT_FAMILY,
    color: '#D97706',
    fontSize: FONT_SIZE.xs - 1,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
  metaValue: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontVariant: ['tabular-nums'],
  },
  completeText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.success,
    fontSize: FONT_SIZE.sm,
  },
  processBtn: {
    marginTop: SPACING.sm,
  },
  secondaryBtn: {
    marginTop: SPACING.sm,
  },
  version: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginBottom: SPACING.md,
    opacity: 0.5,
  },
});
