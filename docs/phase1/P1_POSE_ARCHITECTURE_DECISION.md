# P1_POSE_ARCHITECTURE_DECISION.md

## Pose Engine Architecture Decision Record

**Date**: 2026-07-07
**Decision**: Two-track approach — ExecuTorch baseline NOW + Custom MediaPipe module LATER

---

## Candidates Evaluated

### 1. react-native-mediapipe (cdiddy77)
- **Verdict: REJECTED**
- Camera-only API, no file URI support
- Unmaintained since Dec 2024
- No New Architecture support
- No Expo SDK 57 compatibility
- 37 open issues, single maintainer

### 2. react-native-executorch (Software Mansion)
- **Verdict: SELECTED as AB-1 baseline**
- ✅ Actively maintained by Software Mansion (reanimated authors)
- ✅ Supports file URIs, remote URLs, base64, PixelData
- ✅ New Architecture (Fabric/TurboModules) support
- ✅ MIT license (runtime)
- ✅ Has dedicated PoseEstimationModule with usePoseEstimation hook
- ✅ 17 COCO keypoints — EXACT match with existing LandmarkID enum
- ⚠️ Requires Dev Build
- ⚠️ YOLO model license needs verification per model

### 3. Custom Expo Module (MediaPipe Tasks Vision)
- **Verdict: DEFERRED to future upgrade**
- ✅ 33 MediaPipe landmarks (superset of COCO 17)
- ✅ Apache 2.0 license (runtime + model weights)
- ✅ Official Google SDK
- ⚠️ ~200-300 lines Kotlin + Swift to build
- ⚠️ Model files must be bundled in assets

---

## Decision Rationale

The entire Swing Swang codebase is built on COCO 17-keypoint format:
- LandmarkID enum: 17 keypoints (nose through rightAnkle)
- LANDMARK_COUNT = 17
- All metrics use these 17 landmarks
- Event detection uses wrist/hand signals from these landmarks
- Stabilization operates on these landmarks

react-native-executorch provides exactly this:
- PoseEstimationModule outputs 17 COCO keypoints
- Accepts file URIs (matches PoseEngine.analyzeFrame(imageUri))
- Clean API: `poseModule.forward(imageUri)` → detections
- Software Mansion maintains it alongside reanimated (already in our deps)

**Why not custom module first?**
- Custom module requires Kotlin + Swift + CocoaPods + MediaPipe SDK setup
- react-native-executorch is a single npm install + Dev Build
- If ExecuTorch works, we have a real pose engine in hours, not days
- If it doesn't work, we still have the custom module path

---

## Implementation Path

```
Phase 1 (NOW — Sprint AB-1):
  Install react-native-executorch
  → Create ExecuTorchPoseAdapter
  → Dev Build (EAS or local)
  → One real image → 17 real landmarks
  → GATE: Landmarks depend on image content

Phase 2 (LATER — Sprint AB-1 extension if needed):
  Build custom Expo Module wrapping MediaPipe Tasks
  → 33 landmarks
  → Map 33 → 17 via existing landmarkMapper.ts
  → Or extend LandmarkID to 33 (requires metric updates)
```

---

## License Tracking

| Component | License | Verified |
|-----------|---------|----------|
| react-native-executorch (npm) | MIT | ✅ |
| YOLO26N_POSE model weights | TODO — must verify before commercial use | ❌ |
| MediaPipe Framework | Apache 2.0 | ✅ |
| MediaPipe pose model weights | Apache 2.0 | ✅ |

> **ACTION REQUIRED**: Verify YOLO26N_POSE model license before any commercial release.
> This was explicitly requested in the user's Phase 1 approval conditions.

---

## Risks

1. **react-native-executorch + Expo SDK 57**: Not explicitly tested. May need config plugin adjustments.
2. **Dev Build required**: Cannot test in Expo Go. Need EAS Build or local build.
3. **Model size**: YOLO26N_POSE model size unknown — may impact app bundle.
4. **Inference speed**: Unknown on-device performance for 15fps frame analysis.
5. **YOLO license blocker**: If YOLO model is AGPL, cannot use commercially without license change.
