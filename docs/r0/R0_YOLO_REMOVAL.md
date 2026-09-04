# R0: YOLO Removal Summary

## What Was Removed
- **`ExecuTorchPoseAdapter.ts`**: The real pose engine adapter that wrapped the ExecuTorch runtime to run the YOLOv8 pose model was emptied out.
- **YOLOv8 Pose Model**: All YOLO-specific model loading, inference logic, and keypoint mapping (e.g., mapping 17 COCO keypoints to 33 MediaPipe-style keypoints) have been deleted.

## Why
- **Licensing Constraint (AGPL-3.0)**: The YOLOv8 model weights provided by Ultralytics are bound by the AGPL-3.0 license, which would force the entire app to be open-sourced under the same license if distributed commercially without an enterprise license. To ensure the app can be distributed under proprietary terms safely, we decided to entirely remove YOLO from the codebase.

## What Was Kept
- **`executorchInit.ts`**: The initialization file for ExecuTorch with ExpoResourceFetcher was kept.
- **ExecuTorch Runtime**: The underlying framework integration remains in place. This serves as a foundational building block for future integrations, enabling us to swap in license-friendly models like MoveNet or RTMPose down the road if we require localized device-side inference that MediaPipe does not provide perfectly.

## What Replaces It
- **MediaPipe Pose Landmarker**: The immediate replacement is the standard `MediaPipePoseAdapter`, taking advantage of the `@/modules/mediapipe-pose` module (to be created and finalized in Block 2). `PoseEngineFactory` has already been updated to dynamically check and load this adapter when in REAL mode instead of the YOLO implementation.
