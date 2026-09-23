/**
 * syntheticSeries.test.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Synthetic time-series tests according to Section 11.2:
 * 1. Waggle rejection (waggle in address is not mistaken for takeaway)
 * 2. Pause at top (P4 stays at the last frame before downswing after a pause)
 * 3. Wrist identity swap (abstains with WRIST_IDENTITY_UNSTABLE or abstention across swap)
 */

import { P1P10EventDetector } from '@/features/events/p1p10/P1P10EventDetector';
import { generateSyntheticSwing } from './testHelpers';

describe('MediaPipe P1–P10 Synthetic Time-Series Tests (Section 11.2)', () => {
  const detector = new P1P10EventDetector();

  test('does not treat a waggle as takeaway', () => {
    // Generate swing with waggle of 0.03 S that returns to address
    const { frames, keyTimes, context } = generateSyntheticSwing({
      fps: 120,
      waggle: {
        displacementS: 0.03,
        durationMs: 250,
        returnsToAddress: true,
      },
    });

    const result = detector.detect(frames, context);

    expect(result.events.P1.status).not.toBe('ABSTAIN');
    const p1Ms = result.events.P1.timestampMs!;

    // P1 must be placed AFTER the waggle, right before genuine takeaway:
    expect(p1Ms).toBeGreaterThanOrEqual(keyTimes.addressEndMs - 100);
  });

  test('keeps top at the last frame before downswing after a pause', () => {
    // Swing with 180 ms pause at the top (Matsuyama style)
    const { frames, keyTimes, context } = generateSyntheticSwing({
      fps: 120,
      pauseAtTopMs: 180,
    });

    const result = detector.detect(frames, context);
    expect(result.events.P4.status).not.toBe('ABSTAIN');
    const p4Ms = result.events.P4.timestampMs!;

    // P4 should be near the end of the pause, right at the start of downswing:
    const frameDurationMs = 1000 / context.nominalFps;
    const diffToDownswing = Math.abs(p4Ms - keyTimes.downswingStartMs);
    expect(diffToDownswing).toBeLessThanOrEqual(frameDurationMs * 4);
  });

  test('abstains or flags across a wrist identity swap around P5', () => {
    // Swing with injected wrist swap around P5 for 90 ms
    const { frames, context } = generateSyntheticSwing({
      fps: 120,
      injectIdentitySwap: {
        around: 'P5',
        durationMs: 90,
      },
    });

    const result = detector.detect(frames, context);
    expect(result.events.P5.status).toBe('ABSTAIN');
    expect(result.events.P5.reasonCode).toBe('WRIST_IDENTITY_UNSTABLE');
  });

  test('enforces strict monotonic ordering P1 < P2 < ... < P10', () => {
    const { frames, context } = generateSyntheticSwing({ fps: 120 });
    const result = detector.detect(frames, context);

    const detected = result.orderedEvents.filter(e => e.status !== 'ABSTAIN');
    expect(detected.length).toBeGreaterThanOrEqual(4);

    for (let i = 1; i < detected.length; i++) {
      expect(detected[i].timestampMs!).toBeGreaterThan(detected[i - 1].timestampMs!);
    }
  });
});
