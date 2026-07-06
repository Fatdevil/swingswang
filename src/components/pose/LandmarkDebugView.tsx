/**
 * LandmarkDebugView.tsx
 * SwingSwang
 *
 * Debug view showing all landmarks with positions and confidence values.
 * Scrollable, monospaced text, color-coded by confidence.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants/theme';
import { PoseFrame } from '../../types/pose';
import {
  LandmarkID,
  LANDMARK_NAMES,
  LANDMARK_COUNT,
  isLandmarkVisible,
} from '../../types/landmarks';

export interface LandmarkDebugViewProps {
  /** Current pose frame to debug (null shows empty state). */
  poseFrame: PoseFrame | null;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return COLORS.success;
  if (confidence >= 0.4) return COLORS.warning;
  return COLORS.error;
}

export default function LandmarkDebugView({ poseFrame }: LandmarkDebugViewProps) {
  if (!poseFrame) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No pose frame data</Text>
      </View>
    );
  }

  const rows: React.ReactNode[] = [];

  for (let id = 0; id < LANDMARK_COUNT; id++) {
    const landmark = poseFrame.landmarks.get(id as LandmarkID);
    const name = LANDMARK_NAMES[id as LandmarkID] ?? `Unknown(${id})`;

    if (!landmark) {
      rows.push(
        <View key={id} style={styles.row}>
          <Text style={styles.idText}>{String(id).padStart(2, '0')}</Text>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={[styles.monoText, { color: COLORS.textTertiary }]}>
            — not detected —
          </Text>
        </View>,
      );
      continue;
    }

    const visible = isLandmarkVisible(landmark);
    const confColor = confidenceColor(landmark.confidence);

    rows.push(
      <View key={id} style={[styles.row, !visible && styles.rowDimmed]}>
        <Text style={styles.idText}>{String(id).padStart(2, '0')}</Text>
        <Text style={[styles.nameText, !visible && styles.dimmedText]}>{name}</Text>
        <Text style={styles.monoText}>
          x:{landmark.x.toFixed(3)}
        </Text>
        <Text style={styles.monoText}>
          y:{landmark.y.toFixed(3)}
        </Text>
        <Text style={[styles.monoText, { color: confColor }]}>
          {(landmark.confidence * 100).toFixed(0)}%
        </Text>
      </View>,
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>ID</Text>
        <Text style={[styles.headerText, styles.nameText]}>Landmark</Text>
        <Text style={styles.headerText}>X</Text>
        <Text style={styles.headerText}>Y</Text>
        <Text style={styles.headerText}>Conf</Text>
      </View>
      {rows}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
    marginBottom: SPACING.xs,
  },
  headerText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 52,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  rowDimmed: {
    opacity: 0.4,
  },
  idText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textTertiary,
    width: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  nameText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
    flex: 1,
    marginLeft: SPACING.xs,
  },
  monoText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    color: COLORS.textPrimary,
    width: 52,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  dimmedText: {
    color: COLORS.textTertiary,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    textAlign: 'center',
    padding: SPACING.lg,
  },
});
