# R0 MediaPipe Android Device Verification

**Status: PENDING PHYSICAL RUN** — All module defects resolved; awaiting physical device test.

## Summary of Code Fixes (Sept 2026)
Before conducting the physical test, the following critical code-level defects identified in the Gate Review were addressed:
1. **Bitmap Native Memory Leak at 0°**: In `MediaPipePoseModule.kt`, decoded frame bitmaps are now unconditionally recycled in a `finally` block, preventing OOM crashes during video decoding.
2. **Double-Rotation Bug**: Removed manual `applyRotation()` on frame bitmaps prior to feeding into `detectForVideo`. Frame rotation is now handled cleanly by MediaPipe's `ImageProcessingOptions` on GPU/tensors.
3. **EXIF on `content://` URIs**: `readExifRotation` now queries `ContentResolver.openInputStream` for `content://` URIs, properly preserving image orientation when selecting from gallery.
4. **Pipeline Integration**: `PoseEngine` interface and `analysisPipeline.ts` now support `processVideo()`, routing video analysis directly to the native `MediaCodec` + `MediaPipe` hardware pipeline with graceful fallback for platforms without native video decoding.

## Device Information

| Field | Value |
|-------|-------|
| Device model | Samsung Galaxy A52s 5G (SM-A528B) / Target Device |
| Android version | Android 13 / 14 (One UI) |
| App commit | `HEAD` |
| EAS Build ID | Local / EAS Cloud Build |
| MediaPipe SDK | `com.google.mediapipe:tasks-vision:1.0.0` |
| Model variant | Lite / Full / Heavy |
| Model SHA-256 | See [R0_MODEL_PROVENANCE.md](R0_MODEL_PROVENANCE.md) |

## Test Steps and Results

| # | Test | Expected | Actual | Status |
|---|------|----------|--------|--------|
| 1 | Dev Build installs and starts | App launches | | PENDING |
| 2 | `isAvailable()` returns true | `true` for Lite | | PENDING |
| 3 | Image → 33 landmarks | 33 content-dependent landmarks | | PENDING |
| 4 | Video → multiple timestamped frames | >1 frames with timestamps | | PENDING |
| 5 | Timestamps strictly monotonic | Each ts > previous ts | | PENDING |
| 6 | Pose overlay follows person | Visual verification | | PENDING |
| 7 | Two different inputs → different data | Landmark values differ | | PENDING |
| 8 | Pipeline reports MediaPipe + REAL | `engineMode: REAL` | | PENDING |
| 9 | Failed inference → no mock fallback | Error thrown, not empty data | | PENDING |
| 10 | Missing model → clear error | Structured error message | | PENDING |
| 11 | All existing tests green | 415+ tests pass | 415 passed (36 suites) | ✅ PASS |

## Verification Execution Guide

1. **Build the Android Development Client**:
   ```bash
   # Make sure models are downloaded
   ./scripts/download-models.sh

   # Option A: Local build (requires Android Studio / SDK)
   npx expo run:android

   # Option B: EAS Cloud build
   eas build --platform android --profile development
   ```

2. **Run Verification on Device**:
   - Launch the development build on the device.
   - Navigate to `/r0-verify` screen.
   - Run **Step 1: Check Availability**.
   - Run **Step 2: Test Image Detection** with a sample photo from the gallery.
   - Run **Step 3: Test Video Processing** with a golf swing video.
   - Click **Export Report** to copy or share the JSON diagnostics.
   - Fill in the benchmark tables below with the reported values.

## Frame and Landmark Counts (Benchmark)

| Metric | Value |
|--------|-------|
| Video duration (ms) | |
| Decoded frames | |
| Processed frames | |
| Sampling skipped | |
| Decode dropped | |
| Landmarks per frame | 33 |
| World landmarks per frame | 33 |

## Inference Timing (Benchmark)

| Metric | Value |
|--------|-------|
| P50 inference (ms) | |
| P95 inference (ms) | |
| Average inference (ms) | |
| Total video processing (ms) | |

## Known Issues and Limitations

_To be filled after device testing._

## Overall Status

**PENDING PHYSICAL RUN** — All code-level gating items are resolved. Block 2 will be officially signed off once tests 1–10 are executed on the physical device and recorded here.
