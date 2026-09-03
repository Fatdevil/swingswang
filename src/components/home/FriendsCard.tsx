/**
 * FriendsCard.tsx
 * SwingSwang
 *
 * Friends system card with management modal, friend code input,
 * and friend list. Uses FlatList instead of nested ScrollView
 * to avoid scroll-hijacking on Android.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';

interface Friend {
  name: string;
  code: string;
  streak: number;
}

interface FriendsCardProps {
  myCode: string;
  friends: Friend[];
  streakCount: number;
  onAddFriend: (name: string, code: string) => void;
}

function getStreakColor(streak: number): string {
  if (streak >= 500) return '#A855F7';
  if (streak >= 100) return '#EF4444';
  if (streak >= 50) return '#F97316';
  if (streak >= 10) return '#EAB308';
  return COLORS.accent;
}

export function FriendsCard({ myCode, friends, streakCount, onAddFriend }: FriendsCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');

  const streakColor = getStreakColor(streakCount);

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

    onAddFriend(randomName, cleaned);
    setFriendCodeInput('');
    Alert.alert('Friend Added!', `${randomName} was successfully added.`);
  };

  const copyMyCode = async () => {
    await Clipboard.setStringAsync(myCode);
    Alert.alert('Copied!', 'Your friend code has been copied.');
  };

  const renderFriendItem = ({ item: friend, index }: { item: Friend; index: number }) => (
    <View style={styles.friendRow}>
      <View>
        <Text style={styles.friendName}>{friend.name}</Text>
        <Text style={styles.friendCode}>{friend.code}</Text>
      </View>
      <View style={styles.friendStreak}>
        <Ionicons name="flame" size={16} color={streakColor} />
        <Text style={styles.friendStreakText}>{friend.streak} d</Text>
      </View>
    </View>
  );

  return (
    <>
      {/* Top Card */}
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

      {/* Management Modal */}
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

              {/* Friend list — uses FlatList to avoid nested ScrollView */}
              <View style={styles.friendListSection}>
                <Text style={styles.sectionLabel}>Friend List ({friends.length})</Text>
                {friends.length === 0 ? (
                  <Text style={styles.emptyFriendsText}>No friends added yet</Text>
                ) : (
                  <View style={styles.friendListContainer}>
                    <FlatList
                      data={friends}
                      renderItem={renderFriendItem}
                      keyExtractor={(item, index) => item.code + index}
                      scrollEnabled={friends.length > 5}
                      showsVerticalScrollIndicator={true}
                    />
                  </View>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
});
