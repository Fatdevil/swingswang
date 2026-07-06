/**
 * index.tsx — Home Screen
 * SwingSwang
 *
 * Hero landing + video selection + analysis trigger.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { isProcessing, statusDisplayText } from '../src/types/pose';
import { formatDuration, formatResolution, formatFileSize } from '../src/types/video';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY } from '../src/constants/theme';
import { getLocalDateString, calculateDaysDiff } from '../src/utils/streak';
import * as Clipboard from 'expo-clipboard';
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
  } = useAnalysis();

  const [modalVisible, setModalVisible] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [drillDone, setDrillDone] = useState(false);

  const PRACTICE_TIPS = [
    "Keep your spine steady. Spine angle stability is key to consistent strikes.",
    "Tempo is everything. Focus on a smooth 3:1 swing rhythm.",
    "Keep your head centered. Avoid swaying left or right during the backswing.",
    "Hip motion should be a rotation, not a lateral slide.",
    "Relax your hands. Heavy grip tension kills your clubhead speed."
  ];
  const todayIndex = new Date().getDay() % PRACTICE_TIPS.length;
  const tipOfTheDay = PRACTICE_TIPS[todayIndex];

  const handleAnalyze = async () => {
    const success = await startAnalysis();
    if (success) {
      router.push('/player');
    }
  };

  const handleAddFriend = () => {
    const cleaned = friendCodeInput.trim().toUpperCase();
    const pattern = /^[A-Z]{4}-[0-9]{4}$/;
    if (!pattern.test(cleaned)) {
      Alert.alert(
        'Invalid Format',
        'Friend code must be 4 letters followed by a hyphen and 4 numbers (e.g. ABCD-1234)'
      );
      return;
    }

    if (friends.some(f => f.code === cleaned)) {
      Alert.alert('Already Friends', 'You have already added this friend!');
      return;
    }

    if (cleaned === myCode) {
      Alert.alert('Self Friend', 'You cannot add your own friend code!');
      return;
    }

    const mockNames = ['Alex', 'Taylor', 'Casey', 'Sam', 'Jordan', 'Morgan'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)] + ' ' + (friends.length + 1);

    addFriend(randomName, cleaned);
    setFriendCodeInput('');
    Alert.alert('Friend Added!', `${randomName} was successfully added.`);
  };

  const copyMyCode = async () => {
    await Clipboard.setStringAsync(myCode);
    Alert.alert('Copied!', 'Your friend code has been copied.');
  };

  const averageScore = history.length > 0
    ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(1)
    : null;

  // Real-time daily streak checking
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

    // Check periodically (every 5 seconds) for real-time midnight transition
    const timer = setInterval(checkStreak, 5000);
    return () => clearInterval(timer);
  }, [isStreakLoaded, streakCount, lastActiveDate, setStreak]);

  const getStreakColor = (streak: number): string => {
    if (streak >= 500) return '#A855F7'; // Purple
    if (streak >= 100) return '#EF4444'; // Red
    if (streak >= 50) return '#F97316';  // Orange
    if (streak >= 10) return '#EAB308';  // Yellow
    return COLORS.accent;                // Emerald Green
  };
  const streakColor = getStreakColor(streakCount);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Friends System Top Card */}
        <Pressable onPress={() => setModalVisible(true)} style={styles.friendsCard}>
          <View style={styles.friendsHeader}>
            <View style={styles.friendsHeaderLeft}>
              <Ionicons name="people" size={22} color={COLORS.accent} />
              <Text style={styles.friendsTitle}>FRIENDS SYSTEM</Text>
            </View>
            <Text style={styles.friendsCount}>{friends.length} active</Text>
          </View>
          <Text style={styles.friendsSubtitle}>
            Tap to view your code & add friends
          </Text>
        </Pressable>

        {/* Existing Widgets Row (Moved Down) */}
        <View style={styles.topRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>AVG SCORE</Text>
            <Text style={styles.scoreValue}>
              {averageScore !== null ? `${averageScore}/10` : '-/10'}
            </Text>
            <View style={styles.scoreFooter}>
              <Text style={styles.scoreSubtitle}>
                {history.length} {history.length === 1 ? 'swing' : 'swings'}
              </Text>
              {history.length > 0 && (
                <Pressable onPress={clearHistory} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.streakBox}>
            <Text style={styles.streakLabel}>DAILY STREAK</Text>
            <View style={styles.streakRow}>
              <Ionicons name="flame" size={24} color={streakColor} />
              <Text style={[styles.streakValue, { color: streakColor }]}>
                {streakCount} {streakCount === 1 ? 'Day' : 'Days'}
              </Text>
            </View>
            <Text style={styles.streakSubtitle}>
              {streakCount > 0 ? 'Keep it going!' : 'Log in tomorrow'}
            </Text>
          </View>
        </View>

        {/* Practice Hub Card (Fills the free space nicely when no active video/results) */}
        {!videoSource && !analysisResult && (
          <Card title="PRACTICE HUB" style={styles.practiceCard}>
            {/* Daily Tip */}
            <View style={styles.tipBox}>
              <View style={styles.tipHeader}>
                <Ionicons name="bulb" size={16} color={COLORS.warning} />
                <Text style={styles.tipTitle}>TIP OF THE DAY</Text>
              </View>
              <Text style={styles.tipText}>{tipOfTheDay}</Text>
            </View>

            {/* Drills Checklist */}
            <View style={styles.drillSection}>
              <Text style={styles.drillTitle}>TODAY'S DRILLS</Text>
              
              {/* Drill 1: Active Streak */}
              <View style={styles.drillRow}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                <Text style={[styles.drillText, styles.drillCompleted]}>
                  Log in streak active ({streakCount}d)
                </Text>
              </View>

              {/* Drill 2: Analyze Swing */}
              <View style={styles.drillRow}>
                <Ionicons 
                  name={analysisResult ? "checkmark-circle" : "ellipse-outline"} 
                  size={20} 
                  color={analysisResult ? COLORS.accent : COLORS.textTertiary} 
                />
                <Text style={[
                  styles.drillText, 
                  analysisResult && styles.drillCompleted
                ]}>
                  Record or analyze a swing
                </Text>
              </View>

              {/* Drill 3: Manual Practice Drill */}
              <Pressable onPress={() => setDrillDone(!drillDone)} style={styles.drillRow}>
                <Ionicons 
                  name={drillDone ? "checkmark-circle" : "ellipse-outline"} 
                  size={20} 
                  color={drillDone ? COLORS.accent : COLORS.textTertiary} 
                />
                <Text style={[
                  styles.drillText, 
                  drillDone && styles.drillCompleted
                ]}>
                  Drill: 15 head-still practice rotations
                </Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Centered Modal (fills half the screen in the middle) */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>FRIEND MANAGEMENT</Text>
                <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              {/* Scrollable layout inside modal */}
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Input section */}
                <View style={styles.inputSection}>
                  <Text style={styles.sectionLabel}>Add Friend Code</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter code (e.g. ABCD-1234)"
                      placeholderTextColor={COLORS.textTertiary}
                      value={friendCodeInput}
                      onChangeText={setFriendCodeInput}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <Pressable onPress={handleAddFriend} style={styles.addBtn}>
                      <Ionicons name="person-add" size={18} color="#FFF" />
                    </Pressable>
                  </View>
                </View>

                {/* Show own code */}
                <View style={styles.myCodeSection}>
                  <Text style={styles.sectionLabel}>Your Friend Code</Text>
                  <Pressable onPress={copyMyCode} style={styles.myCodeBox}>
                    <Text style={styles.myCodeText}>{myCode}</Text>
                    <Ionicons name="copy-outline" size={16} color={COLORS.accent} />
                  </Pressable>
                  <Text style={styles.myCodeTip}>Tap your code to copy and share it</Text>
                </View>

                {/* Friend list */}
                <View style={styles.friendListSection}>
                  <Text style={styles.sectionLabel}>Friend List ({friends.length})</Text>
                  {friends.length === 0 ? (
                    <Text style={styles.emptyFriendsText}>No friends added yet</Text>
                  ) : (
                    <View style={styles.friendListContainer}>
                      <ScrollView
                        nestedScrollEnabled={true}
                        style={styles.friendListScroll}
                        showsVerticalScrollIndicator={true}
                      >
                        {friends.map((friend, idx) => (
                          <View key={friend.code + idx} style={styles.friendRow}>
                            <View>
                              <Text style={styles.friendName}>{friend.name}</Text>
                              <Text style={styles.friendCode}>{friend.code}</Text>
                            </View>
                            <View style={styles.friendStreak}>
                              <Ionicons name="flame" size={16} color={streakColor} />
                              <Text style={styles.friendStreakText}>{friend.streak} d</Text>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Actions */}
        <View style={styles.actionSection}>
          {/* Status indicator */}
          {status.type !== 'idle' && status.type !== 'ready' && (
            <Text style={styles.statusText}>{statusDisplayText(status)}</Text>
          )}

          {/* Video loaded — show info and process button */}
          {videoSource && !analysisResult && (
            <>
              <Card title="Selected Video" style={styles.videoCard}>
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

              <Button
                title="PROCESS VIDEO"
                onPress={handleAnalyze}
                variant="primary"
                loading={isProcessing(status)}
                disabled={isProcessing(status)}
                style={styles.processBtn}
              />

              <Button
                title="Choose different video"
                onPress={selectAndLoadVideo}
                variant="ghost"
              />
            </>
          )}

          {/* Analysis complete */}
          {analysisResult && (
            <>
              <Card title="Analysis Complete" style={styles.videoCard}>
                <Text style={styles.completeText}>
                  {analysisResult.processing.framesAnalyzed} frames analyzed • {' '}
                  {analysisResult.pose.framesReliable} reliable
                </Text>
              </Card>

              <Button
                title="VIEW RESULTS"
                onPress={() => router.push('/results')}
                variant="primary"
                style={styles.processBtn}
              />

              <Button
                title="VIEW PLAYER"
                onPress={() => router.push('/player')}
                variant="secondary"
                style={styles.secondaryBtn}
              />

              <Button
                title="Start over"
                onPress={resetAnalysis}
                variant="ghost"
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
  friendsCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    marginTop: SPACING.md,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  friendsTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold as any,
    letterSpacing: 0.5,
  },
  friendsCount: {
    fontFamily: FONT_FAMILY,
    color: COLORS.accent,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  friendsSubtitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
  },
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    width: '100%',
    height: 90,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreValue: {
    fontFamily: FONT_FAMILY,
    color: COLORS.accent, // modern light green
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  scoreFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  scoreSubtitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
  },
  clearBtn: {
    padding: 2,
  },
  streakBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    marginBottom: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  streakValue: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  streakSubtitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
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
  instructionText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  plusSymbol: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold as any,
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  inputSection: {
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  textInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.card,
    fontSize: FONT_SIZE.sm,
  },
  addBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myCodeSection: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  myCodeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginTop: 4,
  },
  myCodeText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold as any,
    letterSpacing: 1.5,
  },
  myCodeTip: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginTop: 6,
  },
  friendListSection: {
    marginBottom: SPACING.md,
  },
  friendListContainer: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
  },
  friendListScroll: {
    flexGrow: 0,
  },
  emptyFriendsText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  friendName: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  friendCode: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  friendStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  friendStreakText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
  },
  practiceCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    marginVertical: SPACING.sm,
  },
  tipBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: SPACING.sm,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  tipTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
  },
  tipText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
  },
  drillSection: {
    marginTop: 4,
  },
  drillTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 6,
  },
  drillText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
  },
  drillCompleted: {
    color: COLORS.textTertiary,
    textDecorationLine: 'line-through',
  },
});
