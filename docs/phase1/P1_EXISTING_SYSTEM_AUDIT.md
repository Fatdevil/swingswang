# P1-01: Existing System Audit

> **Audit Date:** 2026-07-07  
> **Auditor:** Phase 1 Technical Lead  
> **Phase 0 Version:** v0.1.0  
> **All 106 existing tests: PASS**

---

## 1. App Architecture

### Framework Stack
| Component | Version |
|-----------|---------|
| Expo SDK | 57 |
| React | 19.2.3 |
| React Native | 0.86.0 |
| TypeScript | 6.0.3 |
| Node.js (dev) | 22.19.0 |

### Navigation
- **Expo Router** (file-based routing) with 5-tab layout
- Tabs: Home, Player, Plus (center action), Results, Debug
- Hidden screen: `analyze.tsx` (processing overlay, `href: null`)
- Center "+" tab opens a Modal popup (not a screen navigation)
- Font: `KGRedHands` custom TTF

### Build System
- EAS Build (cloud) — no local Android SDK
- Three profiles: development (APK), preview (APK), production (AAB)

---

## 2. Current Expo SDK

**Expo SDK 57** with experiments:
- `typedRoutes: true`
- `reactCompiler: true`

---

## 3. Current React Native Version

**React Native 0.86.0**

---

## 4. Current Navigation Solution

**Expo Router ~57.0.3** with file-based tab navigation (`<Tabs>` component).

| Tab | Route | Purpose |
|-----|-------|---------|
| Home | `/` (index.tsx) | Main landing, video selection, friends, streaks |
| Player | `/player` | Video playback with skeleton overlay |
| Plus | `/plus` | Dummy screen — center button opens Modal |
| Results | `/results` | Analysis metric display |
| Debug | `/debug` | Developer console |
| Analyze | `/analyze` | Hidden processing screen |

Tab bar: White surface (`#F8FAFC`), 60px height, emerald green active (`#10B981`).

---

## 5. Current Video Import Pipeline

### Import (`videoImporter.ts`)
- Uses `expo-image-picker` `launchImageLibraryAsync` with `mediaTypes: ['videos']`
- Requests media library permission
- Builds `VideoMetadata` from ImagePicker asset
- **Frame rate is always `null`** — ImagePicker doesn't provide it
- Duration converted from ms → seconds

### Validation (`validateVideo()`)
- Min duration: 0.5s
- Max absolute: 60s
- Max recommended: 10s (warning only)
- Resolution: warns if min dimension < 480px
- Orientation: warns if landscape

**Status: REAL** — actually picks real videos from the device gallery.

---

## 6. Current Video Playback Pipeline

### Player Screen (`player.tsx`)
- Uses **`expo-av`** `<Video>` component directly
- Looping playback with `onPlaybackStatusUpdate`
- Supports: play/pause, 3 playback rates (0.25x, 0.5x, 1.0x), skeleton toggle
- Display dimensions calculated from aspect ratio, capped at 500px height
- **No scrub/seek bar** — only play/pause and rate controls

### Unused Components
- `VideoPlayer.tsx` — Uses **`expo-video`** `VideoView`. **Never imported by any screen.**
- `VideoMetadataCard.tsx` — Metadata display card. **Never imported by any screen.**
- `useVideoPlayer.ts` hook — **Never used by any screen.**

**Two competing video APIs**: `expo-av` (in use) and `expo-video` (unused component).

---

## 7. Current Pose Estimation Library

### Intended: `react-native-executorch` v0.9.0
- **NOT in `package.json`** — only referenced in docs and adapter code
- `ExecuTorchAdapter` class exists but `analyzeFrame()` **always returns `null`**
- Requires a native Development Build (not compatible with Expo Go)

### Actual: `MockPoseEngine`
- `createPoseEngine()` **always returns `MockPoseEngine`**
- Generates synthetic golf swing data with phase-based animation model

**Status: ALL pose data is synthetic/fake. No real pose estimation exists.**

---

## 8. Pose Estimation Architecture

**JavaScript-based mock system.** No native modules, no WebView, no server.

```
createPoseEngine() → MockPoseEngine (always)
  ↓
MockPoseEngine.analyzeFrame(imageUri, timestamp, frameIndex)
  ↓
generateSwingPose(timestamp) — pure JS math
  ↓
Returns PoseFrame with Map<LandmarkID, PoseLandmark>
```

The mock engine:
- Uses COCO 17-keypoint format
- Hardcoded base pose for a standing golfer (normalized 0-1 coords)
- Swing phase model based on `timestamp / 3.0` ratio:
  - 0.0–0.2: Address (tiny noise ±0.003)
  - 0.2–0.5: Backswing (upper body rotation)
  - 0.5–0.7: Downswing + Impact (hip lateral shift)
  - 0.7–1.0: Follow-through
- Confidence: 0.85–0.97, lower for wrists/ankles
- Source dimensions hardcoded: 1080×1920
- Simulates 10–30ms processing delay

---

## 9. Current Frame Extraction Strategy

### `frameExtractor.ts`
- Uses `expo-video-thumbnails` `getThumbnailAsync()`
- Calculates timestamps at `ANALYSIS_FRAME_RATE` intervals
- Quality: 0.8 JPEG compression
- Sequential extraction (no parallelism)
- Gracefully skips failed frames
- Returns `FrameData[]` with `imageUri`, `timestamp`, `index`

**Status: REAL** — extracts actual video frames as thumbnails.

---

## 10. Current Analyzed FPS

**15 FPS** (hardcoded in `config.ts` as `ANALYSIS_FRAME_RATE`).

For a 5-second video: ~75 frames sampled.

---

## 11. Current PoseFrame Model

```typescript
interface PoseFrame {
  readonly timestamp: number;        // seconds from video start
  readonly frameIndex: number;       // analysis sequence index
  readonly landmarks: ReadonlyMap<LandmarkID, PoseLandmark>;
  readonly averageConfidence: number; // 0–1
  readonly detectedCount: number;
  readonly missingCount: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly processingTimeMs: number;
}

interface PoseLandmark {
  readonly id: LandmarkID;
  readonly x: number;       // normalized 0–1
  readonly y: number;       // normalized 0–1
  readonly z?: number;
  readonly visibility: number;  // 0–1
  readonly confidence: number;  // 0–1
}

enum LandmarkID { // COCO 17-keypoint
  nose=0, leftEye=1, rightEye=2, leftEar=3, rightEar=4,
  leftShoulder=5, rightShoulder=6, leftElbow=7, rightElbow=8,
  leftWrist=9, rightWrist=10, leftHip=11, rightHip=12,
  leftKnee=13, rightKnee=14, leftAnkle=15, rightAnkle=16
}
```

---

## 12. Current PoseTimeline Model

```typescript
class PoseTimeline {
  readonly frames: readonly PoseFrame[];
  readonly averageConfidence: number;
  readonly reliableFrameCount: number;
  readonly totalFrameCount: number;
  readonly timeRange: { start: number; end: number };
  readonly durationMs: number;
  readonly analysisFrameRate: number;

  frameAtTime(time: number): PoseFrame | null;    // binary search
  framesInRange(start, end): PoseFrame[];
  trajectory(landmarkId): TrajectoryPoint[];
  landmarkAvailability(landmarkId): number;       // 0–1 ratio
}
```

Built via `buildTimeline()` from `timelineBuilder.ts`.

---

## 13. Existing Metrics

### Three Phase 0 Metrics

| Metric | ID | Unit | Normalizer |
|--------|----|------|------------|
| Head Movement | `headMovement` | `shoulder_widths` | Average shoulder width |
| Torso Angle Change | `torsoAngleChange` | `degrees` | N/A (raw degrees) |
| Hip Movement Proxy | `hipMovementProxy` | `hip_widths` | Average hip width |

All metrics:
- Require ≥3 reliable frames
- Use first N frames (10% of total, min 3, max 10) as reference position
- Calculate confidence via 6-factor `ConfidenceEngine`
- Return `MetricResult` with `rawValue`, `normalizedValue`, `confidence`, `status`, `warnings`, `calculationExplanation`, `limitations`

### Score Formula (`calculateSwingScore()`)
```
avgDisplacement = (head + torso + hip) / 3
rawScore = 10 × (1 - avgDisplacement × 1.5)
score = clamp(round(rawScore, 1), 1.0, 10.0)
```

> **⚠️ Issue:** Averages values with different units (shoulder_widths, degrees, hip_widths) which is mathematically meaningless.

---

## 14. Current Confidence Logic

### Six-Factor Model (`ConfidenceEngine.ts`)

| Factor | Weight | Source |
|--------|--------|--------|
| Landmark Visibility | 0.25 | Average availability of required landmarks |
| Pose Confidence | 0.25 | Timeline average confidence |
| Temporal Coverage | 0.20 | Reliable frames / total frames |
| Temporal Stability | 0.15 | Inverse of nose position jitter |
| Normalizer Reliability | 0.10 | Inverse of normalizer CV |
| Golfer Size in Frame | 0.05 | Bounding box ratio |

Composite = weighted sum, clamped [0, 1].

Warnings generated for factors below thresholds.

**Status: REAL logic** but always applied to **fake pose data**.

---

## 15. Existing Persistence

| Data | File | Format |
|------|------|--------|
| Score History | `swing_history.json` | `{ scores: number[] }` |
| Daily Streak | `streak_data.json` | `{ streakCount, lastActiveDate }` |
| Friend Data | `friend_data.json` | `{ myCode, friends: Friend[] }` |

Uses `expo-file-system/legacy` writing to `documentDirectory`.

**NOT persisted**: AnalysisResult, PoseTimeline, VideoSource — all lost on app restart.

---

## 16. Existing Mock/Placeholder Data

| Item | Status | Details |
|------|--------|---------|
| **MockPoseEngine** | MOCK | ALL pose data is synthetic. No real detection. |
| **Friend names** | MOCK | Random from `['Alex','Taylor','Casey','Sam','Jordan','Morgan']` |
| **Friend streaks** | HARDCODED | Always `streak: 1` |
| **Practice tips** | HARDCODED | 5 tips, rotated by day-of-week |
| **Drills checklist** | HARDCODED | 3 items, checkbox not persisted |
| **"Record Swing"** | PLACEHOLDER | Disabled, labeled "(Phase 1)" |
| **Tiger/Nelly filter** | LEGACY | Filters out "Tiger Woods"/"Nelly Korda" from saved friends |
| **Version string** | HARDCODED | "Phase 0 • v0.1.0" |

### What is REAL
- Video import from device gallery ✓
- Frame extraction from real video ✓
- Video playback ✓
- Video metadata extraction ✓
- Score history persistence ✓
- Streak system (with persistence) ✓
- Friend code generation (local) ✓
- All geometry/math/coordinate utilities ✓
- All confidence calculations (logic) ✓
- All metric calculations (logic) ✓
- Skeleton overlay rendering ✓
- JSON export to clipboard ✓
- Debug console ✓

---

## 17. Existing Unit Tests

**106 tests across 7 test files — ALL PASSING**

| Test File | Tests | What's Tested |
|-----------|-------|---------------|
| `coordinates.test.ts` | 17 | pixelToNormalized, normalizedToDisplay, mirrorX/Y, aspectFit, roundTrip |
| `geometry.test.ts` | 23 | distance, midpoint, centroid, normalizedDistance, angles, jitter, boundingBox, stats |
| `confidence.test.ts` | 12 | compositeConfidence, confidenceWarnings, reliabilityFromConfidence |
| `headMovement.test.ts` | 7 | Head center calc, normalization, reference position (tests building blocks, NOT calculateHeadMovement) |
| `hipProxy.test.ts` | 7 | Hip midpoint, normalization, edge cases (tests building blocks, NOT calculateHipMovementProxy) |
| `torsoAngle.test.ts` | 6 | Angle calculation, change tracking (tests angleFromVertical, NOT calculateTorsoAngleChange) |
| `timeline.test.ts` | 8 | Frame construction, lookup, trajectory, availability (implements logic inline, does NOT test PoseTimeline class) |

### Critical Test Gaps
- **None of the actual metric functions** (`calculateHeadMovement`, `calculateTorsoAngleChange`, `calculateHipMovementProxy`) are tested
- **PoseTimeline class** is never instantiated in tests
- **calculateAllMetrics()** is untested
- **calculateSwingScore()** is untested
- All `src/utils/math.ts` functions (8 functions) are untested
- No shared test fixtures

---

## 18. Existing Performance Issues

- Frame extraction is **sequential** — 150 frames = 150 sequential async calls
- Pose processing is **sequential** — no parallelism
- Player screen fires frequent re-renders via `onPlaybackStatusUpdate`
- Streak checking runs every **5 seconds** via `setInterval` (wasteful)
- `ProgressBar` is **not animated** (static width)
- No `React.memo` or `useMemo` on expensive renders

---

## 19. Existing Android Limitations

- Requires **Dev Build** (not Expo Go) for real pose estimation
- ExecuTorch requires native modules not yet integrated
- Android 13+ target
- EAS Build required (no local Android SDK)
- `expo-video-thumbnails` performance untested on low-end Android

---

## 20. Existing iOS Limitations

- Requires **Dev Build** for real pose estimation
- iOS 17+ target
- `react-native-executorch` iOS compatibility not validated
- Apple App Store review for camera/photo permissions needed
- No physical iOS device testing documented

---

## Unused Dependencies

These packages are in `package.json` but **never imported** in source code:
- `react-native-reanimated` (4.5.0)
- `@shopify/react-native-skia` (2.6.9)
- `expo-glass-effect` (~57.0.0)
- `react-native-worklets` (0.10.0)
- `expo-video` (~57.0.0) — only in unused `VideoPlayer.tsx` component

---

## Summary

Phase 0 is a **well-structured technical prototype** with:
- Clean TypeScript architecture
- Real video import and frame extraction
- Comprehensive type system
- Working confidence engine logic
- 106 passing unit tests
- Functional persistence for scores, streaks, and friends

**But all pose estimation data is synthetic.** The core analysis pipeline processes real video frames but generates fake poses, which means all metrics, confidence values, and scores are based on mock data. The path to real pose estimation exists (ExecuTorch adapter stub) but has not been activated.
