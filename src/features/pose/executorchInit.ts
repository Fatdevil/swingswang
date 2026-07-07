/**
 * executorchInit.ts
 * SwingSwang – Pose Engine
 *
 * Initializes react-native-executorch with the Expo resource fetcher.
 * Must be called once at app startup before any ExecuTorch modules are used.
 *
 * Safe to call in Expo Go — will log a warning and return false.
 */

import { Logger } from '@/utils/logger';

let initialized = false;

/**
 * Initialize react-native-executorch with the Expo resource fetcher.
 * Returns true if initialization succeeded, false if native module unavailable.
 *
 * Safe to call multiple times — only initializes once.
 */
export function initializeExecuTorch(): boolean {
  if (initialized) return true;

  try {
    const { initExecutorch } = require('react-native-executorch');
    const {
      ExpoResourceFetcher,
    } = require('react-native-executorch-expo-resource-fetcher');

    initExecutorch({
      resourceFetcher: ExpoResourceFetcher,
    });

    initialized = true;
    Logger.pose.info('ExecuTorch initialized with ExpoResourceFetcher');
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    Logger.pose.warn(
      'ExecuTorch initialization skipped — native module not available. ' +
      'This is expected in Expo Go. Use a Development Build for real pose inference.',
      { error: msg }
    );
    return false;
  }
}

/** Check if ExecuTorch has been initialized. */
export function isExecuTorchInitialized(): boolean {
  return initialized;
}
