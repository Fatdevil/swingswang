/**
 * types.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Core types, data contracts, landmark indices, and result interfaces
 * for the P1–P10 golf swing event detection engine.
 */

export type Vec3 = { x: number; y: number; z: number };

export type Landmark = Vec3 & {
  visibility: number; // [0, 1]
  presence?: number;  // finns i aktuella Tasks-SDK-resultat
};

export type PoseFrame = {
  frameIndex: number;
  timestampUs: number; // källans PTS, inte frameIndex / nominell fps
  image: Landmark[];   // exakt 33, x/y normaliserade
  world: Landmark[];   // exakt 33, meter
  sourceSizePx: { width: number; height: number };
  rotationAppliedDeg: 0 | 90 | 180 | 270;
  inputWasMirrored: boolean;
};

export type CaptureContext = {
  view: 'FACE_ON' | 'DTL';
  handedness: 'LEFT' | 'RIGHT';
  mode: 'VIDEO' | 'LIVE_STREAM';
  nominalFps: number;
};

export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type LandmarkName = keyof typeof LANDMARK_INDEX;

export type EventStatus = 'DETECTED_EXACT' | 'DETECTED_PROXY' | 'ABSTAIN';

export type PPosition =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'P10';

export const POSITIONS: readonly PPosition[] = [
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'P7',
  'P8',
  'P9',
  'P10',
] as const;

export type AbstentionReasonCode =
  | 'NO_STABLE_ADDRESS'
  | 'CLIP_TRUNCATED_START'
  | 'CLIP_TRUNCATED_END'
  | 'NO_TRANSITION'
  | 'LANDMARK_GAP'
  | 'WRIST_IDENTITY_UNSTABLE'
  | 'VIEW_AMBIGUOUS'
  | 'CAMERA_MOVED'
  | 'MULTIPLE_PEOPLE'
  | 'OUT_OF_FRAME'
  | 'FPS_TOO_LOW_FOR_FAST_ZONE'
  | 'NO_CLUB_SIGNAL'
  | 'NO_BALL_CONTACT_SIGNAL'
  | 'ORDER_CONFLICT'
  | 'PARTIAL_SWING'
  | 'NO_BALL_SWING'
  | 'LOW_SCORE'
  | 'AMBIGUOUS_CANDIDATES';

export interface SwingEvent {
  position: PPosition;
  semantic: string; // t.ex. IMPACT_PROXY
  status: EventStatus;
  timestampMs: number | null;
  frameIndex: number | null;
  qualityScore: number | null; // ej kallad probability före kalibrering
  temporalUncertaintyMs: number | null;
  view: 'FACE_ON' | 'DTL';
  evidence: Record<string, number | boolean | string>;
  warnings: string[];
  reasonCode?: AbstentionReasonCode | string;
}

export interface SequenceResult {
  readonly events: Record<PPosition, SwingEvent>;
  readonly orderedEvents: readonly SwingEvent[];
  readonly sequenceUsable: boolean;
  readonly trace: PipelineTrace;
}

export interface PipelineTrace {
  rawFramesCount: number;
  interpolatedGapsCount: number;
  filterParameters: {
    maxGapMs: number;
    sgWindowMs: number;
    sgOrder: number;
    s2D: number;
  };
  phases: {
    hasTakeaway: boolean;
    hasTransition: boolean;
    takeawayTimestampMs?: number;
    transitionTimestampMs?: number;
    reasonCodes?: string[];
  };
  view: 'FACE_ON' | 'DTL';
  handedness: 'LEFT' | 'RIGHT';
  gaps: { startMs: number; endMs: number; durationMs: number; reason: string }[];
  candidateCountsPerPosition: Record<PPosition, number>;
  abstentions: { position: PPosition; reasonCode: string }[];
}

export const POSE_ONLY_MODE_CAPS: Record<PPosition, number> = {
  P1: 0.90,
  P2: 0.55,
  P3: 0.85,
  P4: 0.85,
  P5: 0.85,
  P6: 0.55,
  P7: 0.50,
  P8: 0.55,
  P9: 0.80,
  P10: 0.90,
};

export interface DurationInterval {
  softMin: number;
  softMax: number;
  hardMin: number;
  hardMax: number;
}

export const DURATION_PRIORS: Record<string, DurationInterval> = {
  P1_TO_P4: { softMin: 0.45, softMax: 1.60, hardMin: 0.25, hardMax: 2.50 },
  P4_TO_P7: { softMin: 0.18, softMax: 0.45, hardMin: 0.10, hardMax: 0.70 },
  P7_TO_P10: { softMin: 0.35, softMax: 1.80, hardMin: 0.20, hardMax: 3.00 },
};

export const SEMANTIC_NAMES: Record<PPosition, { exact: string; proxy: string }> = {
  P1: { exact: 'ADDRESS', proxy: 'ADDRESS' },
  P2: { exact: 'SHAFT_PARALLEL_BACKSWING', proxy: 'P2_PROXY' },
  P3: { exact: 'LEAD_ARM_PARALLEL_BACKSWING', proxy: 'LEAD_ARM_PARALLEL_BACKSWING' },
  P4: { exact: 'TOP_TRANSITION', proxy: 'TOP_TRANSITION' },
  P5: { exact: 'LEAD_ARM_PARALLEL_DOWNSWING', proxy: 'LEAD_ARM_PARALLEL_DOWNSWING' },
  P6: { exact: 'SHAFT_PARALLEL_DOWNSWING', proxy: 'P6_PROXY' },
  P7: { exact: 'IMPACT', proxy: 'IMPACT_PROXY' },
  P8: { exact: 'SHAFT_PARALLEL_FOLLOW_THROUGH', proxy: 'P8_PROXY' },
  P9: { exact: 'TRAIL_ARM_PARALLEL_THROUGH', proxy: 'TRAIL_ARM_PARALLEL_THROUGH' },
  P10: { exact: 'FINISH', proxy: 'FINISH' },
};
