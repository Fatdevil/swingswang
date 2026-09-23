/**
 * P1P10PositionSelector.tsx
 * SwingSwang – MediaPipe P1–P10 Video Player
 *
 * Horizontal scrollable quick-jump chips for all 10 positions.
 * Highlights current active phase and cleanly distinguishes exact vs proxy vs abstained.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';
import { PPosition, POSITIONS } from '@/features/events/p1p10/types';
import { P1P10EventItem } from './P1P10TimelineScrubber';

/** Swedish short display names for P1–P10. */
export const P1P10_SWEDISH_NAMES: Record<PPosition, { title: string; subtitle: string }> = {
  P1: { title: 'Address', subtitle: 'Uppställning' },
  P2: { title: 'Skaft vågrätt', subtitle: 'Baksving (proxy)' },
  P3: { title: 'Lead arm vågrätt', subtitle: 'Baksving' },
  P4: { title: 'Topp', subtitle: 'Övergång' },
  P5: { title: 'Lead arm vågrätt', subtitle: 'Nedsving' },
  P6: { title: 'Skaft vågrätt', subtitle: 'Nedsving (proxy)' },
  P7: { title: 'Bollträff', subtitle: 'Träffzon (proxy)' },
  P8: { title: 'Skaft vågrätt', subtitle: 'Genomsving (proxy)' },
  P9: { title: 'Trail arm vågrätt', subtitle: 'Genomsving' },
  P10: { title: 'Finish', subtitle: 'Avslut' },
};

export interface P1P10PositionSelectorProps {
  /** P1–P10 events dictionary or array. */
  events?: Record<PPosition, P1P10EventItem> | readonly P1P10EventItem[];
  /** Current playback time in seconds. */
  currentTime: number;
  /** Currently selected position ID (if explicitly picked). */
  selectedPosition?: PPosition | null;
  /** Callback when user selects a detected position. */
  onSelectPosition: (timeSeconds: number, position: PPosition) => void;
  /** Callback when user selects an abstained position to view reason. */
  onSelectAbstained?: (position: PPosition, reasonCode?: string) => void;
}

export function P1P10PositionSelector({
  events,
  currentTime,
  selectedPosition,
  onSelectPosition,
  onSelectAbstained,
}: P1P10PositionSelectorProps) {
  // Normalize events map
  const eventsMap = useMemo<Record<PPosition, P1P10EventItem | undefined>>(() => {
    if (!events) return {} as Record<PPosition, P1P10EventItem>;
    if (Array.isArray(events)) {
      const map: Partial<Record<PPosition, P1P10EventItem>> = {};
      for (const e of events) {
        map[e.position as PPosition] = e;
      }
      return map as Record<PPosition, P1P10EventItem>;
    }
    return events as Record<PPosition, P1P10EventItem>;
  }, [events]);

  // Determine which position is closest to currentTime
  const closestPosition = useMemo<PPosition | null>(() => {
    let bestPos: PPosition | null = null;
    let minDiff = 0.25; // max 250ms proximity threshold

    for (const pos of POSITIONS) {
      const evt = eventsMap[pos];
      if (evt && evt.timestampMs !== null && evt.status !== 'ABSTAIN') {
        const timeSec = evt.timestampMs / 1000;
        const diff = Math.abs(currentTime - timeSec);
        if (diff < minDiff) {
          minDiff = diff;
          bestPos = pos;
        }
      }
    }
    return bestPos;
  }, [eventsMap, currentTime]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>P1–P10 SVINGPOSITIONER</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {POSITIONS.map((pos) => {
          const evt = eventsMap[pos];
          const info = P1P10_SWEDISH_NAMES[pos];
          const isDetected = evt && evt.status !== 'ABSTAIN' && evt.timestampMs !== null;
          const isProxy = evt?.status === 'DETECTED_PROXY';
          const isAbstained = !evt || evt.status === 'ABSTAIN';
          const timeSec = isDetected ? (evt!.timestampMs! / 1000) : null;
          const isActive = (selectedPosition === pos) || (closestPosition === pos);

          return (
            <TouchableOpacity
              key={pos}
              style={[
                styles.chip,
                isProxy && styles.chipProxy,
                isAbstained && styles.chipAbstained,
                isActive && (isProxy ? styles.chipProxyActive : styles.chipActive),
              ]}
              onPress={() => {
                if (isDetected && timeSec !== null) {
                  onSelectPosition(timeSec, pos);
                } else if (isAbstained && onSelectAbstained) {
                  onSelectAbstained(pos, (evt as any)?.reasonCode);
                }
              }}
              activeOpacity={0.7}
            >
              {/* Header row: P-tag + Badge */}
              <View style={styles.chipHeader}>
                <Text
                  style={[
                    styles.chipPositionText,
                    isActive && styles.chipPositionTextActive,
                    isAbstained && styles.chipPositionTextAbstained,
                  ]}
                >
                  {pos}
                </Text>

                {isProxy ? (
                  <View style={styles.proxyBadge}>
                    <Text style={styles.proxyBadgeText}>⚡ PROXY</Text>
                  </View>
                ) : isAbstained ? (
                  <View style={styles.abstainedBadge}>
                    <Text style={styles.abstainedBadgeText}>AVSTOD</Text>
                  </View>
                ) : (
                  <View style={styles.exactBadge}>
                    <Text style={styles.exactBadgeText}>EXAKT</Text>
                  </View>
                )}
              </View>

              {/* Title & Timing */}
              <Text
                style={[
                  styles.chipTitle,
                  isActive && styles.chipTitleActive,
                  isAbstained && styles.chipTitleAbstained,
                ]}
                numberOfLines={1}
              >
                {info.title}
              </Text>

              <Text
                style={[
                  styles.chipTime,
                  isActive && styles.chipTimeActive,
                  isAbstained && styles.chipTimeAbstained,
                ]}
              >
                {timeSec !== null ? `${timeSec.toFixed(2)}s` : 'Ej funnen'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  sectionHeader: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 100,
    maxWidth: 130,
  },
  chipProxy: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderStyle: 'dashed',
  },
  chipAbstained: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  chipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  chipProxyActive: {
    backgroundColor: '#FEF3C7',
    borderColor: COLORS.warning,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  chipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  chipPositionText: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLORS.textPrimary,
  },
  chipPositionTextActive: {
    color: COLORS.textPrimary,
  },
  chipPositionTextAbstained: {
    color: COLORS.textTertiary,
  },
  exactBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  exactBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: '#065F46',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  proxyBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  proxyBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: '#B45309',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  abstainedBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  abstainedBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  chipTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium as any,
    marginBottom: 2,
  },
  chipTitleActive: {
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  chipTitleAbstained: {
    color: COLORS.textTertiary,
  },
  chipTime: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: COLORS.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  chipTimeActive: {
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  chipTimeAbstained: {
    color: COLORS.textTertiary,
  },
});
