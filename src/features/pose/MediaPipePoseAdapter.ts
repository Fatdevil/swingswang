import { PoseEngine } from './PoseEngine';
import { PoseFrame } from '../../types/pose';
import {
  detectPose as mpDetectPose,
  initialize as mpInitialize,
  release as mpRelease,
} from '../../../modules/mediapipe-pose';
import { mapPoseOutputToFrame, RawKeypoint } from './landmarkMapper';

export class MediaPipePoseAdapter implements PoseEngine {
  readonly name = 'MediaPipe';
  readonly version = '0.10.21';
  readonly landmarkCount = 17; // COCO subset

  // Mapping from MediaPipe index to COCO 17-keypoint index
  private readonly mpToCocoMapping: Record<number, number> = {
    0: 0,   // NOSE
    2: 1,   // LEFT_EYE
    5: 2,   // RIGHT_EYE
    7: 3,   // LEFT_EAR
    8: 4,   // RIGHT_EAR
    11: 5,  // LEFT_SHOULDER
    12: 6,  // RIGHT_SHOULDER
    13: 7,  // LEFT_ELBOW
    14: 8,  // RIGHT_ELBOW
    15: 9,  // LEFT_WRIST
    16: 10, // RIGHT_WRIST
    23: 11, // LEFT_HIP
    24: 12, // RIGHT_HIP
    25: 13, // LEFT_KNEE
    26: 14, // RIGHT_KNEE
    27: 15, // LEFT_ANKLE
    28: 16, // RIGHT_ANKLE
  };

  async initialize(): Promise<void> {
    await mpInitialize('lite');
  }

  async analyzeFrame(
    imageUri: string,
    timestamp: number,
    frameIndex: number,
    width?: number,
    height?: number
  ): Promise<PoseFrame | null> {
    const startTime = Date.now();
    
    const poses = await mpDetectPose(imageUri, 'lite');
    if (!poses || poses.length === 0) {
      return null;
    }

    const pose = poses[0];
    const mpLandmarks = pose.landmarks;
    
    const cocoKeypoints: RawKeypoint[] = new Array(17);
    
    // Initialize all to 0
    for (let i = 0; i < 17; i++) {
      cocoKeypoints[i] = { x: 0, y: 0, score: 0 };
    }
    
    for (const [mpIndex, cocoIndex] of Object.entries(this.mpToCocoMapping)) {
      const idx = parseInt(mpIndex, 10);
      if (idx < mpLandmarks.length) {
        const lm = mpLandmarks[idx];
        cocoKeypoints[cocoIndex] = {
          x: lm.x,
          y: lm.y,
          score: Math.min(lm.visibility, lm.presence)
        };
      }
    }

    // MediaPipe returns normalized coordinates (0-1), so pixelCoords = false
    const frame = mapPoseOutputToFrame(
      cocoKeypoints,
      timestamp,
      frameIndex,
      width ?? 1,
      height ?? 1,
      false
    );
    
    const processingTimeMs = Date.now() - startTime;

    // Return a new frame with the correct processingTimeMs (readonly in PoseFrame)
    const result: PoseFrame = {
      ...frame,
      processingTimeMs,
    };

    return result;
  }

  dispose(): void {
    // Release resources asynchronously without waiting
    mpRelease().catch(() => {});
  }
}

