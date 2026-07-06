# Swing Swang — Phase 0 Technical Decisions

> Researched and documented July 2026

---

## Decision 1: Pose Estimation Engine

### Options Evaluated

| Solution | Landmarks | Video Files | Camera | Expo Go | Maintenance | Notes |
|----------|-----------|-------------|--------|---------|-------------|-------|
| `react-native-executorch` v0.9.0 | 17 (COCO) | ✅ `forward(imageUri)` | ✅ VisionCamera V5 | ❌ Dev Build | ✅ Software Mansion | Best ecosystem alignment |
| `react-native-mediapipe-posedetection` | 33 (MediaPipe) | ❌ Camera only | ✅ VisionCamera | ❌ Dev Build | ⚠️ Community | More landmarks |
| `@gymbrosinc/react-native-mediapipe-pose` | 33 (MediaPipe) | ❌ Camera only | ✅ | ❌ Dev Build | ⚠️ Community | GPU accel |
| QuickPose SDK | 33 (MediaPipe) | ✅ 240fps post | ✅ | ❌ Dev Build | ✅ Commercial | Vendor lock-in, SDK key |
| TensorFlow.js | 17/33 | ❌ Legacy | ❌ Legacy | ❌ | ❌ Deprecated | Do NOT use |
| Google ML Kit RN | 33 | ❌ | ❌ | ❌ | ❌ Abandoned | Do NOT use |

### Decision: `react-native-executorch` (Tier 1)

**Reasons:**
1. **Video file analysis works** — `forward(imageUri)` accepts image file URIs
2. **Maintained by Software Mansion** — same team that maintains `expo-video` and `react-native-reanimated`
3. **Dedicated `usePoseEstimation` hook** — purpose-built API
4. **17 COCO keypoints is sufficient** for golf swing Phase 0
5. **Camera path ready** — works with VisionCamera V5 via `runOnFrame`
6. **New Architecture** — built for React Native's new architecture

**Trade-offs:**
- 17 landmarks vs MediaPipe's 33 (no individual finger/toe points). Acceptable for Phase 0.
- Requires Android 13+ and iOS 17+.
- Requires Development Build (not Expo Go).

**Phase 0 Strategy:** Include a MockPoseEngine for development/testing on Windows without native modules. Switch to real ExecuTorch on device builds.

---

## Decision 2: Video Frame Extraction

### Decision: `expo-video` thumbnail extraction

Pipeline: Video → `generateThumbnailsAsync(uri, timestamps[])` → JPEG images → ExecuTorch `forward(imageUri)` → PoseFrame results

---

## Decision 3: Video Playback

### Decision: `expo-av` Video component

Proven, well-documented API with play, pause, seek, playback rate, and status callbacks.

---

## Decision 4: Skeleton Overlay

### Decision: `react-native-svg`

Included in Expo by default. SVG Circle and Line elements for clean skeleton drawing. No additional native modules needed.

---

## Decision 5: Build System

### Decision: Expo Development Build via EAS Build (cloud)

No local Android SDK needed for building. Download APK to phone. Use `npx expo start` for fast JS refresh.

---

## Environment

| Component | Status |
|-----------|--------|
| Node.js 22.19.0 | ✅ |
| npm 11.6.1 | ✅ |
| JDK 21 (Temurin) | ✅ |
| Android SDK | ❌ (use EAS Build cloud) |
| Expo CLI (local) | ✅ |
