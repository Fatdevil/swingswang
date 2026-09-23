/**
 * P1P10TimelineScrubber.tsx
 * SwingSwang – MediaPipe P1–P10 Video Player
 *
 * Interactive timeline scrubber with event pins for all 10 P-positions.
 * Provides distinct visual treatment for DETECTED_EXACT vs DETECTED_PROXY markers.
 */

import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';
import { PPosition, POSITIONS } from '@/features/events/p1p10/types';

export interface P1P10EventItem {
  readonly position: PPosition;
  readonly semantic: string;
  readonly status: 'DETECTED_EXACT' | 'DETECTED_PROXY' | 'ABSTAIN';
  readonly timestampMs: number | null;
  readonly qualityScore?: number | null;
  readonly warnings?: string[];
}

export interface P1P10TimelineScrubberProps {
  /** Total video duration in seconds. */
  duration: number;
  /** Current playback time in seconds. */
  currentTime: number;
  /** P1–P10 events dictionary or array. */
  events?: Record<PPosition, P1P10EventItem> | readonly P1P10EventItem[];
  /** Callback when user seeks to a timestamp. */
  onSeek: (timeSeconds: number) => void;
  /** Whether controls are disabled. */
  disabled?: boolean;
}

export function P1P10TimelineScrubber({
  duration,
  currentTime,
  events,
  onSeek,
  disabled = false,
}: P1P10TimelineScrubberProps) {
  const safeDuration = Math.max(0.1, duration);
  const trackWidthRef = useRef<number>(0);
  const [trackWidth, setTrackWidth] = useState<number>(0);

  // Parse events into normalized list with valid timestamps
  const eventList = useMemo(() => {
    if (!events) return [];
    const items: P1P10EventItem[] = Array.isArray(events)
      ? (events as P1P10EventItem[])
      : POSITIONS.map((p) => (events as Record<PPosition, P1P10EventItem>)[p]).filter(Boolean);

    return items
      .filter((e) => e.timestampMs !== null && typeof e.timestampMs === 'number' && e.status !== 'ABSTAIN')
      .map((e) => ({
        ...e,
        timeSec: (e.timestampMs as number) / 1000,
        percent: Math.max(0, Math.min(100, (((e.timestampMs as number) / 1000) / safeDuration) * 100)),
      }));
  }, [events, safeDuration]);

  const currentPercent = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      trackWidthRef.current = width;
      setTrackWidth(width);
    }
  };

  const calculateSeekTimeFromEvent = (e: GestureResponderEvent): number => {
    const width = trackWidthRef.current;
    if (width <= 0) return 0;
    const locationX = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, locationX / width));
    return ratio * safeDuration;
  };

  const handleTrackPress = (e: GestureResponderEvent) => {
    if (disabled) return;
    const targetTime = calculateSeekTimeFromEvent(e);
    onSeek(Number(targetTime.toFixed(2)));
  };

  return (
    <View style={styles.container}>
      {/* Top Labels: Current / Total */}
      <View style={styles.labelRow}>
        <Text style={styles.timeLabel}>{currentTime.toFixed(2)}s</Text>
        <Text style={styles.timeLabelTotal}>{safeDuration.toFixed(2)}s</Text>
      </View>

      {/* Scrubber Area */}
      <View
        style={styles.trackContainer}
        onLayout={handleTrackLayout}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={handleTrackPress}
        onResponderMove={handleTrackPress}
      >
        {/* Background Track */}
        <View style={styles.trackBackground} />

        {/* Elapsed Progress Fill */}
        <View style={[styles.trackProgress, { width: `${currentPercent}%` }]} />

        {/* Event Marker Pins along the Track */}
        {eventList.map((evt) => {
          const isProxy = evt.status === 'DETECTED_PROXY';
          const isNear = Math.abs(currentTime - evt.timeSec) < 0.15;

          return (
            <TouchableOpacity
              key={evt.position}
              style={[
                styles.pinContainer,
                { left: `${evt.percent}%` },
                isNear && styles.pinContainerActive,
              ]}
              onPress={() => onSeek(evt.timeSec)}
              activeOpacity={0.8}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              {/* Pin Indicator */}
              <View
                style={[
                  styles.pinDot,
                  isProxy ? styles.pinDotProxy : styles.pinDotExact,
                  isNear && styles.pinDotActive,
                ]}
              />
              {/* Position Tag Label */}
              <View
                style={[
                  styles.pinBadge,
                  isProxy ? styles.pinBadgeProxy : styles.pinBadgeExact,
                  isNear && styles.pinBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.pinBadgeText,
                    isProxy ? styles.pinBadgeTextProxy : styles.pinBadgeTextExact,
                    isNear && styles.pinBadgeTextActive,
                  ]}
                >
                  {evt.position}
                  {isProxy ? '*' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Playhead Thumb */}
        <View
          style={[
            styles.playheadThumb,
            { left: `${currentPercent}%` },
          ]}
        />
      </View>

      {/* Legend below the track */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.accent }]} />
          <Text style={styles.legendText}>Exakt kroppsposition</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>* Ärlig rörelseproxy</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  timeLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLORS.accent,
    fontVariant: ['tabular-nums'],
  },
  timeLabelTotal: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  trackContainer: {
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 6,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 3,
    width: '100%',
  },
  trackProgress: {
    position: 'absolute',
    left: 0,
    height: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  pinContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  pinContainerActive: {
    zIndex: 10,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pinDotExact: {
    backgroundColor: COLORS.accent,
  },
  pinDotProxy: {
    backgroundColor: COLORS.warning,
  },
  pinDotActive: {
    transform: [{ scale: 1.4 }],
    borderColor: '#000000',
  },
  pinBadge: {
    position: 'absolute',
    bottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  pinBadgeExact: {
    backgroundColor: '#ECFDF5',
    borderColor: COLORS.accent,
  },
  pinBadgeProxy: {
    backgroundColor: '#FFFBEB',
    borderColor: COLORS.warning,
  },
  pinBadgeActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  pinBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  pinBadgeTextExact: {
    color: '#065F46',
  },
  pinBadgeTextProxy: {
    color: '#92400E',
  },
  pinBadgeTextActive: {
    color: '#FFFFFF',
  },
  playheadThumb: {
    position: 'absolute',
    top: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.accent,
    borderWidth: 3,
    marginLeft: -10,
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: COLORS.textTertiary,
  },
});
