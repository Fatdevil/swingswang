/**
 * confidence.test.ts
 * SwingSwang
 *
 * Tests for confidence engine and composite confidence.
 */

import {
  compositeConfidence,
  confidenceWarnings,
  reliabilityFromConfidence,
  ReliabilityStatus,
  ConfidenceFactors,
} from '../src/types/metrics';

// ─── reliabilityFromConfidence ──────────────────────────────────────

describe('reliabilityFromConfidence', () => {
  it('returns Reliable for >= 0.7', () => {
    expect(reliabilityFromConfidence(0.7)).toBe(ReliabilityStatus.Reliable);
    expect(reliabilityFromConfidence(0.95)).toBe(ReliabilityStatus.Reliable);
    expect(reliabilityFromConfidence(1.0)).toBe(ReliabilityStatus.Reliable);
  });

  it('returns Marginal for 0.4–0.69', () => {
    expect(reliabilityFromConfidence(0.4)).toBe(ReliabilityStatus.Marginal);
    expect(reliabilityFromConfidence(0.55)).toBe(ReliabilityStatus.Marginal);
    expect(reliabilityFromConfidence(0.69)).toBe(ReliabilityStatus.Marginal);
  });

  it('returns NotReliable for < 0.4', () => {
    expect(reliabilityFromConfidence(0.0)).toBe(ReliabilityStatus.NotReliable);
    expect(reliabilityFromConfidence(0.2)).toBe(ReliabilityStatus.NotReliable);
    expect(reliabilityFromConfidence(0.39)).toBe(ReliabilityStatus.NotReliable);
  });
});

// ─── compositeConfidence ────────────────────────────────────────────

describe('compositeConfidence', () => {
  const perfectFactors: ConfidenceFactors = {
    landmarkVisibility: 1.0,
    poseConfidence: 1.0,
    temporalCoverage: 1.0,
    temporalStability: 1.0,
    normalizerReliability: 1.0,
    golferSizeInFrame: 1.0,
  };

  const zeroFactors: ConfidenceFactors = {
    landmarkVisibility: 0,
    poseConfidence: 0,
    temporalCoverage: 0,
    temporalStability: 0,
    normalizerReliability: 0,
    golferSizeInFrame: 0,
  };

  it('returns 1.0 for perfect factors', () => {
    expect(compositeConfidence(perfectFactors)).toBe(1.0);
  });

  it('returns 0.0 for zero factors', () => {
    expect(compositeConfidence(zeroFactors)).toBe(0.0);
  });

  it('returns value between 0 and 1', () => {
    const mixed: ConfidenceFactors = {
      landmarkVisibility: 0.8,
      poseConfidence: 0.9,
      temporalCoverage: 0.7,
      temporalStability: 0.6,
      normalizerReliability: 0.5,
      golferSizeInFrame: 0.3,
    };
    const result = compositeConfidence(mixed);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('clamps result to 0–1 range', () => {
    // Even with weird inputs, should stay in range
    const weird: ConfidenceFactors = {
      landmarkVisibility: 1.5,
      poseConfidence: 1.5,
      temporalCoverage: 1.5,
      temporalStability: 1.5,
      normalizerReliability: 1.5,
      golferSizeInFrame: 1.5,
    };
    expect(compositeConfidence(weird)).toBeLessThanOrEqual(1.0);
  });

  it('weights landmarkVisibility and poseConfidence highest', () => {
    // Only landmarkVisibility and poseConfidence are high
    const highPriority: ConfidenceFactors = {
      landmarkVisibility: 1.0,
      poseConfidence: 1.0,
      temporalCoverage: 0,
      temporalStability: 0,
      normalizerReliability: 0,
      golferSizeInFrame: 0,
    };

    // Only low-priority factors are high
    const lowPriority: ConfidenceFactors = {
      landmarkVisibility: 0,
      poseConfidence: 0,
      temporalCoverage: 0,
      temporalStability: 0,
      normalizerReliability: 1.0,
      golferSizeInFrame: 1.0,
    };

    expect(compositeConfidence(highPriority)).toBeGreaterThan(compositeConfidence(lowPriority));
  });
});

// ─── confidenceWarnings ─────────────────────────────────────────────

describe('confidenceWarnings', () => {
  it('returns no warnings for perfect factors', () => {
    const perfect: ConfidenceFactors = {
      landmarkVisibility: 1.0,
      poseConfidence: 1.0,
      temporalCoverage: 1.0,
      temporalStability: 1.0,
      normalizerReliability: 1.0,
      golferSizeInFrame: 1.0,
    };
    expect(confidenceWarnings(perfect)).toHaveLength(0);
  });

  it('warns about low landmark visibility', () => {
    const factors: ConfidenceFactors = {
      landmarkVisibility: 0.3,
      poseConfidence: 0.9,
      temporalCoverage: 0.9,
      temporalStability: 0.9,
      normalizerReliability: 0.9,
      golferSizeInFrame: 0.5,
    };
    const warnings = confidenceWarnings(factors);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('landmarks'))).toBe(true);
  });

  it('warns about small golfer in frame', () => {
    const factors: ConfidenceFactors = {
      landmarkVisibility: 0.9,
      poseConfidence: 0.9,
      temporalCoverage: 0.9,
      temporalStability: 0.9,
      normalizerReliability: 0.9,
      golferSizeInFrame: 0.05,
    };
    const warnings = confidenceWarnings(factors);
    expect(warnings.some(w => w.includes('small'))).toBe(true);
  });

  it('warns about unstable landmarks', () => {
    const factors: ConfidenceFactors = {
      landmarkVisibility: 0.9,
      poseConfidence: 0.9,
      temporalCoverage: 0.9,
      temporalStability: 0.3,
      normalizerReliability: 0.9,
      golferSizeInFrame: 0.5,
    };
    const warnings = confidenceWarnings(factors);
    expect(warnings.some(w => w.includes('unstable') || w.includes('jitter'))).toBe(true);
  });

  it('returns multiple warnings for multiple issues', () => {
    const bad: ConfidenceFactors = {
      landmarkVisibility: 0.2,
      poseConfidence: 0.3,
      temporalCoverage: 0.3,
      temporalStability: 0.2,
      normalizerReliability: 0.3,
      golferSizeInFrame: 0.05,
    };
    const warnings = confidenceWarnings(bad);
    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });
});
