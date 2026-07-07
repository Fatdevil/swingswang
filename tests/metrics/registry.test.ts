/**
 * registry.test.ts
 * SwingSwang – Tests
 *
 * Tests for the MetricRegistry: registration, view filtering, and calculateAvailable.
 */

import { MetricRegistry, MetricRegistryEntry, MetricResultV1 } from '@/features/metrics/registry';
import { PoseTimeline } from '@/features/timeline/PoseTimeline';
import { LandmarkID } from '@/types/landmarks';
import { CameraView, SwingConfig } from '@/types/swing';
import { createStationarySequence } from '../helpers/poseFixtures';

// ─── Helpers ────────────────────────────────────────────────────────

function makeConfig(view: CameraView): SwingConfig {
  return { cameraView: view, handedness: 'RIGHT', club: 'MID_IRON' };
}

function makeTimeline(frameCount = 20): PoseTimeline {
  const frames = createStationarySequence(frameCount);
  return new PoseTimeline(frames, frames.length, 1000, 15);
}

function makeDummyResult(id: string, view: CameraView | 'BOTH'): MetricResultV1 {
  return {
    id,
    name: `Test ${id}`,
    value: 42,
    normalizedValue: 42,
    unit: 'test',
    confidence: 0.9,
    status: 'RELIABLE',
    supportedView: view,
    warnings: [],
    evidence: {},
    calculationExplanation: 'test',
    limitations: [],
    framesUsed: 10,
    version: '1.0.0',
  };
}

function createMockEntry(
  id: string,
  views: readonly CameraView[],
  resultOverrides?: Partial<MetricResultV1>,
): MetricRegistryEntry {
  return {
    id,
    displayName: `Test ${id}`,
    version: '1.0.0',
    supportedViews: views,
    requiredLandmarks: [LandmarkID.leftShoulder, LandmarkID.rightShoulder],
    requiredConfidence: 0.4,
    calculate: jest.fn(() => ({
      ...makeDummyResult(id, views.length === 1 ? views[0] : 'BOTH'),
      ...resultOverrides,
    })),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('MetricRegistry', () => {
  let registry: MetricRegistry;

  beforeEach(() => {
    registry = new MetricRegistry();
  });

  // ── Registration ──

  describe('register and retrieve', () => {
    it('registers and retrieves a metric by ID', () => {
      const entry = createMockEntry('testMetric', ['DTL', 'FO']);
      registry.register(entry);

      expect(registry.get('testMetric')).toBe(entry);
    });

    it('returns undefined for unknown ID', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('getAll returns all registered metrics', () => {
      registry.register(createMockEntry('a', ['DTL']));
      registry.register(createMockEntry('b', ['FO']));
      registry.register(createMockEntry('c', ['DTL', 'FO']));

      expect(registry.getAll()).toHaveLength(3);
    });

    it('duplicate ID overwrites previous entry', () => {
      const first = createMockEntry('dup', ['DTL']);
      const second = createMockEntry('dup', ['FO']);

      registry.register(first);
      registry.register(second);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('dup')).toBe(second);
    });
  });

  // ── View filtering ──

  describe('getMetricsForView', () => {
    beforeEach(() => {
      registry.register(createMockEntry('dtlOnly', ['DTL']));
      registry.register(createMockEntry('foOnly', ['FO']));
      registry.register(createMockEntry('both', ['DTL', 'FO']));
    });

    it('filters DTL-compatible metrics', () => {
      const dtlMetrics = registry.getMetricsForView('DTL');
      const ids = dtlMetrics.map((m) => m.id);

      expect(ids).toContain('dtlOnly');
      expect(ids).toContain('both');
      expect(ids).not.toContain('foOnly');
    });

    it('filters FO-compatible metrics', () => {
      const foMetrics = registry.getMetricsForView('FO');
      const ids = foMetrics.map((m) => m.id);

      expect(ids).toContain('foOnly');
      expect(ids).toContain('both');
      expect(ids).not.toContain('dtlOnly');
    });
  });

  // ── Calculate available ──

  describe('calculateAvailable', () => {
    it('calculates only view-compatible metrics', () => {
      const dtlEntry = createMockEntry('dtlMetric', ['DTL']);
      const foEntry = createMockEntry('foMetric', ['FO']);
      const bothEntry = createMockEntry('bothMetric', ['DTL', 'FO']);

      registry.register(dtlEntry);
      registry.register(foEntry);
      registry.register(bothEntry);

      const timeline = makeTimeline();
      const results = registry.calculateAvailable(timeline, makeConfig('DTL'));

      expect(results.has('dtlMetric')).toBe(true);
      expect(results.has('bothMetric')).toBe(true);
      expect(results.has('foMetric')).toBe(false);

      expect(dtlEntry.calculate).toHaveBeenCalled();
      expect(bothEntry.calculate).toHaveBeenCalled();
      expect(foEntry.calculate).not.toHaveBeenCalled();
    });

    it('returns empty map for empty registry', () => {
      const timeline = makeTimeline();
      const results = registry.calculateAvailable(timeline, makeConfig('DTL'));
      expect(results.size).toBe(0);
    });

    it('returns results keyed by metric ID', () => {
      registry.register(createMockEntry('alpha', ['DTL']));
      registry.register(createMockEntry('beta', ['DTL']));

      const timeline = makeTimeline();
      const results = registry.calculateAvailable(timeline, makeConfig('DTL'));

      expect(results.get('alpha')?.id).toBe('alpha');
      expect(results.get('beta')?.id).toBe('beta');
    });

    it('handles calculation errors gracefully', () => {
      const errorEntry: MetricRegistryEntry = {
        id: 'errorMetric',
        displayName: 'Error Metric',
        version: '1.0.0',
        supportedViews: ['DTL'],
        requiredLandmarks: [],
        requiredConfidence: 0.4,
        calculate: () => {
          throw new Error('Test explosion');
        },
      };
      registry.register(errorEntry);

      const timeline = makeTimeline();
      const results = registry.calculateAvailable(timeline, makeConfig('DTL'));

      expect(results.has('errorMetric')).toBe(true);
      const result = results.get('errorMetric')!;
      expect(result.status).toBe('NOT_RELIABLE');
      expect(result.value).toBeNull();
    });
  });

  // ── Empty registry ──

  describe('empty registry', () => {
    it('getAll returns empty array', () => {
      expect(registry.getAll()).toHaveLength(0);
    });

    it('getMetricsForView returns empty array', () => {
      expect(registry.getMetricsForView('DTL')).toHaveLength(0);
      expect(registry.getMetricsForView('FO')).toHaveLength(0);
    });
  });
});
