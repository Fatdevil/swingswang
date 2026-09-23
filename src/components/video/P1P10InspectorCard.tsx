/**
 * P1P10InspectorCard.tsx
 * SwingSwang – MediaPipe P1–P10 Video Player
 *
 * Detailed inspector card providing full transparency and honest proxy
 * disclosures for the active or selected P-position.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '@/constants/theme';
import { PPosition } from '@/features/events/p1p10/types';
import { P1P10_SWEDISH_NAMES } from './P1P10PositionSelector';
import { P1P10EventItem } from './P1P10TimelineScrubber';

/** Normative descriptions for each P-position. */
const POSITION_DESCRIPTIONS: Record<PPosition, string> = {
  P1: 'Sista stabila uppställningsbilden före takeaway. Stabil kropp och stilla grepp före ihållande rörelsestart.',
  P2: 'Skaftet parallellt med marken i baksvingen. Beräknas som rörelseproxy från handledshöjd och rörelseriktning.',
  P3: 'Lead arm (främre arm) parallell med marken i baksvingen. Lead shoulder till lead wrist är nära horisontell.',
  P4: 'Toppen och vändningen mellan bak- och nedsving. Greppbanans högsta punkt och vändning, hanterar pauser vid toppen.',
  P5: 'Lead arm (främre arm) parallell med marken i nedsvingen under snabb accelerationsfas.',
  P6: 'Skaftet parallellt med marken i nedsvingen (Delivery position). Beräknas som rörelseproxy.',
  P7: 'Bollträff. Ren kroppsposering identifierar lägsta greppunkt och maximal armacceleration som träffproxy.',
  P8: 'Skaftet parallellt med marken efter träff (Exit position). Beräknas som rörelseproxy.',
  P9: 'Trail arm (bakre arm) parallell med marken i genomsvingen. Trail shoulder till trail wrist är horisontell.',
  P10: 'Avslut (Finish). Första stabila slutläget efter full genomsving.',
};

export interface P1P10InspectorCardProps {
  position: PPosition;
  event?: P1P10EventItem | null;
  onClose?: () => void;
}

export function P1P10InspectorCard({ position, event }: P1P10InspectorCardProps) {
  const info = P1P10_SWEDISH_NAMES[position];
  const description = POSITION_DESCRIPTIONS[position];

  const isProxy = event?.status === 'DETECTED_PROXY';
  const isAbstained = !event || event.status === 'ABSTAIN';
  const isExact = event?.status === 'DETECTED_EXACT';

  const timeSec = event && event.timestampMs !== null ? event.timestampMs / 1000 : null;
  const quality = typeof event?.qualityScore === 'number' ? Math.round(event.qualityScore * 100) : null;
  const reasonCode = (event as any)?.reasonCode;

  return (
    <View style={[styles.card, isProxy && styles.cardProxy, isAbstained && styles.cardAbstained]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.positionBadge}>{position}</Text>
          <View>
            <Text style={styles.titleText}>{info.title}</Text>
            <Text style={styles.subtitleText}>{info.subtitle}</Text>
          </View>
        </View>

        {isProxy ? (
          <View style={styles.proxyBadge}>
            <Text style={styles.proxyBadgeText}>⚡ RÖRELSEPROXY</Text>
          </View>
        ) : isAbstained ? (
          <View style={styles.abstainedBadge}>
            <Text style={styles.abstainedBadgeText}>AVSTOD</Text>
          </View>
        ) : (
          <View style={styles.exactBadge}>
            <Text style={styles.exactBadgeText}>✓ EXAKT POSERING</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={styles.descriptionText}>{description}</Text>

      {/* Stats row */}
      {!isAbstained && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TIDPUNKT</Text>
            <Text style={styles.statValue}>{timeSec !== null ? `${timeSec.toFixed(2)}s` : '—'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>KVALITETSBETYG</Text>
            <Text style={styles.statValue}>{quality !== null ? `${quality}%` : '—'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>STATUS</Text>
            <Text style={styles.statValue}>{isProxy ? 'Proxy (cap)' : 'Exakt'}</Text>
          </View>
        </View>
      )}

      {/* Honest Proxy Disclosure Banner */}
      {isProxy && (
        <View style={styles.proxyNotice}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <Text style={styles.noticeText}>
            MediaPipe 33-kroppsmodellen spårar inte klubbskaft eller bollkontakt. Denna position är en ärlig rörelseproxy baserad på kroppens rörelsemönster och kvalitetsbetyget är maxbegränsat till 55 %.
          </Text>
        </View>
      )}

      {/* Abstention Explanation */}
      {isAbstained && (
        <View style={styles.abstainNotice}>
          <Text style={styles.noticeIcon}>🛡️</Text>
          <View style={styles.abstainTextContainer}>
            <Text style={styles.abstainTitle}>
              Position ej bekräftad {reasonCode ? `(${reasonCode})` : ''}
            </Text>
            <Text style={styles.abstainDescription}>
              Algoritmen avstod från att fabricera en tidstämpel för denna position eftersom de strikta geometriska och temporala kvalitetsvillkoren inte uppfylldes.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  cardProxy: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  cardAbstained: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  positionBadge: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold as any,
    color: '#000000',
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  titleText: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLORS.textPrimary,
  },
  subtitleText: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  exactBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exactBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: '#065F46',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  proxyBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proxyBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: '#92400E',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  abstainedBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  abstainedBadgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  descriptionText: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginVertical: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLORS.textPrimary,
  },
  proxyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: SPACING.xs,
    borderRadius: 6,
    marginTop: SPACING.xs,
  },
  abstainNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    padding: SPACING.xs,
    borderRadius: 6,
    marginTop: SPACING.xs,
  },
  noticeIcon: {
    fontSize: 12,
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: '#92400E',
    lineHeight: 14,
  },
  abstainTextContainer: {
    flex: 1,
  },
  abstainTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLORS.textSecondary,
    marginBottom: 1,
  },
  abstainDescription: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: COLORS.textTertiary,
    lineHeight: 13,
  },
});
