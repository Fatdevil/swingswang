/**
 * ExecuTorchAdapter.ts
 * SwingSwang – Pose Engine
 *
 * ExecuTorch-based pose estimation adapter.
 * Requires react-native-executorch native module (Development Build only).
 *
 * MockPoseEngine has been moved to MockPoseEngine.ts.
 * Factory function has been moved to PoseEngineFactory.ts.
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '@/types/pose';
import { LANDMARK_COUNT } from '@/types/landmarks';
import { Logger, PerformanceTimer } from '@/utils/logger';

// ─── ExecuTorch Adapter ─────────────────────────────────────────────

/**
 * ExecuTorch-based pose engine.
 * Requires react-native-executorch native module (Development Build only).
 *
 * TODO AB-1: Implement real inference via react-native-executorch
 * PoseEstimationModule when native module is available.
 */
export class ExecuTorchAdapter implements PoseEngine {
  readonly name = 'ExecuTorch';
  readonly version = '0.9.0';
  readonly landmarkCount = LANDMARK_COUNT;

  private initialized = false;

  async initialize(): Promise<void> {
    Logger.pose.info('ExecuTorch adapter: initialize called');
    // In a real build, this would load the YOLO pose model via react-native-executorch
    this.initialized = true;
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number
  ): Promise<PoseFrame | null> {
    if (!this.initialized) {
      Logger.pose.warn('ExecuTorch not initialized');
      return null;
    }

    const timer = new PerformanceTimer('ExecuTorch.analyzeFrame');

    try {
      // In a real Development Build, this would call:
      // const result = await executorchModule.forward(imageUri);
      Logger.pose.debug(`Analyzing frame ${frameIndex} at ${timestamp.toFixed(3)}s`, { imageUri });

      // Placeholder — real implementation requires native module
      const processingTimeMs = timer.stop();
      return null;
    } catch (error) {
      Logger.pose.error('Frame analysis failed', { error: String(error) });
      timer.stop();
      return null;
    }
  }

  dispose(): void {
    this.initialized = false;
    Logger.pose.info('ExecuTorch adapter disposed');
  }
}
