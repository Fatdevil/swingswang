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
 *
 * Detection strategy: try to require the native module.
 * If it throws, the native module is not linked (Expo Go / missing dep).
 */
export function checkRealEngineAvailability(): PoseEngineAvailability {
  try {
    const executorch = require('react-native-executorch');
    if (executorch?.PoseEstimationModule) {
      return {
        available: true,
        provider: 'EXECUTORCH',
        reason: 'react-native-executorch PoseEstimationModule detected.',
      };
    }
    return {
      available: false,
      provider: null,
      reason: 'react-native-executorch loaded but PoseEstimationModule not found.',
    };
  } catch {
    return {
      available: false,
      provider: null,
      reason:
        'react-native-executorch native module not available. ' +
        'Requires a Development Build (not Expo Go).',
    };
  }
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

  if (availability.provider === 'EXECUTORCH') {
    const { ExecuTorchPoseAdapter } = require('./ExecuTorchPoseAdapter');
    Logger.pose.info('Creating ExecuTorchPoseAdapter (real mode)');
    return new ExecuTorchPoseAdapter();
  }

  throw new Error(`Unsupported pose engine provider: ${availability.provider}`);
}

/** Legacy compatibility — creates engine with explicit mock mode. */
export function createMockPoseEngine(): PoseEngine {
  return createPoseEngine({ mode: 'MOCK' });
}
