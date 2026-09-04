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
 * Check if a real pose engine is available and initialized in this build.
 * Returns availability info without creating an engine.
 *
 * Detection strategy: try to require the native module AND verify runtime initialization (Finding 9).
 */
export function checkRealEngineAvailability(): PoseEngineAvailability {
  try {
    const mediapipe = require('@/modules/mediapipe-pose');
    if (mediapipe) {
      return {
        available: true,
        provider: 'MEDIAPIPE',
        reason: 'MediaPipe Pose Landmarker available.',
      };
    }
    return {
      available: false,
      provider: null,
      reason: 'No real pose engine available. MediaPipe module not installed.',
    };
  } catch {
    return {
      available: false,
      provider: null,
      reason: 'No real pose engine available. MediaPipe module not installed.',
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

  if (availability.provider === 'MEDIAPIPE') {
    const { MediaPipePoseAdapter } = require('./MediaPipePoseAdapter');
    Logger.pose.info('Creating MediaPipePoseAdapter (real mode)');
    return new MediaPipePoseAdapter();
  }

  throw new Error(`Unsupported pose engine provider: ${availability.provider}`);
}

/** Legacy compatibility — creates engine with explicit mock mode. */
export function createMockPoseEngine(): PoseEngine {
  return createPoseEngine({ mode: 'MOCK' });
}
