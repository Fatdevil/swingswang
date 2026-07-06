/**
 * settings.tsx — Settings Screen
 * SwingSwang
 *
 * Premium, minimalist Settings page allowing users to customize the app theme.
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, ThemeKey, THEMES } from '../src/context/ThemeContext';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../src/constants/theme';
import { Card } from '../src/components/ui/Card';

interface ThemeCardProps {
  label: string;
  themeKey: ThemeKey;
  isSelected: boolean;
  onSelect: () => void;
}

function ThemeCard({ label, themeKey, isSelected, onSelect }: ThemeCardProps) {
  const theme = THEMES[themeKey];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Light spring selection feedback animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
    ]).start();
    onSelect();
  };

  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.themeCard,
          {
            backgroundColor: theme.background,
            borderColor: isSelected ? theme.accent : theme.border,
            borderWidth: isSelected ? 2.5 : 1.5,
          },
        ]}
      >
        {/* Color preview layout */}
        <View style={styles.previewContainer}>
          {/* Mock Button Accent Preview */}
          <View style={[styles.previewButton, { backgroundColor: theme.buttonBackground }]}>
            <View style={[styles.previewButtonDot, { backgroundColor: theme.buttonText }]} />
          </View>
          {/* Text Contrast Preview */}
          <Text style={[styles.previewText, { color: theme.textPrimary }]}>Aa</Text>
        </View>

        {/* Selected Checkmark Indicator */}
        {isSelected && (
          <View style={[styles.checkmarkBadge, { backgroundColor: theme.accent }]}>
            <Ionicons name="checkmark" size={10} color={theme.background} />
          </View>
        )}
      </Pressable>
      <Text style={[styles.cardLabel, { color: COLORS.textPrimary }]}>{label}</Text>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const { themeKey, setThemeKey } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header Row with Back Button */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          <Text style={[styles.backText, { color: COLORS.textPrimary }]}>Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: COLORS.textPrimary }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
            Personalize your SwingSwang experience.
          </Text>
        </View>

        {/* Theme Settings Section */}
        <Card title="App Theme" style={styles.sectionCard}>
          <Text style={[styles.sectionDesc, { color: COLORS.textSecondary }]}>
            Select your preferred color profile. The background and buttons will adjust dynamically.
          </Text>

          <View style={styles.themeRow}>
            <ThemeCard
              label="Black & White"
              themeKey="black-white"
              isSelected={themeKey === 'black-white'}
              onSelect={() => setThemeKey('black-white')}
            />
            <ThemeCard
              label="White & Black"
              themeKey="white-black"
              isSelected={themeKey === 'white-black'}
              onSelect={() => setThemeKey('white-black')}
            />
            <ThemeCard
              label="White & Green"
              themeKey="white-green"
              isSelected={themeKey === 'white-green'}
              onSelect={() => setThemeKey('white-green')}
            />
          </View>
        </Card>

        {/* System Settings Info Section */}
        <Card title="About SwingSwang" style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: COLORS.textPrimary }]}>Phase 0 (v0.1.0)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>Build Mode</Text>
            <Text style={[styles.infoValue, { color: COLORS.textPrimary }]}>Mock Development</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: COLORS.textSecondary }]}>Local Persistence</Text>
            <Text style={[styles.infoValue, { color: COLORS.success }]}>FileSystem Active</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  header: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  sectionCard: {
    padding: SPACING.md,
  },
  sectionDesc: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  cardWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  themeCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  previewContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewButton: {
    width: 32,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  infoLabel: {
    fontSize: FONT_SIZE.sm,
  },
  infoValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  headerRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  backText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium as any,
  },
});
