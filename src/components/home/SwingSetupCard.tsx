/**
 * SwingSetupCard.tsx
 * SwingSwang
 *
 * Camera view, handedness, and club type configuration selectors.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';

interface SwingConfig {
  cameraView: 'FO' | 'DTL';
  handedness: 'RIGHT' | 'LEFT';
  club: 'DRIVER' | 'MID_IRON' | 'WEDGE' | 'OTHER';
}

interface SwingSetupCardProps {
  swingConfig: SwingConfig;
  onConfigChange: (config: SwingConfig) => void;
}

export function SwingSetupCard({ swingConfig, onConfigChange }: SwingSetupCardProps) {
  return (
    <Card title="Swing Setup" style={styles.configCard}>
      {/* Camera View Selector */}
      <Text style={styles.configLabel}>CAMERA VIEW</Text>
      <View style={styles.selectorRow}>
        <Pressable
          style={[
            styles.selectorButton,
            swingConfig.cameraView === 'FO' && styles.selectorButtonActive,
          ]}
          onPress={() => onConfigChange({ ...swingConfig, cameraView: 'FO' })}
        >
          <Ionicons name="videocam-outline" size={16} color={swingConfig.cameraView === 'FO' ? '#FFFFFF' : COLORS.textSecondary} />
          <Text
            style={[
              styles.selectorButtonText,
              swingConfig.cameraView === 'FO' && styles.selectorButtonTextActive,
            ]}
          >
            Face On (FO)
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.selectorButton,
            swingConfig.cameraView === 'DTL' && styles.selectorButtonActive,
          ]}
          onPress={() => onConfigChange({ ...swingConfig, cameraView: 'DTL' })}
        >
          <Ionicons name="git-commit-outline" size={16} color={swingConfig.cameraView === 'DTL' ? '#FFFFFF' : COLORS.textSecondary} />
          <Text
            style={[
              styles.selectorButtonText,
              swingConfig.cameraView === 'DTL' && styles.selectorButtonTextActive,
            ]}
          >
            Down the Line (DTL)
          </Text>
        </Pressable>
      </View>

      {/* Handedness Selector */}
      <Text style={styles.configLabel}>GOLFER HANDEDNESS</Text>
      <View style={styles.selectorRow}>
        <Pressable
          style={[
            styles.selectorButton,
            swingConfig.handedness === 'RIGHT' && styles.selectorButtonActive,
          ]}
          onPress={() => onConfigChange({ ...swingConfig, handedness: 'RIGHT' })}
        >
          <Text
            style={[
              styles.selectorButtonText,
              swingConfig.handedness === 'RIGHT' && styles.selectorButtonTextActive,
            ]}
          >
            Right-Handed
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.selectorButton,
            swingConfig.handedness === 'LEFT' && styles.selectorButtonActive,
          ]}
          onPress={() => onConfigChange({ ...swingConfig, handedness: 'LEFT' })}
        >
          <Text
            style={[
              styles.selectorButtonText,
              swingConfig.handedness === 'LEFT' && styles.selectorButtonTextActive,
            ]}
          >
            Left-Handed
          </Text>
        </Pressable>
      </View>

      {/* Club Category Selector */}
      <Text style={styles.configLabel}>CLUB TYPE</Text>
      <View style={styles.selectorRowWrap}>
        {(['DRIVER', 'MID_IRON', 'WEDGE', 'OTHER'] as const).map((clubType) => (
          <Pressable
            key={clubType}
            style={[
              styles.clubButton,
              swingConfig.club === clubType && styles.selectorButtonActive,
            ]}
            onPress={() => onConfigChange({ ...swingConfig, club: clubType })}
          >
            <Text
              style={[
                styles.clubButtonText,
                swingConfig.club === clubType && styles.selectorButtonTextActive,
              ]}
            >
              {clubType === 'MID_IRON' ? 'Iron' : clubType.charAt(0) + clubType.slice(1).toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  configCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
  },
  configLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  selectorRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  selectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
  },
  selectorButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  selectorButtonText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  selectorButtonTextActive: {
    color: '#FFFFFF',
  },
  clubButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
  },
  clubButtonText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
