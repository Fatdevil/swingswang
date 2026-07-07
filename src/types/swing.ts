/**
 * swing.ts
 * SwingSwang
 *
 * Core swing configuration types for pre-analysis setup.
 */

/** Camera view angle for swing analysis */
export type CameraView = 'DTL' | 'FO';

/** Golfer handedness */
export type GolferHandedness = 'RIGHT' | 'LEFT';

/** Club type categories */
export type ClubType =
  | 'DRIVER'
  | 'FAIRWAY_WOOD'
  | 'HYBRID'
  | 'LONG_IRON'
  | 'MID_IRON'
  | 'SHORT_IRON'
  | 'WEDGE'
  | 'OTHER';

/** Pre-analysis swing configuration */
export interface SwingConfig {
  readonly cameraView: CameraView;
  readonly handedness: GolferHandedness;
  readonly club: ClubType;
}

/** Display names for camera views */
export const CAMERA_VIEW_LABELS: Record<CameraView, string> = {
  DTL: 'Down the Line',
  FO: 'Face On',
};

/** Display names for club types */
export const CLUB_TYPE_LABELS: Record<ClubType, string> = {
  DRIVER: 'Driver',
  FAIRWAY_WOOD: 'Fairway Wood',
  HYBRID: 'Hybrid',
  LONG_IRON: 'Long Iron',
  MID_IRON: 'Mid Iron',
  SHORT_IRON: 'Short Iron',
  WEDGE: 'Wedge',
  OTHER: 'Other',
};
