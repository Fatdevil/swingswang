/**
 * p1p10Robustness.test.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification
 *
 * Robustness tests covering:
 * 1. Realistic MediaPipe pose jitter (~0.6%) across multiple frame rates (30, 60, 120 FPS).
 * 2. Untrimmed video with pre-shot waggle / routine before actual swing.
 * 3. Media timestamp mapping for slow-motion playback synchronization.
 */

import { P1P10EventDetector } from '@/features/events/p1p10/P1P10EventDetector';
import { P1P10TimelineAdapter } from '@/features/events/p1p10/timelineAdapter';
import { generateSyntheticSwing } from './testHelpers';
import { LANDMARK_INDEX, PoseFrame, CaptureContext } from '@/features/events/p1p10/types';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { PoseFrame as CorePoseFrame } from '@/types/pose';
import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import { SwingConfig } from '@/types/swing';

describe('P1–P10 Robustness & Real-World Video Conditions', () => {
  const detector = new P1P10EventDetector();

  describe('Realistic MediaPipe Pose Jitter (~0.6%)', () => {
    const fpsList = [30, 60, 120];

    for (const fps of fpsList) {
      it(`reliably detects address and sequence usable at ${fps} FPS with 0.6% jitter`, () => {
        const { frames: cleanFrames, context } = generateSyntheticSwing({
          fps,
          addressDurationMs: 400,
          backswingDurationMs: 700,
          downswingDurationMs: 250,
          followThroughDurationMs: 400,
          finishDurationMs: 400,
        });

        // Inject pseudo-random deterministic jitter (+-0.006) on landmarks
        const noisyFrames: PoseFrame[] = cleanFrames.map((f, fIdx) => {
          const noisyImage = f.image.map((lm, lmIdx) => {
            // Deterministic sinusoidal pseudo-jitter based on frame and landmark
            const jitterX = Math.sin(fIdx * 13 + lmIdx * 7) * 0.006;
            const jitterY = Math.cos(fIdx * 17 + lmIdx * 11) * 0.006;
            return {
              ...lm,
              x: Math.max(0, Math.min(1, lm.x + jitterX)),
              y: Math.max(0, Math.min(1, lm.y + jitterY)),
            };
          });

          return {
            ...f,
            image: noisyImage,
          };
        });

        const result = detector.detect(noisyFrames, context);

        expect(result.events.P1.status).not.toBe('ABSTAIN');
        expect(result.events.P4.status).not.toBe('ABSTAIN');
        expect(result.sequenceUsable).toBe(true);
      });
    }
  });

  describe('Untrimmed Video with Pre-shot Waggle / Routine', () => {
    it('anchors to the real swing and does not trigger on early pre-shot waggle', () => {
      const fps = 60;
      const { frames: swingFrames, context } = generateSyntheticSwing({
        fps,
        addressDurationMs: 400,
        backswingDurationMs: 700,
        downswingDurationMs: 250,
      });

      // Prepend 3.0 seconds of pre-shot activity:
      // 0-1.5s: setup stillness, 1.5-2.2s: waggle, 2.2-3.0s: stillness settling into address
      const preShotFramesCount = Math.round(3.0 * fps);
      const preShotFrames: PoseFrame[] = [];
      const baseFrame = swingFrames[0];

      for (let i = 0; i < preShotFramesCount; i++) {
        const tSec = i / fps;
        let waggleOffset = 0;
        if (tSec >= 1.5 && tSec <= 2.2) {
          // Waggle hands back and forth
          waggleOffset = Math.sin((tSec - 1.5) * Math.PI * 4) * 0.05;
        }

        const modifiedImage = baseFrame.image.map((lm, idx) => {
          if (idx === LANDMARK_INDEX.LEFT_WRIST || idx === LANDMARK_INDEX.RIGHT_WRIST) {
            return { ...lm, x: lm.x + waggleOffset };
          }
          return lm;
        });

        preShotFrames.push({
          frameIndex: i,
          timestampUs: Math.round(tSec * 1_000_000),
          image: modifiedImage,
          world: baseFrame.world,
          sourceSizePx: baseFrame.sourceSizePx,
          rotationAppliedDeg: 0,
          inputWasMirrored: false,
        });
      }

      // Re-index swing frames to continue after pre-shot frames
      const combinedFrames: PoseFrame[] = [
        ...preShotFrames,
        ...swingFrames.map((f, idx) => ({
          ...f,
          frameIndex: preShotFramesCount + idx,
          timestampUs: Math.round((3.0 + idx / fps) * 1_000_000),
        })),
      ];

      const result = detector.detect(combinedFrames, context);

      expect(result.events.P1.status).not.toBe('ABSTAIN');
      // P1 should be at the settle address window around ~3.0s, NOT at the 0.0-1.0s window
      const p1TimeSec = (result.events.P1.timestampMs ?? 0) / 1000;
      expect(p1TimeSec).toBeGreaterThanOrEqual(2.2);

      // Top P4 should be detected correctly during the real backswing
      expect(result.events.P4.status).not.toBe('ABSTAIN');
      const p4TimeSec = (result.events.P4.timestampMs ?? 0) / 1000;
      expect(p4TimeSec).toBeGreaterThan(p1TimeSec);
    });
  });

  describe('Media Timestamp Synchronization in Timeline Adapter', () => {
    it('populates mediaTimestampMs matching media timestamps for video player sync', () => {
      const adapter = new P1P10TimelineAdapter();
      const totalFrames = 60;
      const coreFrames: CorePoseFrame[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const tSec = i * 0.05; // 20 FPS in media file
        const lmMap = new Map<LandmarkID, PoseLandmark>();

        // Minimal setup for swing
        const wristY = i < 15 ? 0.65 : i < 35 ? 0.65 - ((i - 15) / 20) * 0.45 : 0.20 + ((i - 35) / 25) * 0.45;
        lmMap.set(LandmarkID.nose, { id: LandmarkID.nose, x: 0.5, y: 0.2, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.leftShoulder, { id: LandmarkID.leftShoulder, x: 0.45, y: 0.35, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.rightShoulder, { id: LandmarkID.rightShoulder, x: 0.55, y: 0.35, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.leftHip, { id: LandmarkID.leftHip, x: 0.46, y: 0.65, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.rightHip, { id: LandmarkID.rightHip, x: 0.54, y: 0.65, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.leftAnkle, { id: LandmarkID.leftAnkle, x: 0.46, y: 0.95, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.rightAnkle, { id: LandmarkID.rightAnkle, x: 0.54, y: 0.95, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.leftWrist, { id: LandmarkID.leftWrist, x: 0.48, y: wristY, confidence: 0.95, visibility: 0.95 });
        lmMap.set(LandmarkID.rightWrist, { id: LandmarkID.rightWrist, x: 0.52, y: wristY, confidence: 0.95, visibility: 0.95 });

        coreFrames.push({
          timestamp: tSec,
          realTimestamp: tSec / 4.0, // Retimed 4x slow-mo
          frameIndex: i,
          landmarks: lmMap,
          averageConfidence: 0.95,
          detectedCount: 9,
          missingCount: 8,
          sourceWidth: 1080,
          sourceHeight: 1920,
          processingTimeMs: 1,
        });
      }

      const timeline = new PoseTimeline(coreFrames, totalFrames, 100, 20);
      const config: SwingConfig = { cameraView: 'FO', handedness: 'RIGHT', club: 'DRIVER' };
      const result = adapter.detect(timeline, config);

      // Verify that for all detected P-positions, mediaTimestampMs is populated and matches frame media timestamp
      for (const pos of ['P1', 'P4'] as const) {
        const evt = result.p1p10Events[pos];
        if (evt && evt.status !== 'ABSTAIN' && evt.frameIndex !== null) {
          expect(evt.mediaTimestampMs).toBeDefined();
          const expectedMediaMs = Math.round(coreFrames[evt.frameIndex].timestamp * 1000);
          expect(evt.mediaTimestampMs).toBe(expectedMediaMs);
          // And physical timestampMs should be realTimestamp
          const expectedRealMs = Math.round((coreFrames[evt.frameIndex].realTimestamp ?? 0) * 1000);
          expect(evt.timestampMs).toBe(expectedRealMs);
        }
      }
    });
  });
});
