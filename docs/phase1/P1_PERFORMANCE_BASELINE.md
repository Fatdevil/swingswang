# P1 Performance Baseline

> **Date:** 2026-07-07  
> **Platform:** Windows development (no physical device)  
> **Pose Engine:** MockPoseEngine v1.0.0  
> **Analysis FPS:** 15

---

## Important Note

**These benchmarks reflect the MockPoseEngine**, not real pose estimation.
The MockPoseEngine generates synthetic data with a simulated 10–30ms delay per frame.
Real ExecuTorch inference times will differ significantly.

This baseline establishes the **pipeline overhead** (frame extraction, timeline construction,
metric calculation) separate from pose inference performance.

---

## Measured Pipeline Characteristics

### Frame Extraction
- **Method:** `expo-video-thumbnails` → `getThumbnailAsync()` per frame
- **Strategy:** Sequential (no parallelism)
- **Quality:** JPEG 0.8
- **Analysis FPS:** 15 (configurable via `ANALYSIS_FRAME_RATE`)
- **Frames per second of video:** 15

### Pose Processing
- **Method:** Sequential per-frame processing
- **Mock delay:** 10–30ms per frame (simulated)
- **No worker threads or parallelism**
- **Results sorted by timestamp after processing**

### Timeline Construction
- **PoseTimeline creation:** O(n log n) sort + O(n) statistics
- **frameAtTime lookup:** O(log n) binary search
- **trajectory extraction:** O(n) per landmark

### Metric Calculation
- **3 metrics calculated:** headMovement, torsoAngle, hipProxy
- **Each metric:** O(n) pass over timeline frames
- **Confidence calculation:** O(n) per metric (6 factors)

---

## Expected Performance for Typical Videos

| Video Duration | Source FPS (est.) | Sampled FPS | Frames Extracted | Typical Reliable % | Pipeline Components |
|---------------|-------------------|-------------|------------------|--------------------|--------------------|
| 3s | 30–60 | 15 | ~45 | 90–100% (mock) | Extract + Pose + Metrics |
| 5s | 30–60 | 15 | ~75 | 90–100% (mock) | Extract + Pose + Metrics |
| 10s | 30–60 | 15 | ~150 | 90–100% (mock) | Extract + Pose + Metrics |

### Estimated Timing Breakdown (MockPoseEngine, ~5s video)

| Stage | Estimated Time | Notes |
|-------|---------------|-------|
| Frame Extraction | 2–5s | Sequential `getThumbnailAsync()` × 75 calls |
| Pose Processing (Mock) | 1.5–2.5s | 75 × (10–30ms simulated delay) |
| Timeline Build | <10ms | Sort + stats |
| Metric Calculation | <50ms | 3 metrics × O(n) |
| Result Assembly | <5ms | Warning aggregation |
| **Total (Mock)** | **~4–8s** | Dominated by extraction + mock delay |

---

## Performance Concerns for Phase 1

### Critical (will affect real usage)
1. **Sequential frame extraction** — N sequential async calls. Batching could help.
2. **Sequential pose processing** — Single-threaded JS. Real ExecuTorch inference will be much slower than mock (expect 50–200ms per frame on device).
3. **JS Bridge traffic** — Each frame round-trips through the JS bridge for `getThumbnailAsync()` and potentially for pose inference.
4. **UI blocking risk** — The analysis pipeline runs on the main JS thread. Long pose inference could block UI updates.

### Moderate
5. **Memory pressure** — 75+ JPEG thumbnails in the file system simultaneously
6. **Player re-renders** — `onPlaybackStatusUpdate` fires frequently during playback
7. **No cancellation** — Pipeline cannot be cancelled mid-processing

### Low
8. **Streak polling** — 5-second interval unnecessarily frequent
9. **ProgressBar not animated** — Static width updates
10. **Unused dependencies** — reanimated, skia, worklets add to bundle size

---

## Baseline Measurements (Development Environment)

> ⚠️ Actual device measurements require deploying to a physical Android/iOS device.
> The following measurements are from the MockPoseEngine on Windows development.

Since this is a Windows dev environment with MockPoseEngine, actual timing benchmarks
on a physical device are not available. The first real benchmark should be taken when
ExecuTorch integration is activated on a physical device.

**Phase 1 Action Items:**
1. Establish real device benchmarks once pose estimation is activated
2. Measure actual ExecuTorch inference time per frame
3. Measure UI responsiveness during analysis
4. Measure memory usage patterns
5. Test with 30fps and 60fps source videos
