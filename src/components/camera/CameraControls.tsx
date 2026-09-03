import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';

interface CameraControlsProps {
  isRecording: boolean;
  autoCapture: boolean;
  readinessStatus: string;
  onToggleAutoCapture: () => void;
  onRecordPress: () => void;
}

export function CameraControls({
  isRecording,
  autoCapture,
  readinessStatus,
  onToggleAutoCapture,
  onRecordPress,
}: CameraControlsProps) {
  return (
    <View style={styles.bottomBar}>
      {/* Toggle Auto Capture */}
      <Pressable
        accessibilityRole="togglebutton"
        accessibilityState={{ checked: autoCapture }}
        accessibilityLabel={autoCapture ? 'Auto-capture: ON' : 'Auto-capture: OFF'}
        style={[styles.toggleBtn, autoCapture && styles.toggleBtnActive]}
        onPress={onToggleAutoCapture}
      >
        <Ionicons
          name={autoCapture ? 'flash' : 'flash-off'}
          size={20}
          color={autoCapture ? '#FFFFFF' : COLORS.textSecondary}
        />
        <Text style={[styles.toggleBtnText, autoCapture && styles.toggleBtnTextActive]}>
          Auto-Capture: {autoCapture ? 'ON' : 'OFF'}
        </Text>
      </Pressable>

      {/* Record button */}
      <View style={styles.recordRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Record swing'}
          style={[
            styles.recordOuterCircle,
            isRecording && styles.recordOuterActive,
            readinessStatus === 'READY' && !isRecording && styles.recordOuterReady,
          ]}
          onPress={onRecordPress}
        >
          <View
            style={[
              styles.recordInnerCircle,
              isRecording ? styles.recordInnerActive : styles.recordInnerIdle,
            ]}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.lg,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: 'transparent',
  },
  toggleBtnText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  recordRow: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  recordOuterCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordOuterReady: {
    borderColor: '#10B981',
  },
  recordOuterActive: {
    borderColor: '#EF4444',
  },
  recordInnerCircle: {
    borderRadius: 25,
  },
  recordInnerIdle: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
  },
  recordInnerActive: {
    width: 32,
    height: 32,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
});
