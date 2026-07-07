/**
 * PoseEngineFactory.ts
 * SwingSwang – Pose Engine
 *
 * Safe factory for creating pose engines.
 * NEVER silently falls back from REAL to MOCK.
 */

import { PoseEngine } from './PoseEngine';
import { PoseEngineConfig, PoseEngineAvailability } from './types';
import { MockPoseEngine } from './MockPoseEngine';
import { Logger } from '@/utils/logger';

/**
 * Check if a real pose engine is available in this build.
 * Returns availability info without creating an engine.
 */
export function checkRealEngineAvailability(): PoseEngineAvailability {
  // TODO AB-1: Check for react-native-executorch native module availability
  // For now, no real engine is installed
  return {
    available: false,
    provider: null,
    reason: 'No real pose engine installed. Requires a Development Build with react-native-executorch.',
  };
}

/**
 * Create a pose engine based on explicit mode selection.
 *
 * CRITICAL RULES:
 * - MOCK mode: Returns MockPoseEngine (for tests, debug, demo)
 * - REAL mode: Returns real engine OR throws if unavailable
 * - NEVER silently falls back from REAL to MOCK
 */
export function createPoseEngine(config: PoseEngineConfig): PoseEngine {
  if (config.mode === 'MOCK') {
    Logger.pose.info('Creating MockPoseEngine (explicit mock mode)');
    return new MockPoseEngine();
  }

  // REAL mode — attempt to create a real engine
  const availability = checkRealEngineAvailability();

  if (!availability.available) {
    // NEVER silently fall back to mock
    throw new Error(
      `Real pose analysis is unavailable in this build. ${availability.reason}`
    );
  }

  // When a real engine becomes available, create it here:
  // if (availability.provider === 'EXECUTORCH') {
  //   Logger.pose.info('Creating ExecuTorchAdapter (real mode)');
  //   return new ExecuTorchAdapter();
  // }

  throw new Error(`Unsupported pose engine provider: ${availability.provider}`);
}

/** Legacy compatibility — creates engine with explicit mock mode. */
export function createMockPoseEngine(): PoseEngine {
  return createPoseEngine({ mode: 'MOCK' });
}
