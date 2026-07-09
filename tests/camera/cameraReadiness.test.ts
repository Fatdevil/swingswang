/**
 * cameraReadiness.test.ts
 * SwingSwang
 *
 * Unit tests verifying golfer detector readiness classification logic.
 */

import { evaluateCameraSnapshot, CameraReadinessResult } from '@/features/camera/cameraReadiness';
import { PoseFrame } from '@/types/pose';
import { LandmarkID, PoseLandmark } from '@/types/landmarks';

describe('evaluateCameraSnapshot', () => {
  const createMockFrame = (
    landmarksList: Partial<PoseLandmark>[],
    avgConfidence = 0.8
  ): PoseFrame => {
    const landmarks = new Map<LandmarkID, PoseLandmark>();
    landmarksList.forEach((lm) => {
      if (lm.id !== undefined) {
        landmarks.set(lm.id, {
          id: lm.id,
          x: lm.x ?? 0.5,
          y: lm.y ?? 0.5,
          visibility: lm.visibility ?? 0.8,
          confidence: lm.confidence ?? 0.8,
        });
      }
    });

    return {
      timestamp: 0,
      frameIndex: 0,
      landmarks,
      averageConfidence: avgConfidence,
      detectedCount: landmarks.size,
      missingCount: 17 - landmarks.size,
      sourceWidth: 640,
      sourceHeight: 480,
      processingTimeMs: 10,
    };
  };

  it('classifies null or empty frames as SEARCHING', () => {
    const resNull = evaluateCameraSnapshot(null, 'FO');
    expect(resNull.status).toBe('SEARCHING');
    expect(resNull.color).toBe('red');

    const resEmpty = evaluateCameraSnapshot(createMockFrame([]), 'FO');
    expect(resEmpty.status).toBe('SEARCHING');
    expect(resEmpty.color).toBe('red');
  });

  it('classifies low average confidence as LOW_CONFIDENCE', () => {
    const frame = createMockFrame([{ id: LandmarkID.nose }], 0.5);
    const res = evaluateCameraSnapshot(frame, 'FO');
    expect(res.status).toBe('LOW_CONFIDENCE');
    expect(res.color).toBe('yellow');
  });

  it('classifies missing shoulders or hips as PARTIAL_BODY', () => {
    const frameMissingHips = createMockFrame([
      { id: LandmarkID.leftShoulder, x: 0.4, y: 0.2 },
      { id: LandmarkID.rightShoulder, x: 0.6, y: 0.2 },
      // missing hips
      { id: LandmarkID.leftKnee, x: 0.4, y: 0.6 },
      { id: LandmarkID.rightKnee, x: 0.6, y: 0.6 },
      { id: LandmarkID.leftAnkle, x: 0.4, y: 0.8 },
      { id: LandmarkID.rightAnkle, x: 0.6, y: 0.8 },
    ]);

    const res = evaluateCameraSnapshot(frameMissingHips, 'FO');
    expect(res.status).toBe('PARTIAL_BODY');
    expect(res.color).toBe('orange');
    expect(res.subtext).toContain('shoulders and hips');
  });

  it('classifies missing feet or knees as PARTIAL_BODY', () => {
    const frameMissingAnkles = createMockFrame([
      { id: LandmarkID.leftShoulder, x: 0.4, y: 0.2 },
      { id: LandmarkID.rightShoulder, x: 0.6, y: 0.2 },
      { id: LandmarkID.leftHip, x: 0.4, y: 0.4 },
      { id: LandmarkID.rightHip, x: 0.6, y: 0.4 },
      { id: LandmarkID.leftKnee, x: 0.4, y: 0.6 },
      { id: LandmarkID.rightKnee, x: 0.6, y: 0.6 },
      // missing ankles
    ]);

    const res = evaluateCameraSnapshot(frameMissingAnkles, 'FO');
    expect(res.status).toBe('PARTIAL_BODY');
    expect(res.color).toBe('orange');
    expect(res.subtext).toContain('feet and knees');
  });

  it('classifies small bounding box as TOO_FAR', () => {
    const frameTooFar = createMockFrame([
      { id: LandmarkID.leftShoulder, x: 0.4, y: 0.4 },
      { id: LandmarkID.rightShoulder, x: 0.6, y: 0.4 },
      { id: LandmarkID.leftHip, x: 0.4, y: 0.45 },
      { id: LandmarkID.rightHip, x: 0.6, y: 0.45 },
      { id: LandmarkID.leftKnee, x: 0.4, y: 0.5 },
      { id: LandmarkID.rightKnee, x: 0.6, y: 0.5 },
      { id: LandmarkID.leftAnkle, x: 0.4, y: 0.55 },
      { id: LandmarkID.rightAnkle, x: 0.6, y: 0.55 },
    ]);

    // Height = 0.55 - 0.40 = 0.15 (< 0.3)
    const res = evaluateCameraSnapshot(frameTooFar, 'FO');
    expect(res.status).toBe('TOO_FAR');
    expect(res.color).toBe('orange');
  });

  it('classifies large bounding box or edge boundary proximity as TOO_CLOSE', () => {
    const frameTooClose = createMockFrame([
      { id: LandmarkID.leftShoulder, x: 0.4, y: 0.02 }, // too close to top edge (0.02 < 0.05)
      { id: LandmarkID.rightShoulder, x: 0.6, y: 0.02 },
      { id: LandmarkID.leftHip, x: 0.4, y: 0.4 },
      { id: LandmarkID.rightHip, x: 0.6, y: 0.4 },
      { id: LandmarkID.leftKnee, x: 0.4, y: 0.7 },
      { id: LandmarkID.rightKnee, x: 0.6, y: 0.7 },
      { id: LandmarkID.leftAnkle, x: 0.4, y: 0.96 }, // too close to bottom edge (0.96 > 0.95)
      { id: LandmarkID.rightAnkle, x: 0.6, y: 0.96 },
    ]);

    const res = evaluateCameraSnapshot(frameTooClose, 'FO');
    expect(res.status).toBe('TOO_CLOSE');
    expect(res.color).toBe('orange');
  });

  it('classifies valid full-body pose as READY', () => {
    const frameReady = createMockFrame([
      { id: LandmarkID.leftShoulder, x: 0.4, y: 0.15 },
      { id: LandmarkID.rightShoulder, x: 0.6, y: 0.15 },
      { id: LandmarkID.leftHip, x: 0.4, y: 0.45 },
      { id: LandmarkID.rightHip, x: 0.6, y: 0.45 },
      { id: LandmarkID.leftKnee, x: 0.4, y: 0.65 },
      { id: LandmarkID.rightKnee, x: 0.6, y: 0.65 },
      { id: LandmarkID.leftAnkle, x: 0.4, y: 0.85 },
      { id: LandmarkID.rightAnkle, x: 0.6, y: 0.85 },
    ]);

    // Height = 0.85 - 0.15 = 0.70 (>= 0.3 and <= 0.9, bounds between [0.05, 0.95])
    const res = evaluateCameraSnapshot(frameReady, 'FO');
    expect(res.status).toBe('READY');
    expect(res.color).toBe('green');
  });
});
