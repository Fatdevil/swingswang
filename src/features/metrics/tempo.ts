/**
 * tempo.ts
 * SwingSwang – Metrics
 *
 * Swing tempo metric — backswing-to-downswing duration ratio.
 *
 * With events: ADDRESS→TOP / TOP→IMPACT_PROXY
 * Without events: fallback estimation from wrist velocity peaks.
 *
 * Ideal ratio ≈ 3:1 for most golfers (PROVISIONAL).
 */

import { LandmarkID } from '@/types/landmarks';
import { SwingConfig } from '@/types/swing';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingEventResult } from '@/features/events/types';
import {
  MetricRegistryEntry,
  MetricResultV1,
  statusFromConfidence,
  notReliableResultV1,
} from './registry';
import { calculateConfidence } from '@/features/confidence/ConfidenceEngine';
import { distance, Point2D } from '@/utils/geometry';
import { roundTo } from '@/utils/math';
import { Logger } from '@/utils/logger';

const METRIC_ID = 'tempo';
const METRIC_NAME = 'Swing Tempo';
const METRIC_VERSION = '1.0.0';
const SUPPORTED_VIEW: readonly ('DTL' | 'FO')[] = ['DTL', 'FO'];

const REQUIRED_LANDMARKS: readonly LandmarkID[] = [
  LandmarkID.leftWrist,
  LandmarkID.rightWrist,
  LandmarkID.leftShoulder,
  LandmarkID.rightShoulder,
];

/** Minimum frames required for a meaningful tempo analysis. */
const MIN_FRAMES = 8; // PROVISIONAL

/** Calculate tempo metric. */
function calculateTempo(
  timeline: PoseTimeline,
  config: SwingConfig,
  events?: SwingEventResult,
): MetricResultV1 {
  const reliableFrames = timeline.reliableFrames;

  if (reliableFrames.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      `Not enough reliable frames (${reliableFrames.length} < ${MIN_FRAMES}).`,
      'BOTH',
      METRIC_VERSION,
    );
  }

  // ── Try event-based calculation first ──
  if (events && events.detectedCount > 0) {
    const addressEvent = events.events.find(e => e.event === 'ADDRESS' && e.timestampMs !== null);
    const topEvent = events.events.find(e => e.event === 'TOP' && e.timestampMs !== null);
    const impactEvent = events.events.find(e => e.event === 'IMPACT_PROXY' && e.timestampMs !== null);

    if (
      addressEvent?.timestampMs !== undefined && addressEvent.timestampMs !== null &&
      topEvent?.timestampMs !== undefined && topEvent.timestampMs !== null &&
      impactEvent?.timestampMs !== undefined && impactEvent.timestampMs !== null
    ) {
      const addressTime = addressEvent.timestampMs / 1000;
      const topTime = topEvent.timestampMs / 1000;
      const impactTime = impactEvent.timestampMs / 1000;
      const backswingDuration = topTime - addressTime;
      const downswingDuration = impactTime - topTime;

      if (backswingDuration > 0 && downswingDuration > 0) {
        const ratio = backswingDuration / downswingDuration;
        const confidence = calculateEventBasedConfidence(
          timeline,
          events,
          backswingDuration,
          downswingDuration,
        );

        Logger.metrics.info('Tempo calculated (event-based)', {
          backswingMs: roundTo(backswingDuration * 1000, 0),
          downswingMs: roundTo(downswingDuration * 1000, 0),
          ratio: roundTo(ratio, 2),
          confidence: roundTo(confidence, 3),
        });

        return {
          id: METRIC_ID,
          name: METRIC_NAME,
          value: roundTo(ratio, 2),
          normalizedValue: roundTo(ratio, 2),
          unit: 'ratio',
          confidence,
          status: statusFromConfidence(confidence),
          supportedView: 'BOTH',
          warnings: [],
          evidence: {
            method: 'event_based',
            backswingDurationMs: roundTo(backswingDuration * 1000, 0),
            downswingDurationMs: roundTo(downswingDuration * 1000, 0),
            addressTimestamp: roundTo(addressTime, 3),
            topTimestamp: roundTo(topTime, 3),
            impactTimestamp: roundTo(impactTime, 3),
          },
          calculationExplanation:
            `Tempo ratio calculated from swing events: ` +
            `backswing ${roundTo(backswingDuration * 1000, 0)}ms / ` +
            `downswing ${roundTo(downswingDuration * 1000, 0)}ms = ` +
            `${roundTo(ratio, 2)}:1. Ideal is approximately 3:1.`,
          limitations: [
            'Event timestamps depend on event detection accuracy.',
            'Ideal 3:1 ratio is a general guideline; individual tempo varies.',
            'Frame rate limits temporal resolution of timing.',
          ],
          framesUsed: reliableFrames.length,
          version: METRIC_VERSION,
        };
      }
    }
  }

  // ── Fallback: estimate from wrist velocity ──
  return calculateTempoFromVelocity(timeline, config);
}

/** Fallback tempo estimation using wrist velocity patterns. */
function calculateTempoFromVelocity(
  timeline: PoseTimeline,
  config: SwingConfig,
): MetricResultV1 {
  const frames = timeline.reliableFrames;

  // Track wrist midpoint velocity across frames
  const wristPositions: { timestamp: number; point: Point2D }[] = [];

  for (const frame of frames) {
    const lw = frame.landmarks.get(LandmarkID.leftWrist);
    const rw = frame.landmarks.get(LandmarkID.rightWrist);
    if (!lw || !rw || lw.confidence < 0.3 || rw.confidence < 0.3) continue;

    wristPositions.push({
      timestamp: frame.timestamp,
      point: { x: (lw.x + rw.x) / 2, y: (lw.y + rw.y) / 2 },
    });
  }

  if (wristPositions.length < MIN_FRAMES) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Not enough wrist data for velocity-based tempo estimation.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Calculate frame-to-frame velocities
  const velocities: { timestamp: number; velocity: number }[] = [];
  for (let i = 1; i < wristPositions.length; i++) {
    const dt = wristPositions[i].timestamp - wristPositions[i - 1].timestamp;
    if (dt <= 0) continue;
    const d = distance(wristPositions[i].point, wristPositions[i - 1].point);
    velocities.push({
      timestamp: (wristPositions[i].timestamp + wristPositions[i - 1].timestamp) / 2,
      velocity: d / dt,
    });
  }

  if (velocities.length < 4) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Not enough velocity samples for tempo estimation.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Find the velocity minimum (≈ top of backswing) and maximum (≈ impact)
  let minVelIdx = 0;
  let maxVelIdx = 0;

  // Skip first 20% of frames (address region)
  const startIdx = Math.floor(velocities.length * 0.2);

  for (let i = startIdx; i < velocities.length; i++) {
    if (velocities[i].velocity < velocities[minVelIdx].velocity) {
      minVelIdx = i;
    }
  }

  // Find max velocity after the minimum (downswing → impact)
  maxVelIdx = minVelIdx;
  for (let i = minVelIdx; i < velocities.length; i++) {
    if (velocities[i].velocity > velocities[maxVelIdx].velocity) {
      maxVelIdx = i;
    }
  }

  if (maxVelIdx <= minVelIdx || minVelIdx <= startIdx) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Cannot identify clear backswing/downswing phases from wrist velocity.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  // Estimate durations
  const backswingDuration = velocities[minVelIdx].timestamp - velocities[startIdx].timestamp;
  const downswingDuration = velocities[maxVelIdx].timestamp - velocities[minVelIdx].timestamp;

  if (backswingDuration <= 0 || downswingDuration <= 0) {
    return notReliableResultV1(
      METRIC_ID,
      METRIC_NAME,
      'Estimated phase durations are not valid.',
      'BOTH',
      METRIC_VERSION,
    );
  }

  const ratio = backswingDuration / downswingDuration;

  // Lower confidence for velocity-based fallback
  const confResult = calculateConfidence(timeline, [...REQUIRED_LANDMARKS], []);
  const baseConfidence = confResult.composite;
  const confidence = Math.max(0, baseConfidence * 0.6); // PROVISIONAL: 60% of base for fallback

  const warnings = [
    'Tempo estimated from wrist velocity patterns (no swing events available).',
    ...confResult.warnings,
  ];

  Logger.metrics.info('Tempo calculated (velocity fallback)', {
    backswingMs: roundTo(backswingDuration * 1000, 0),
    downswingMs: roundTo(downswingDuration * 1000, 0),
    ratio: roundTo(ratio, 2),
    confidence: roundTo(confidence, 3),
  });

  return {
    id: METRIC_ID,
    name: METRIC_NAME,
    value: roundTo(ratio, 2),
    normalizedValue: roundTo(ratio, 2),
    unit: 'ratio',
    confidence,
    status: statusFromConfidence(confidence),
    supportedView: 'BOTH',
    warnings,
    evidence: {
      method: 'velocity_fallback',
      backswingDurationMs: roundTo(backswingDuration * 1000, 0),
      downswingDurationMs: roundTo(downswingDuration * 1000, 0),
      velocitySamples: velocities.length,
      minVelocityIdx: minVelIdx,
      maxVelocityIdx: maxVelIdx,
    },
    calculationExplanation:
      `Tempo estimated from wrist velocity patterns. ` +
      `Estimated backswing ${roundTo(backswingDuration * 1000, 0)}ms / ` +
      `downswing ${roundTo(downswingDuration * 1000, 0)}ms = ` +
      `${roundTo(ratio, 2)}:1. This is a rough approximation.`,
    limitations: [
      'Velocity-based estimation is less accurate than event-based.',
      'Wrist velocity patterns may not clearly show phase transitions.',
      '2D velocity from monocular camera only.',
      'Frame rate limits temporal resolution.',
    ],
    framesUsed: frames.length,
    version: METRIC_VERSION,
  };
}

/** Calculate confidence for event-based tempo. */
function calculateEventBasedConfidence(
  timeline: PoseTimeline,
  events: SwingEventResult,
  _backswingDuration: number,
  _downswingDuration: number,
): number {
  // Base confidence from event detection quality
  let confidence = 0.8; // PROVISIONAL base for event-based

  // Penalize if timeline is very short
  if (timeline.reliableFrameCount < 15) {
    confidence *= 0.7;
  }

  // Penalize if average pose confidence is low
  if (timeline.averageConfidence < 0.6) {
    confidence *= 0.8;
  }

  return Math.min(Math.max(confidence, 0), 1);
}

/** Registry entry for the tempo metric. */
export const tempoMetric: MetricRegistryEntry = {
  id: METRIC_ID,
  displayName: METRIC_NAME,
  version: METRIC_VERSION,
  supportedViews: SUPPORTED_VIEW,
  requiredLandmarks: REQUIRED_LANDMARKS,
  requiredConfidence: 0.4,
  calculate: calculateTempo,
};
