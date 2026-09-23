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

import { Platform } from 'react-native';

/**
 * Check if a real pose engine is available and initialized in this build.
 * Returns availability info without creating an engine.
 *
 * Detection strategy: verify platform is not web AND native module default export exists.
 */
export function checkRealEngineAvailability(): PoseEngineAvailability {
  if (Platform.OS === 'web') {
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!isBrowser) {
      return {
        available: false,
        provider: null,
        reason: 'MediaPipe Web pose engine requires a browser environment.',
      };
    }

    const hasWasm = typeof WebAssembly !== 'undefined';
    if (hasWasm) {
      return {
        available: true,
        provider: 'MEDIAPIPE_WEB',
        reason: 'MediaPipe WebAssembly pose engine available in browser.',
      };
    }

    return {
      available: false,
      provider: null,
      reason: 'WebAssembly is not supported in this browser.',
    };
  }

  try {
    const mediapipe = require('../../../modules/mediapipe-pose');
    if (mediapipe && mediapipe.default != null) {
      return {
        available: true,
        provider: 'MEDIAPIPE',
        reason: 'MediaPipe Pose Landmarker module loaded.',
      };
    }
    return {
      available: false,
      provider: null,
      reason: 'MediaPipe native module not linked in this build.',
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

  if (availability.provider === 'MEDIAPIPE_WEB') {
    const { MediaPipeWebPoseEngine } = require('./MediaPipeWebPoseEngine');
    const variant = config.modelVariant ?? 'heavy';
    Logger.pose.info(`Creating MediaPipeWebPoseEngine (real mode, variant: ${variant})`);
    return new MediaPipeWebPoseEngine(variant);
  }

  if (availability.provider === 'MEDIAPIPE') {
    const { MediaPipePoseAdapter } = require('./MediaPipePoseAdapter');
    const variant = config.modelVariant ?? 'heavy';
    Logger.pose.info(`Creating MediaPipePoseAdapter (real mode, variant: ${variant})`);
    return new MediaPipePoseAdapter(variant);
  }

  throw new Error(`Unsupported pose engine provider: ${availability.provider}`);
}

/** Legacy compatibility — creates engine with explicit mock mode. */
export function createMockPoseEngine(): PoseEngine {
  return createPoseEngine({ mode: 'MOCK' });
}
