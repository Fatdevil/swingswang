/**
 * timelineAdapter.test.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Tests for P1P10TimelineAdapter:
 * - Conversion of PoseTimeline (both 33 MediaPipe and 17 COCO landmarks)
 * - Mapping to 8-event canonical contract
 * - Preservation of P1–P10 events and trace
 * - Integration with downstream metrics (tempo, extractSwingWindow)
 */

import {
  P1P10TimelineAdapter,
  mapCocoToMediaPipe33,
  timelineToP1P10Frames,
  p1p10ToSwingEventResult,
} from '@/features/events/p1p10/timelineAdapter';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { PoseFrame } from '@/types/pose';
import { LandmarkID, PoseLandmark } from '@/types/landmarks';
import { SwingConfig } from '@/types/swing';
import { MockPoseEngine } from '@/features/pose/MockPoseEngine';
import { extractSwingWindow } from '@/features/metrics/swingWindow';
import { createDefaultRegistry } from '@/features/metrics/defaultRegistry';
import { generateSyntheticSwing } from './testHelpers';
import { PoseFrame as P1P10PoseFrame } from '@/features/events/p1p10/types';

describe('P1P10TimelineAdapter', () => {
  const defaultConfig: SwingConfig = {
    cameraView: 'FO',
    handedness: 'RIGHT',
    club: 'DRIVER',
  };

  describe('mapCocoToMediaPipe33', () => {
    it('correctly maps 17 COCO landmarks to 33 MediaPipe positions', () => {
      const cocoMap = new Map<LandmarkID, PoseLandmark>();
      cocoMap.set(LandmarkID.nose, { id: LandmarkID.nose, x: 0.5, y: 0.2, confidence: 0.9, visibility: 0.9 });
      cocoMap.set(LandmarkID.leftWrist, { id: LandmarkID.leftWrist, x: 0.4, y: 0.6, confidence: 0.85, visibility: 0.85 });
      cocoMap.set(LandmarkID.rightWrist, { id: LandmarkID.rightWrist, x: 0.6, y: 0.6, confidence: 0.85, visibility: 0.85 });
      cocoMap.set(LandmarkID.leftAnkle, { id: LandmarkID.leftAnkle, x: 0.45, y: 0.9, confidence: 0.95, visibility: 0.95 });
      cocoMap.set(LandmarkID.rightAnkle, { id: LandmarkID.rightAnkle, x: 0.55, y: 0.9, confidence: 0.95, visibility: 0.95 });

      const mp33 = mapCocoToMediaPipe33(cocoMap);
      expect(mp33.length).toBe(33);

      // Nose mapped to 0
      expect(mp33[0].x).toBe(0.5);
      expect(mp33[0].y).toBe(0.2);

      // Left wrist mapped to 15, and pinky/index/thumb mirror left wrist (17, 19, 21)
      expect(mp33[15].x).toBe(0.4);
      expect(mp33[17].x).toBe(0.4);
      expect(mp33[19].x).toBe(0.4);
      expect(mp33[21].x).toBe(0.4);

      // Left ankle mapped to 27, and heel/foot_index mirror left ankle (29, 31)
      expect(mp33[27].x).toBe(0.45);
      expect(mp33[29].x).toBe(0.45);
      expect(mp33[31].x).toBe(0.45);
    });
  });

  describe('timelineToP1P10Frames', () => {
    it('uses stabilized COCO-17 landmarks via mapCocoToMediaPipe33 even when extendedLandmarks exist', () => {
      const dummy33 = Array.from({ length: 33 }, (_, i) => ({
        x: 0.1 * (i % 10),
        y: 0.05 * i,
        z: 0.01,
        visibility: 0.9,
        presence: 0.95,
      }));

      // Create a landmarks map with COCO-17 data
      const cocoMap = new Map<LandmarkID, PoseLandmark>();
      cocoMap.set(LandmarkID.nose, { id: LandmarkID.nose, x: 0.5, y: 0.2, confidence: 0.9, visibility: 0.9 });
      cocoMap.set(LandmarkID.leftShoulder, { id: LandmarkID.leftShoulder, x: 0.44, y: 0.35, confidence: 0.95, visibility: 0.95 });

      const frame: PoseFrame = {
        timestamp: 0.5,
        frameIndex: 0,
        landmarks: cocoMap,
        averageConfidence: 0.9,
        detectedCount: 33,
        missingCount: 0,
        sourceWidth: 1080,
        sourceHeight: 1920,
        processingTimeMs: 15,
        extendedLandmarks: dummy33,
      };

      const timeline = new PoseTimeline([frame], 1, 15, 30);
      const p1p10Frames = timelineToP1P10Frames(timeline, {
        view: 'FACE_ON',
        handedness: 'RIGHT',
        mode: 'VIDEO',
        nominalFps: 30,
      });

      expect(p1p10Frames.length).toBe(1);
      expect(p1p10Frames[0].timestampUs).toBe(500000);
      expect(p1p10Frames[0].image.length).toBe(33);
      // Should use COCO landmarks (nose at x=0.5), NOT extendedLandmarks (index 0 at x=0.0)
      expect(p1p10Frames[0].image[0].x).toBe(0.5);
    });
  });

  describe('Synthetic normative swing through adapter', () => {
    it('produces valid 8-event result and preserves P1–P10 trace', () => {
      const synthetic = generateSyntheticSwing({
        fps: 120,
        addressDurationMs: 400,
        backswingDurationMs: 800,
        downswingDurationMs: 280,
        followThroughDurationMs: 600,
      });

      // Convert synthetic P1P10 PoseFrames to PoseTimeline
      // Build COCO-17 landmarks map from 33-point MediaPipe data
      const MP33_TO_COCO: [number, LandmarkID][] = [
        [0, LandmarkID.nose],
        [2, LandmarkID.leftEye],
        [5, LandmarkID.rightEye],
        [7, LandmarkID.leftEar],
        [8, LandmarkID.rightEar],
        [11, LandmarkID.leftShoulder],
        [12, LandmarkID.rightShoulder],
        [13, LandmarkID.leftElbow],
        [14, LandmarkID.rightElbow],
        [15, LandmarkID.leftWrist],
        [16, LandmarkID.rightWrist],
        [23, LandmarkID.leftHip],
        [24, LandmarkID.rightHip],
        [25, LandmarkID.leftKnee],
        [26, LandmarkID.rightKnee],
        [27, LandmarkID.leftAnkle],
        [28, LandmarkID.rightAnkle],
      ];

      const poseFrames: PoseFrame[] = synthetic.frames.map((sf: P1P10PoseFrame, idx: number) => {
        const cocoMap = new Map<LandmarkID, PoseLandmark>();
        for (const [mp33Idx, cocoId] of MP33_TO_COCO) {
          const lm = sf.image[mp33Idx];
          cocoMap.set(cocoId, {
            id: cocoId,
            x: lm.x,
            y: lm.y,
            confidence: lm.visibility ?? 0.95,
            visibility: lm.visibility ?? 0.95,
          });
        }
        return {
          timestamp: sf.timestampUs / 1_000_000,
          frameIndex: idx,
          landmarks: cocoMap,
          averageConfidence: 0.95,
          detectedCount: 17,
          missingCount: 0,
          sourceWidth: 1080,
          sourceHeight: 1920,
          processingTimeMs: 10,
          extendedLandmarks: sf.image.map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility,
            presence: lm.presence ?? 1.0,
           })),
        };
      });

      const timeline = new PoseTimeline(poseFrames, poseFrames.length, 100, 120);
      const adapter = new P1P10TimelineAdapter();
      const result = adapter.detect(timeline, defaultConfig);

      // Check legacy 8-event contract
      expect(result.events.length).toBe(8);
      expect(result.temporalOrderValid).toBe(true);
      expect(result.detectedCount).toBeGreaterThanOrEqual(4);

      // Check ADDRESS and TOP
      const address = result.events.find((e) => e.event === 'ADDRESS');
      const top = result.events.find((e) => e.event === 'TOP');
      const impact = result.events.find((e) => e.event === 'IMPACT_PROXY');
      const finish = result.events.find((e) => e.event === 'FINISH');

      expect(address?.status).toBe('RELIABLE');
      expect(top?.status).toBe('RELIABLE');
      expect(impact?.status).toBe('RELIABLE');
      expect(finish?.status).toBe('RELIABLE');

      expect(address!.frameIndex!).toBeLessThan(top!.frameIndex!);
      expect(top!.frameIndex!).toBeLessThan(impact!.frameIndex!);
      expect(impact!.frameIndex!).toBeLessThan(finish!.frameIndex!);

      // Check P1–P10 metadata
      expect(result.p1p10Result).toBeDefined();
      expect(result.p1p10Events).toBeDefined();
      expect(result.p1p10Trace).toBeDefined();
      expect(result.p1p10Result.sequenceUsable).toBe(true);

      // Verify extractSwingWindow works seamlessly
      const windowInfo = extractSwingWindow(timeline, result);
      expect(windowInfo.hasEvents).toBe(true);
      expect(windowInfo.addressFrameIndex).toBe(address!.frameIndex);
      expect(windowInfo.finishFrameIndex).toBe(finish!.frameIndex);
      expect(windowInfo.windowFrames.length).toBeGreaterThan(0);
    });
  });

  describe('MockPoseEngine synthetic swing through adapter', () => {
    it('processes MockPoseEngine output cleanly', async () => {
      const engine = new MockPoseEngine();
      await engine.initialize();

      const fps = 30;
      const durationSec = 3.0;
      const totalFrames = Math.round(fps * durationSec);
      const frames: PoseFrame[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const t = i / fps;
        const f = await engine.analyzeFrame('file://mock.jpg', t, i);
        if (f) frames.push(f);
      }

      const timeline = new PoseTimeline(frames, totalFrames, 100, fps);
      const adapter = new P1P10TimelineAdapter();
      const result = adapter.detect(timeline, defaultConfig);

      expect(result.events.length).toBe(8);
      expect(result.temporalOrderValid).toBe(true);

      // Test downstream metric calculation with registry
      const registry = createDefaultRegistry();
      const metrics = registry.calculateAvailable(timeline, defaultConfig, result);

      expect(metrics.has('tempo')).toBe(true);
      const tempo = metrics.get('tempo');
      expect(tempo?.value).toBeDefined();
      expect(metrics.has('pelvisSway')).toBe(true);
      expect(metrics.has('headMovement')).toBe(true);
    });
  });

  describe('Empty and short timeline handling', () => {
    it('handles empty timeline gracefully', () => {
      const timeline = new PoseTimeline([], 0, 0, 30);
      const adapter = new P1P10TimelineAdapter();
      const result = adapter.detect(timeline, defaultConfig);

      expect(result.events.length).toBe(8);
      expect(result.detectedCount).toBe(0);
      expect(result.reliableCount).toBe(0);
      expect(result.temporalOrderValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('handles short timeline (< 5 frames) gracefully', () => {
      const dummyFrame: PoseFrame = {
        timestamp: 0.1,
        frameIndex: 0,
        landmarks: new Map(),
        averageConfidence: 0.9,
        detectedCount: 0,
        missingCount: 17,
        sourceWidth: 1080,
        sourceHeight: 1920,
        processingTimeMs: 10,
      };
      const timeline = new PoseTimeline([dummyFrame, dummyFrame], 2, 20, 30);
      const adapter = new P1P10TimelineAdapter();
      const result = adapter.detect(timeline, defaultConfig);

      expect(result.events.length).toBe(8);
      expect(result.detectedCount).toBe(0);
      expect(result.warnings[0]).toContain('fewer than 5 frames');
    });
  });

  describe('Slow-Motion (120/240 FPS) and Left-Handed Swing Handling', () => {
    it('detects events in a 365-frame slow-motion swing over 24.4 seconds', () => {
      const totalFrames = 365;
      const frames: PoseFrame[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const t = (i / totalFrames) * 24.4; // 0..24.4s
        const cocoMap = new Map<LandmarkID, PoseLandmark>();

        // Synthesize kinematic arc across 365 frames:
        // Address: 0..50
        // Top: ~210
        // Impact: ~270
        // Finish: ~350
        let wristY = 0.65;
        let wristX = 0.50;
        if (i < 50) {
          wristY = 0.65;
        } else if (i <= 210) {
          const prog = (i - 50) / 160;
          wristY = 0.65 - prog * 0.45; // up to 0.20
          wristX = 0.50 - prog * 0.25;
        } else if (i <= 270) {
          const prog = (i - 210) / 60;
          wristY = 0.20 + prog * 0.48; // down to 0.68
          wristX = 0.25 + prog * 0.26;
        } else {
          const prog = (i - 270) / 95;
          wristY = 0.68 - prog * 0.40;
          wristX = 0.51 + prog * 0.24;
        }

        cocoMap.set(LandmarkID.nose, { id: LandmarkID.nose, x: 0.50, y: 0.20, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftShoulder, { id: LandmarkID.leftShoulder, x: 0.44, y: 0.35, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightShoulder, { id: LandmarkID.rightShoulder, x: 0.56, y: 0.35, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftHip, { id: LandmarkID.leftHip, x: 0.46, y: 0.65, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightHip, { id: LandmarkID.rightHip, x: 0.54, y: 0.65, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftAnkle, { id: LandmarkID.leftAnkle, x: 0.46, y: 0.95, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightAnkle, { id: LandmarkID.rightAnkle, x: 0.54, y: 0.95, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftElbow, { id: LandmarkID.leftElbow, x: (0.44 + wristX) / 2, y: (0.35 + wristY) / 2, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightElbow, { id: LandmarkID.rightElbow, x: (0.56 + wristX) / 2, y: (0.35 + wristY) / 2, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftWrist, { id: LandmarkID.leftWrist, x: wristX, y: wristY, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightWrist, { id: LandmarkID.rightWrist, x: wristX + 0.02, y: wristY, confidence: 0.95, visibility: 0.95 });

        frames.push({
          timestamp: t,
          frameIndex: i,
          landmarks: cocoMap,
          averageConfidence: 0.95,
          detectedCount: 17,
          missingCount: 0,
          sourceWidth: 1080,
          sourceHeight: 1920,
          processingTimeMs: 5,
        });
      }

      const timeline = new PoseTimeline(frames, totalFrames, 100, 120);
      const adapter = new P1P10TimelineAdapter();
      const result = adapter.detect(timeline, defaultConfig);

      expect(result.detectedCount).toBeGreaterThanOrEqual(4);
      expect(result.events.find(e => e.event === 'TOP')?.frameIndex).toBeDefined();
      expect(result.events.find(e => e.event === 'IMPACT_PROXY')?.frameIndex).toBeDefined();
    });

    it('detects events for a left-handed golfer in slow-motion', () => {
      const totalFrames = 365;
      const frames: PoseFrame[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const t = (i / totalFrames) * 24.4;
        const cocoMap = new Map<LandmarkID, PoseLandmark>();

        let wristY = 0.65;
        let wristX = 0.50;
        if (i < 50) {
          wristY = 0.65;
        } else if (i <= 210) {
          const prog = (i - 50) / 160;
          wristY = 0.65 - prog * 0.45;
          wristX = 0.50 + prog * 0.25; // Moves to the right for lefties
        } else if (i <= 270) {
          const prog = (i - 210) / 60;
          wristY = 0.20 + prog * 0.48;
          wristX = 0.75 - prog * 0.26;
        } else {
          const prog = (i - 270) / 95;
          wristY = 0.68 - prog * 0.40;
          wristX = 0.49 - prog * 0.24;
        }

        cocoMap.set(LandmarkID.nose, { id: LandmarkID.nose, x: 0.50, y: 0.20, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftShoulder, { id: LandmarkID.leftShoulder, x: 0.44, y: 0.35, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightShoulder, { id: LandmarkID.rightShoulder, x: 0.56, y: 0.35, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftHip, { id: LandmarkID.leftHip, x: 0.46, y: 0.65, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightHip, { id: LandmarkID.rightHip, x: 0.54, y: 0.65, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftAnkle, { id: LandmarkID.leftAnkle, x: 0.46, y: 0.95, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightAnkle, { id: LandmarkID.rightAnkle, x: 0.54, y: 0.95, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftElbow, { id: LandmarkID.leftElbow, x: (0.44 + wristX) / 2, y: (0.35 + wristY) / 2, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightElbow, { id: LandmarkID.rightElbow, x: (0.56 + wristX) / 2, y: (0.35 + wristY) / 2, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.leftWrist, { id: LandmarkID.leftWrist, x: wristX - 0.02, y: wristY, confidence: 0.95, visibility: 0.95 });
        cocoMap.set(LandmarkID.rightWrist, { id: LandmarkID.rightWrist, x: wristX, y: wristY, confidence: 0.95, visibility: 0.95 });

        frames.push({
          timestamp: t,
          frameIndex: i,
          landmarks: cocoMap,
          averageConfidence: 0.95,
          detectedCount: 17,
          missingCount: 0,
          sourceWidth: 1080,
          sourceHeight: 1920,
          processingTimeMs: 5,
        });
      }

      const timeline = new PoseTimeline(frames, totalFrames, 100, 120);
      const adapter = new P1P10TimelineAdapter();
      const leftConfig: SwingConfig = { cameraView: 'FO', handedness: 'LEFT', club: 'DRIVER' };
      const result = adapter.detect(timeline, leftConfig);

      expect(result.detectedCount).toBeGreaterThanOrEqual(4);
      expect(result.events.find(e => e.event === 'TOP')?.frameIndex).toBeDefined();
    });
  });
});
