/**
 * types.ts
 * SwingSwang – Swing Event Detection
 *
 * Core types for the swing event detection engine.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { SwingConfig } from '@/types/swing';

/** The 8 canonical swing events detected by the engine. */
export type SwingEventType =
  | 'ADDRESS'
  | 'TAKEAWAY'
  | 'MID_BACKSWING'
  | 'TOP'
  | 'MID_DOWNSWING'
  | 'IMPACT_PROXY'
  | 'MID_FOLLOW_THROUGH'
  | 'FINISH';

/** Temporal ordering — ADDRESS must come first, FINISH last. */
export const SWING_EVENT_ORDER: readonly SwingEventType[] = [
  'ADDRESS', 'TAKEAWAY', 'MID_BACKSWING', 'TOP',
  'MID_DOWNSWING', 'IMPACT_PROXY', 'MID_FOLLOW_THROUGH', 'FINISH',
];

/** A single detected swing event with metadata. */
export interface SwingEvent {
  readonly event: SwingEventType;
  readonly timestampMs: number | null;
  readonly frameIndex: number | null;
  readonly confidence: number; // 0-1
  readonly status: 'RELIABLE' | 'NOT_RELIABLE';
  readonly signals: Record<string, number | boolean>;
}

/** Aggregated result of swing event detection. */
export interface SwingEventResult {
  readonly events: readonly SwingEvent[];
  readonly detectedCount: number;
  readonly reliableCount: number;
  readonly temporalOrderValid: boolean;
  readonly warnings: string[];
}

/** Interface for swing event detectors (strategy pattern). */
export interface SwingEventDetector {
  readonly name: string;
  readonly version: string;
  detect(timeline: PoseTimeline, config: SwingConfig): SwingEventResult;
}
