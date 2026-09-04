# R0 MediaPipe Android Device Verification

**Status: PENDING** — Awaiting physical device test.

## Device Information

| Field | Value |
|-------|-------|
| Device model | Samsung ??? |
| Android version | ??? |
| App commit | ??? |
| EAS Build ID | ??? |
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
| 11 | All existing tests green | 339+ tests pass | | PENDING |

## Frame and Landmark Counts

| Metric | Value |
|--------|-------|
| Video duration (ms) | |
| Decoded frames | |
| Processed frames | |
| Sampling skipped | |
| Decode dropped | |
| Landmarks per frame | |
| World landmarks per frame | |

## Inference Timing

| Metric | Value |
|--------|-------|
| P50 inference (ms) | |
| P95 inference (ms) | |
| Average inference (ms) | |
| Total video processing (ms) | |

## Known Issues and Limitations

_To be filled after device testing._

## Overall Status

**PENDING** — Block 2 cannot be marked complete until this document shows all tests PASS.
