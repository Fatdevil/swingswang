/**
 * defaultRegistry.test.ts
 * SwingSwang – Tests
 *
 * Tests for the default metric registry factory.
 */

import { createDefaultRegistry } from '@/features/metrics/defaultRegistry';

describe('createDefaultRegistry', () => {
  it('registers all 7 metrics', () => {
    const registry = createDefaultRegistry();
    expect(registry.getAll().length).toBe(7);
  });

  it('includes Phase 0 adapted metrics', () => {
    const registry = createDefaultRegistry();
    expect(registry.get('headMovement')).toBeDefined();
    expect(registry.get('torsoAngleChange')).toBeDefined();
    expect(registry.get('hipMovementProxy')).toBeDefined();
  });

  it('includes V1 native metrics', () => {
    const registry = createDefaultRegistry();
    expect(registry.get('tempo')).toBeDefined();
    expect(registry.get('pelvisSway')).toBeDefined();
    expect(registry.get('kneeFlex')).toBeDefined();
    expect(registry.get('handDepth')).toBeDefined();
  });

  it('returns DTL metrics for DTL view', () => {
    const registry = createDefaultRegistry();
    const dtlMetrics = registry.getMetricsForView('DTL');
    const ids = dtlMetrics.map(m => m.id);
    // BOTH-view metrics + DTL-only metrics
    expect(ids).toContain('headMovement');
    expect(ids).toContain('torsoAngleChange');
    expect(ids).toContain('hipMovementProxy');
    expect(ids).toContain('tempo');
    expect(ids).toContain('kneeFlex');
    expect(ids).toContain('handDepth');
    // FO-only metrics should not appear
    expect(ids).not.toContain('pelvisSway');
  });

  it('returns FO metrics for FO view', () => {
    const registry = createDefaultRegistry();
    const foMetrics = registry.getMetricsForView('FO');
    const ids = foMetrics.map(m => m.id);
    // BOTH-view metrics + FO-only metrics
    expect(ids).toContain('headMovement');
    expect(ids).toContain('torsoAngleChange');
    expect(ids).toContain('hipMovementProxy');
    expect(ids).toContain('tempo');
    expect(ids).toContain('kneeFlex');
    expect(ids).toContain('pelvisSway');
    // DTL-only metrics should not appear
    expect(ids).not.toContain('handDepth');
  });

  it('Phase 0 adapted entries have version 0.1.0', () => {
    const registry = createDefaultRegistry();
    expect(registry.get('headMovement')!.version).toBe('0.1.0');
    expect(registry.get('torsoAngleChange')!.version).toBe('0.1.0');
    expect(registry.get('hipMovementProxy')!.version).toBe('0.1.0');
  });

  it('V1 native entries have version 1.0.0', () => {
    const registry = createDefaultRegistry();
    expect(registry.get('tempo')!.version).toBe('1.0.0');
    expect(registry.get('pelvisSway')!.version).toBe('1.0.0');
    expect(registry.get('kneeFlex')!.version).toBe('1.0.0');
    expect(registry.get('handDepth')!.version).toBe('1.0.0');
  });
});
