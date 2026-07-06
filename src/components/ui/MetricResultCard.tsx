/**
 * MetricResultCard.tsx
 * SwingSwang
 *
 * Displays a single MetricResult with expandable details.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MetricResult, reliabilityColor, reliabilityLabel, ReliabilityStatus } from '../../types/metrics';
import { Card } from './Card';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../constants/theme';

interface MetricResultCardProps {
  result: MetricResult;
}

export function MetricResultCard({ result }: MetricResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = reliabilityColor(result.status);

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{result.name}</Text>
          <Badge
            text={reliabilityLabel(result.status)}
            color={statusColor}
            textColor={result.status === ReliabilityStatus.Reliable ? '#000000' : '#FFFFFF'}
          />
        </View>
        <TouchableOpacity onPress={() => setExpanded(!expanded)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        {result.normalizedValue !== null ? (
          <>
            <Text style={styles.value}>
              {result.normalizedValue.toFixed(3)}
            </Text>
            <Text style={styles.unit}>{result.unit}</Text>
          </>
        ) : (
          <Text style={styles.noValue}>Cannot measure</Text>
        )}
      </View>

      {/* Confidence bar */}
      <ProgressBar
        progress={result.confidence}
        label="Confidence"
        color={statusColor}
        style={styles.confidenceBar}
      />

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          {result.warnings.map((w, i) => (
            <View key={i} style={styles.warningRow}>
              <Ionicons name="warning" size={12} color={COLORS.warning} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Expanded details */}
      {expanded && (
        <View style={styles.details}>
          {/* Calculation explanation */}
          <Text style={styles.sectionTitle}>How it's calculated</Text>
          <Text style={styles.explanation}>{result.calculationExplanation}</Text>

          {/* Raw value */}
          {result.rawValue !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Raw value:</Text>
              <Text style={styles.detailValue}>{result.rawValue.toFixed(4)}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Frames used:</Text>
            <Text style={styles.detailValue}>{result.framesUsed}</Text>
          </View>

          {/* Limitations */}
          {result.limitations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Limitations</Text>
              {result.limitations.map((l, i) => (
                <Text key={i} style={styles.limitation}>• {l}</Text>
              ))}
            </>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold as any,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  value: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold as any,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
  noValue: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.lg,
    fontStyle: 'italic',
  },
  confidenceBar: {
    marginTop: SPACING.md,
  },
  warningsContainer: {
    marginTop: SPACING.sm,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    flex: 1,
  },
  details: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold as any,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  explanation: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  detailLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
  detailValue: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontVariant: ['tabular-nums'],
  },
  limitation: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
    marginTop: 2,
  },
});
