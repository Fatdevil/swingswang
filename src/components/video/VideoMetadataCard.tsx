/**
 * VideoMetadataCard.tsx
 * SwingSwang
 *
 * Displays video metadata in a Card layout.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../constants/theme';
import {
  VideoMetadata,
  formatDuration,
  formatFileSize,
  formatResolution,
} from '../../types/video';
import { Card } from '../ui/Card';

export interface VideoMetadataCardProps {
  /** Video metadata to display. */
  metadata: VideoMetadata;
}

interface MetadataRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function MetadataRow({ icon, label, value }: MetadataRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={16} color={COLORS.textTertiary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function VideoMetadataCard({ metadata }: VideoMetadataCardProps) {
  const {
    duration,
    width,
    height,
    orientation,
    frameRate,
    fileSize,
  } = metadata;

  return (
    <Card title="Video Info">
      <MetadataRow
        icon="time-outline"
        label="Duration"
        value={formatDuration(duration)}
      />
      <MetadataRow
        icon="resize-outline"
        label="Resolution"
        value={formatResolution(width, height)}
      />
      <MetadataRow
        icon="phone-portrait-outline"
        label="Orientation"
        value={orientation.charAt(0).toUpperCase() + orientation.slice(1)}
      />
      {frameRate != null && (
        <MetadataRow
          icon="speedometer-outline"
          label="Frame Rate"
          value={`${frameRate} fps`}
        />
      )}
      {fileSize != null && (
        <MetadataRow
          icon="document-outline"
          label="File Size"
          value={formatFileSize(fileSize)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  value: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
    fontVariant: ['tabular-nums'],
  },
});
