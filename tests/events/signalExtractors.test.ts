/**
 * signalExtractors.test.ts
 * SwingSwang – Tests
 *
 * Tests for signal extraction functions used in swing event detection.
 */

import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import {
  extractHandCenter,
  extractHandVelocity,
  extractHandDirection,
  extractShoulderSpan,
  extractHipLateralPosition,
  extractWristHeight,
} from '@/features/events/signalExtractors';
import { LandmarkID } from '@/types/landmarks';
import { createTestPoseFrame, createTestTimeline } from '../helpers/poseFixtures';

/** Helper: wrap PoseFrames into a PoseTimeline. */
function toTimeline(frames: ReturnType<typeof createTestTimeline>): PoseTimeline {
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

// ─── extractHandCenter ──────────────────────────────────────────────

describe('extractHandCenter', () => {
  it('extracts midpoint of both wrists from known positions', () => {
    const frames = createTestTimeline(3, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.4, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.6, y: 0.5 },
        },
        1: {
          [LandmarkID.leftWrist]: { x: 0.3, y: 0.4 },
          [LandmarkID.rightWrist]: { x: 0.7, y: 0.6 },
        },
        2: {
          [LandmarkID.leftWrist]: { x: 0.5, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.5, y: 0.5 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const centers = extractHandCenter(timeline);

    expect(centers).toHaveLength(3);
    expect(centers[0].x).toBeCloseTo(0.5);
    expect(centers[0].y).toBeCloseTo(0.5);
    expect(centers[1].x).toBeCloseTo(0.5);
    expect(centers[1].y).toBeCloseTo(0.5);
    expect(centers[2].x).toBeCloseTo(0.5);
    expect(centers[2].y).toBeCloseTo(0.5);
  });

  it('returns NaN when a wrist is missing', () => {
    const frames = createTestTimeline(2, {
      excludeLandmarksPerFrame: {
        0: [LandmarkID.leftWrist],
      },
    });
    const timeline = toTimeline(frames);
    const centers = extractHandCenter(timeline);

    expect(centers[0].x).toBeNaN();
    expect(centers[0].y).toBeNaN();
    expect(centers[0].confidence).toBe(0);
    // Frame 1 should be fine
    expect(centers[1].x).not.toBeNaN();
  });

  it('handles empty timeline', () => {
    const timeline = toTimeline([]);
    const centers = extractHandCenter(timeline);
    expect(centers).toHaveLength(0);
  });
});

// ─── extractHandVelocity ────────────────────────────────────────────

describe('extractHandVelocity', () => {
  it('returns zero velocity for stationary frames', () => {
    // Use default positions — all frames identical
    const frames = createTestTimeline(5);
    const timeline = toTimeline(frames);
    const velocities = extractHandVelocity(timeline);

    expect(velocities).toHaveLength(5);
    expect(velocities[0]).toBe(0); // first frame always 0
    for (let i = 1; i < 5; i++) {
      expect(velocities[i]).toBeCloseTo(0);
    }
  });

  it('returns positive velocity for moving frames', () => {
    const frames = createTestTimeline(3, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.4, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.6, y: 0.5 },
        },
        1: {
          [LandmarkID.leftWrist]: { x: 0.5, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.7, y: 0.5 },
        },
        2: {
          [LandmarkID.leftWrist]: { x: 0.6, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.8, y: 0.5 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const velocities = extractHandVelocity(timeline);

    expect(velocities[0]).toBe(0);
    expect(velocities[1]).toBeGreaterThan(0);
    expect(velocities[2]).toBeGreaterThan(0);
  });

  it('returns NaN when landmarks are missing', () => {
    const frames = createTestTimeline(3, {
      excludeLandmarksPerFrame: {
        1: [LandmarkID.leftWrist],
      },
    });
    const timeline = toTimeline(frames);
    const velocities = extractHandVelocity(timeline);

    // Frame 1 has missing wrist → velocity from 0→1 is NaN
    expect(velocities[1]).toBeNaN();
    // Frame 2 also NaN because previous frame (1) has missing wrist
    expect(velocities[2]).toBeNaN();
  });

  it('handles empty timeline', () => {
    const timeline = toTimeline([]);
    expect(extractHandVelocity(timeline)).toHaveLength(0);
  });
});

// ─── extractHandDirection ───────────────────────────────────────────

describe('extractHandDirection', () => {
  it('correctly identifies movement toward target for RIGHT-handed golfer', () => {
    // RIGHT-handed: target is to the LEFT (lower X)
    // Moving left (decreasing X) = toward target = positive direction
    const frames = createTestTimeline(3, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.5, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.6, y: 0.5 },
        },
        1: {
          [LandmarkID.leftWrist]: { x: 0.4, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.5, y: 0.5 },
        },
        2: {
          [LandmarkID.leftWrist]: { x: 0.3, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.4, y: 0.5 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const directions = extractHandDirection(timeline, 'RIGHT');

    expect(directions[0]).toBe(0);
    expect(directions[1]).toBeGreaterThan(0); // toward target
    expect(directions[2]).toBeGreaterThan(0);
  });

  it('correctly identifies movement away from target for RIGHT-handed golfer', () => {
    // Moving right (increasing X) = away from target for RIGHT-handed = negative
    const frames = createTestTimeline(3, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.3, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.4, y: 0.5 },
        },
        1: {
          [LandmarkID.leftWrist]: { x: 0.4, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.5, y: 0.5 },
        },
        2: {
          [LandmarkID.leftWrist]: { x: 0.5, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.6, y: 0.5 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const directions = extractHandDirection(timeline, 'RIGHT');

    expect(directions[1]).toBeLessThan(0); // away from target
    expect(directions[2]).toBeLessThan(0);
  });

  it('correctly identifies movement toward target for LEFT-handed golfer', () => {
    // LEFT-handed: target is to the RIGHT (higher X)
    // Moving right (increasing X) = toward target = positive direction
    const frames = createTestTimeline(3, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.3, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.4, y: 0.5 },
        },
        1: {
          [LandmarkID.leftWrist]: { x: 0.4, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.5, y: 0.5 },
        },
        2: {
          [LandmarkID.leftWrist]: { x: 0.5, y: 0.5 },
          [LandmarkID.rightWrist]: { x: 0.6, y: 0.5 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const directions = extractHandDirection(timeline, 'LEFT');

    expect(directions[1]).toBeGreaterThan(0); // toward target
    expect(directions[2]).toBeGreaterThan(0);
  });

  it('handles missing landmarks', () => {
    const frames = createTestTimeline(2, {
      excludeLandmarksPerFrame: {
        0: [LandmarkID.rightWrist],
      },
    });
    const timeline = toTimeline(frames);
    const directions = extractHandDirection(timeline, 'RIGHT');

    expect(directions[0]).toBe(0);
    expect(directions[1]).toBeNaN();
  });

  it('handles empty timeline', () => {
    const timeline = toTimeline([]);
    expect(extractHandDirection(timeline, 'RIGHT')).toHaveLength(0);
  });
});

// ─── extractShoulderSpan ────────────────────────────────────────────

describe('extractShoulderSpan', () => {
  it('extracts X-distance between shoulders', () => {
    const frames = createTestTimeline(2, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftShoulder]: { x: 0.3, y: 0.25 },
          [LandmarkID.rightShoulder]: { x: 0.7, y: 0.25 },
        },
        1: {
          [LandmarkID.leftShoulder]: { x: 0.4, y: 0.25 },
          [LandmarkID.rightShoulder]: { x: 0.6, y: 0.25 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const spans = extractShoulderSpan(timeline);

    expect(spans).toHaveLength(2);
    expect(spans[0]).toBeCloseTo(0.4);
    expect(spans[1]).toBeCloseTo(0.2);
  });

  it('returns NaN when a shoulder is missing', () => {
    const frames = createTestTimeline(2, {
      excludeLandmarksPerFrame: {
        0: [LandmarkID.leftShoulder],
      },
    });
    const timeline = toTimeline(frames);
    const spans = extractShoulderSpan(timeline);

    expect(spans[0]).toBeNaN();
    expect(spans[1]).not.toBeNaN();
  });
});

// ─── extractHipLateralPosition ──────────────────────────────────────

describe('extractHipLateralPosition', () => {
  it('extracts hip midpoint X-coordinate', () => {
    const frames = createTestTimeline(2, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftHip]: { x: 0.4, y: 0.55 },
          [LandmarkID.rightHip]: { x: 0.6, y: 0.55 },
        },
        1: {
          [LandmarkID.leftHip]: { x: 0.35, y: 0.55 },
          [LandmarkID.rightHip]: { x: 0.55, y: 0.55 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const positions = extractHipLateralPosition(timeline);

    expect(positions).toHaveLength(2);
    expect(positions[0]).toBeCloseTo(0.5);
    expect(positions[1]).toBeCloseTo(0.45);
  });

  it('returns NaN when a hip is missing', () => {
    const frames = createTestTimeline(2, {
      excludeLandmarksPerFrame: {
        1: [LandmarkID.rightHip],
      },
    });
    const timeline = toTimeline(frames);
    const positions = extractHipLateralPosition(timeline);

    expect(positions[0]).not.toBeNaN();
    expect(positions[1]).toBeNaN();
  });
});

// ─── extractWristHeight ─────────────────────────────────────────────

describe('extractWristHeight', () => {
  it('returns negative when wrists are below shoulders', () => {
    // Default fixtures: wrists at y=0.50, shoulders at y=0.25
    // shoulderY - wristY = 0.25 - 0.50 = -0.25 (below)
    const frames = createTestTimeline(1);
    const timeline = toTimeline(frames);
    const heights = extractWristHeight(timeline);

    expect(heights).toHaveLength(1);
    expect(heights[0]).toBeLessThan(0);
  });

  it('returns positive when wrists are above shoulders', () => {
    const frames = createTestTimeline(1, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.45, y: 0.10 },   // above shoulders
          [LandmarkID.rightWrist]: { x: 0.55, y: 0.10 },
          [LandmarkID.leftShoulder]: { x: 0.42, y: 0.25 },
          [LandmarkID.rightShoulder]: { x: 0.58, y: 0.25 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const heights = extractWristHeight(timeline);

    expect(heights[0]).toBeGreaterThan(0);
  });

  it('returns approximately zero when wrists are at shoulder level', () => {
    const frames = createTestTimeline(1, {
      landmarkOverridesPerFrame: {
        0: {
          [LandmarkID.leftWrist]: { x: 0.45, y: 0.25 },
          [LandmarkID.rightWrist]: { x: 0.55, y: 0.25 },
          [LandmarkID.leftShoulder]: { x: 0.42, y: 0.25 },
          [LandmarkID.rightShoulder]: { x: 0.58, y: 0.25 },
        },
      },
    });
    const timeline = toTimeline(frames);
    const heights = extractWristHeight(timeline);

    expect(heights[0]).toBeCloseTo(0);
  });

  it('returns NaN when shoulders or wrists are missing', () => {
    const frames = createTestTimeline(2, {
      excludeLandmarksPerFrame: {
        0: [LandmarkID.leftShoulder],
        1: [LandmarkID.leftWrist],
      },
    });
    const timeline = toTimeline(frames);
    const heights = extractWristHeight(timeline);

    expect(heights[0]).toBeNaN();
    expect(heights[1]).toBeNaN();
  });

  it('handles empty timeline', () => {
    const timeline = toTimeline([]);
    expect(extractWristHeight(timeline)).toHaveLength(0);
  });
});
