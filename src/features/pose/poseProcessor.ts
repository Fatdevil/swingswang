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
  onProgress?: (framesComplete: number, framesTotal: number) => void
): Promise<PoseFrame[]> {
  const timer = new PerformanceTimer('processVideoFrames');
  const results: PoseFrame[] = [];
  const total = frames.length;

  Logger.pose.info(`Starting pose processing: ${total} frames with ${engine.name}`);

  for (let i = 0; i < total; i++) {
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
    } catch (error) {
      Logger.pose.warn(`Frame ${i} failed: ${String(error)}`);
    }

    onProgress?.(i + 1, total);
  }

  // Sort by timestamp (should already be sorted, but ensure)
  results.sort((a, b) => a.timestamp - b.timestamp);

  const elapsed = timer.stop();
  Logger.pose.info(`Pose processing complete: ${results.length}/${total} frames in ${elapsed.toFixed(0)}ms`);

  return results;
}
