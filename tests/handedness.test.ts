/**
 * handedness.test.ts
 * SwingSwang
 *
 * Comprehensive tests for handedness utility functions.
 */

import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import {
  getLeadLandmarkId,
  getTrailLandmarkId,
  getLeadShoulder,
  getTrailShoulder,
  getLeadHip,
  getTrailHip,
  getLeadKnee,
  getTrailKnee,
  getLeadWrist,
  getTrailWrist,
  getLeadElbow,
  getTrailElbow,
  getLeadAnkle,
  getTrailAnkle,
} from '@/utils/handedness';
import { createTestPoseFrame } from './helpers/poseFixtures';

// ─── Helper ─────────────────────────────────────────────────────────

function getLandmarks(): ReadonlyMap<LandmarkID, PoseLandmark> {
  return createTestPoseFrame(0, 0).landmarks;
}

function getEmptyLandmarks(): ReadonlyMap<LandmarkID, PoseLandmark> {
  return new Map();
}

// ─── getLeadLandmarkId / getTrailLandmarkId ─────────────────────────

describe('getLeadLandmarkId', () => {
  it('RIGHT-handed → returns left landmark ID', () => {
    expect(getLeadLandmarkId('RIGHT', LandmarkID.leftShoulder, LandmarkID.rightShoulder))
      .toBe(LandmarkID.leftShoulder);
  });

  it('LEFT-handed → returns right landmark ID', () => {
    expect(getLeadLandmarkId('LEFT', LandmarkID.leftShoulder, LandmarkID.rightShoulder))
      .toBe(LandmarkID.rightShoulder);
  });
});

describe('getTrailLandmarkId', () => {
  it('RIGHT-handed → returns right landmark ID', () => {
    expect(getTrailLandmarkId('RIGHT', LandmarkID.leftShoulder, LandmarkID.rightShoulder))
      .toBe(LandmarkID.rightShoulder);
  });

  it('LEFT-handed → returns left landmark ID', () => {
    expect(getTrailLandmarkId('LEFT', LandmarkID.leftShoulder, LandmarkID.rightShoulder))
      .toBe(LandmarkID.leftShoulder);
  });
});

// ─── Shoulder ───────────────────────────────────────────────────────

describe('Shoulder handedness', () => {
  it('RIGHT-handed: lead shoulder = left shoulder', () => {
    const lm = getLandmarks();
    const lead = getLeadShoulder('RIGHT', lm);
    expect(lead).toBeDefined();
    expect(lead!.id).toBe(LandmarkID.leftShoulder);
  });

  it('RIGHT-handed: trail shoulder = right shoulder', () => {
    const lm = getLandmarks();
    const trail = getTrailShoulder('RIGHT', lm);
    expect(trail).toBeDefined();
    expect(trail!.id).toBe(LandmarkID.rightShoulder);
  });

  it('LEFT-handed: lead shoulder = right shoulder', () => {
    const lm = getLandmarks();
    const lead = getLeadShoulder('LEFT', lm);
    expect(lead).toBeDefined();
    expect(lead!.id).toBe(LandmarkID.rightShoulder);
  });

  it('LEFT-handed: trail shoulder = left shoulder', () => {
    const lm = getLandmarks();
    const trail = getTrailShoulder('LEFT', lm);
    expect(trail).toBeDefined();
    expect(trail!.id).toBe(LandmarkID.leftShoulder);
  });

  it('returns undefined when shoulder not in map', () => {
    const lm = getEmptyLandmarks();
    expect(getLeadShoulder('RIGHT', lm)).toBeUndefined();
    expect(getTrailShoulder('RIGHT', lm)).toBeUndefined();
  });
});

// ─── Hip ────────────────────────────────────────────────────────────

describe('Hip handedness', () => {
  it('RIGHT-handed: lead hip = left hip', () => {
    const lead = getLeadHip('RIGHT', getLandmarks());
    expect(lead).toBeDefined();
    expect(lead!.id).toBe(LandmarkID.leftHip);
  });

  it('RIGHT-handed: trail hip = right hip', () => {
    const trail = getTrailHip('RIGHT', getLandmarks());
    expect(trail).toBeDefined();
    expect(trail!.id).toBe(LandmarkID.rightHip);
  });

  it('LEFT-handed: lead hip = right hip', () => {
    const lead = getLeadHip('LEFT', getLandmarks());
    expect(lead).toBeDefined();
    expect(lead!.id).toBe(LandmarkID.rightHip);
  });

  it('LEFT-handed: trail hip = left hip', () => {
    const trail = getTrailHip('LEFT', getLandmarks());
    expect(trail).toBeDefined();
    expect(trail!.id).toBe(LandmarkID.leftHip);
  });

  it('returns undefined when hip not in map', () => {
    expect(getLeadHip('RIGHT', getEmptyLandmarks())).toBeUndefined();
    expect(getTrailHip('LEFT', getEmptyLandmarks())).toBeUndefined();
  });
});

// ─── Knee ───────────────────────────────────────────────────────────

describe('Knee handedness', () => {
  it('RIGHT-handed: lead knee = left knee', () => {
    const lead = getLeadKnee('RIGHT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.leftKnee);
  });

  it('RIGHT-handed: trail knee = right knee', () => {
    const trail = getTrailKnee('RIGHT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.rightKnee);
  });

  it('LEFT-handed: lead knee = right knee', () => {
    const lead = getLeadKnee('LEFT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.rightKnee);
  });

  it('LEFT-handed: trail knee = left knee', () => {
    const trail = getTrailKnee('LEFT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.leftKnee);
  });

  it('returns undefined when knee not in map', () => {
    expect(getLeadKnee('RIGHT', getEmptyLandmarks())).toBeUndefined();
  });
});

// ─── Wrist ──────────────────────────────────────────────────────────

describe('Wrist handedness', () => {
  it('RIGHT-handed: lead wrist = left wrist', () => {
    const lead = getLeadWrist('RIGHT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.leftWrist);
  });

  it('RIGHT-handed: trail wrist = right wrist', () => {
    const trail = getTrailWrist('RIGHT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.rightWrist);
  });

  it('LEFT-handed: lead wrist = right wrist', () => {
    const lead = getLeadWrist('LEFT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.rightWrist);
  });

  it('LEFT-handed: trail wrist = left wrist', () => {
    const trail = getTrailWrist('LEFT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.leftWrist);
  });

  it('returns undefined when wrist not in map', () => {
    expect(getLeadWrist('LEFT', getEmptyLandmarks())).toBeUndefined();
  });
});

// ─── Elbow ──────────────────────────────────────────────────────────

describe('Elbow handedness', () => {
  it('RIGHT-handed: lead elbow = left elbow', () => {
    const lead = getLeadElbow('RIGHT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.leftElbow);
  });

  it('RIGHT-handed: trail elbow = right elbow', () => {
    const trail = getTrailElbow('RIGHT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.rightElbow);
  });

  it('LEFT-handed: lead elbow = right elbow', () => {
    const lead = getLeadElbow('LEFT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.rightElbow);
  });

  it('LEFT-handed: trail elbow = left elbow', () => {
    const trail = getTrailElbow('LEFT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.leftElbow);
  });

  it('returns undefined when elbow not in map', () => {
    expect(getTrailElbow('RIGHT', getEmptyLandmarks())).toBeUndefined();
  });
});

// ─── Ankle ──────────────────────────────────────────────────────────

describe('Ankle handedness', () => {
  it('RIGHT-handed: lead ankle = left ankle', () => {
    const lead = getLeadAnkle('RIGHT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.leftAnkle);
  });

  it('RIGHT-handed: trail ankle = right ankle', () => {
    const trail = getTrailAnkle('RIGHT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.rightAnkle);
  });

  it('LEFT-handed: lead ankle = right ankle', () => {
    const lead = getLeadAnkle('LEFT', getLandmarks());
    expect(lead!.id).toBe(LandmarkID.rightAnkle);
  });

  it('LEFT-handed: trail ankle = left ankle', () => {
    const trail = getTrailAnkle('LEFT', getLandmarks());
    expect(trail!.id).toBe(LandmarkID.leftAnkle);
  });

  it('returns undefined when ankle not in map', () => {
    expect(getLeadAnkle('LEFT', getEmptyLandmarks())).toBeUndefined();
  });
});
