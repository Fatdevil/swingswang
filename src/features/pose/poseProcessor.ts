/**
 * poseProcessor.ts
 * SwingSwang
 *
 * Batch processes video frames through a pose engine.
 */

import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '../../types/pose';
import { FrameData } from '../../types/video';
import { Logger, PerformanceTimer } from '../../utils/logger';

/**
 * Process all extracted frames through a pose engine.
 * @param frames - Extracted video frames with image URIs.
 * @param engine - Initialized pose engine.
 * @param onProgress - Callback for progress updates (framesComplete, framesTotal).
 * @returns Array of successfully analyzed PoseFrames, sorted by timestamp.
 */
export async function processVideoFrames(
  frames: readonly FrameData[],
  engine: PoseEngine,
  onProgress?: (framesComplete: number, framesTotal: number) => void,
  isCancelled?: () => boolean
): Promise<PoseFrame[]> {
  const timer = new PerformanceTimer('processVideoFrames');
  const results: PoseFrame[] = [];
  const total = frames.length;

  Logger.pose.info(`Starting pose processing: ${total} frames with ${engine.name}`);

  let exceptionCount = 0;
  let consecutiveExceptions = 0;
  let lastError = '';

  for (let i = 0; i < total; i++) {
    if (isCancelled && isCancelled()) {
      Logger.pose.info('Pose processing cancelled by caller.');
      throw new Error('Pose processing cancelled');
    }

    const frame = frames[i];

    try {
      const poseFrame = await engine.analyzeFrame(
        frame.imageUri,
        frame.timestamp,
        frame.index
      );

      if (poseFrame) {
        results.push(poseFrame);
      } else {
        Logger.pose.debug(`No person detected in frame ${i} at ${frame.timestamp.toFixed(3)}s`);
      }
      consecutiveExceptions = 0; // Reset on success
    } catch (error) {
      exceptionCount++;
      consecutiveExceptions++;
      lastError = error instanceof Error ? error.message : String(error);
      Logger.pose.warn(`Frame ${i} failed with exception: ${lastError}`);

      // Risk 4: Fail early on systemic native engine failures
      if (consecutiveExceptions >= 3) {
        throw new Error(`Pose engine failed consistently: ${lastError} (3 consecutive failures)`);
      }

      const threshold = Math.max(3, Math.ceil(total * 0.2));
      if (exceptionCount > threshold) {
        throw new Error(`Pose engine failed on too many frames: ${lastError} (${exceptionCount}/${total} failed)`);
      }
    }

    onProgress?.(i + 1, total);
  }

  // Sort by timestamp (should already be sorted, but ensure)
  results.sort((a, b) => a.timestamp - b.timestamp);

  const elapsed = timer.stop();
  Logger.pose.info(`Pose processing complete: ${results.length}/${total} frames in ${elapsed.toFixed(0)}ms`);

  return results;
}
