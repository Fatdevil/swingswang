# Pose Estimation License Audit + Benchmark Framework

> **Status:** IN PROGRESS  
> **Date:** 2026-07-07  
> **Decision:** PENDING — requires physical device benchmarks

---

## CRITICAL: License Gate

> [!CAUTION]
> Do NOT approve any model for commercial product use based only on the runtime license.
> The **runtime** (ExecuTorch, MediaPipe framework) and the **model weights** may have
> different licenses. Record the exact license of every candidate model.

---

## Candidate 1: ExecuTorch + YOLO Pose Models

### Runtime License
| Component | License | Commercial Use |
|-----------|---------|----------------|
| ExecuTorch Runtime | BSD-style (PyTorch) | ✅ Permitted |
| react-native-executorch | MIT (Software Mansion) | ✅ Permitted |

### Model Weight Licenses — MUST VERIFY

| Model | Source | License | Commercial Use | Notes |
|-------|--------|---------|----------------|-------|
| YOLOv8n-pose | Ultralytics | AGPL-3.0 | ❌ **REQUIRES COMMERCIAL LICENSE** | AGPL requires source disclosure or Ultralytics Enterprise License |
| YOLOv8s-pose | Ultralytics | AGPL-3.0 | ❌ **REQUIRES COMMERCIAL LICENSE** | Same as above |
| YOLO11n-pose | Ultralytics | AGPL-3.0 | ❌ **REQUIRES COMMERCIAL LICENSE** | Same as above |
| YOLOv5s6-pose | Ultralytics | AGPL-3.0 | ❌ **REQUIRES COMMERCIAL LICENSE** | Same as above |
| MoveNet Lightning | Google | Apache 2.0 | ✅ Permitted | TF Hub, COCO 17-keypoint |
| MoveNet Thunder | Google | Apache 2.0 | ✅ Permitted | TF Hub, COCO 17-keypoint, higher accuracy |
| ViTPose-S | ViTAE | Apache 2.0 | ✅ Permitted | Transformer-based, COCO 17-keypoint |
| RTMPose-t/s | OpenMMLab | Apache 2.0 | ✅ Permitted | Fast, COCO 17-keypoint |

> [!WARNING]
> **All Ultralytics YOLO models are AGPL-3.0.** This is a copyleft license that requires
> either: (a) releasing the entire application as open source, or (b) purchasing an
> Ultralytics Enterprise License. For a commercial mobile app, YOLO models require
> a paid license or must be replaced with Apache 2.0 / MIT alternatives.

### Commercially Safe ExecuTorch Options
1. **MoveNet** (Apache 2.0) — convert to ExecuTorch format
2. **RTMPose** (Apache 2.0) — convert to ExecuTorch format
3. **ViTPose** (Apache 2.0) — convert to ExecuTorch format

### react-native-executorch Built-in Models
- `react-native-executorch` provides pre-packaged YOLO pose models
- These are **AGPL-3.0 licensed** via Ultralytics
- Using the npm package's built-in models does NOT change the model license
- To use ExecuTorch commercially: bring your own Apache 2.0 model weights

---

## Candidate 2: MediaPipe Pose Landmarker

### Runtime + Model License
| Component | License | Commercial Use |
|-----------|---------|----------------|
| MediaPipe Framework | Apache 2.0 | ✅ Permitted |
| MediaPipe Pose Landmarker model | Apache 2.0 | ✅ Permitted |
| BlazePose model weights | Apache 2.0 | ✅ Permitted |

### Key Advantages
- **33 landmarks** (vs 17 COCO) — includes wrists, fingers, toes, heel
- **Single license** covers both runtime and model weights
- Google-maintained with ongoing updates
- Official task API with confidence scores

### React Native Integration Options
| Option | Status | Notes |
|--------|--------|-------|
| `react-native-mediapipe` | Community | Check compatibility with Expo SDK 57 |
| Custom Expo Module wrapping MediaPipe | Build | Full control, clean API |
| `@mediapipe/tasks-vision` (JS/WASM) | Official | Runs in WebView — performance concern |

---

## Candidate 3: TensorFlow Lite + MoveNet

### License
| Component | License | Commercial Use |
|-----------|---------|----------------|
| TensorFlow Lite Runtime | Apache 2.0 | ✅ Permitted |
| MoveNet Lightning/Thunder | Apache 2.0 | ✅ Permitted |

### React Native Integration
| Option | Status | Notes |
|--------|--------|-------|
| `react-native-fast-tflite` | Community (Marc Rousavy) | Frame processor based |
| Custom Expo Module | Build | Wraps TFLite C API |

---

## Benchmark Framework

### Required Measurements (per candidate)

For each pose engine candidate, measure on a **real Android device**:

| Metric | Method |
|--------|--------|
| Inference time per frame (ms) | `performance.now()` around `analyzeFrame()` |
| P50 / P95 / P99 inference time | Distribution across 100+ frames |
| Landmark count | Count non-null landmarks per frame |
| Average landmark confidence | Mean confidence across frames |
| Confidence distribution | Histogram of per-landmark confidence |
| Landmark stability | Frame-to-frame jitter (normalized) |
| Memory usage (MB) | `performance.memory` or native profiler |
| Peak memory during analysis | Monitor throughout pipeline |
| Model load time (ms) | Time to initialize engine |
| Total pipeline time (s) | For a 5-second, 15fps video |
| UI thread blocking | Measure main thread frame drops |

### Test Videos (Initial Smoke Test — 3 swings)
> 3 swings is a smoke test only. Expand before architecture lock.

| # | View | Handedness | Club | Duration | Notes |
|---|------|-----------|------|----------|-------|
| 1 | DTL | Right | 7-Iron | ~4s | Standard conditions |
| 2 | FO | Right | Driver | ~5s | Standard conditions |
| 3 | DTL | Left | Wedge | ~3s | Left-handed validation |

### Expanded Benchmark (Before Architecture Lock)
Add 10+ additional videos covering:
- Various lighting conditions
- Different golfer body types
- Different distances from camera
- 30fps and 60fps source video
- Portrait and landscape orientation
- Multiple skill levels

### Benchmark Output Format
```json
{
  "candidate": "mediapipe_pose_landmarker",
  "modelLicense": "Apache-2.0",
  "runtimeLicense": "Apache-2.0",
  "commercialUseApproved": true,
  "device": {
    "platform": "android",
    "model": "Pixel 7",
    "androidVersion": "14"
  },
  "results": {
    "inferenceTimeMs": {
      "p50": 45,
      "p95": 62,
      "p99": 78,
      "mean": 48
    },
    "landmarkCount": 33,
    "avgConfidence": 0.82,
    "memoryPeakMB": 180,
    "modelLoadTimeMs": 1200,
    "uiBlocking": false,
    "totalPipelineTimeS": 4.2
  },
  "testVideos": [
    { "id": "smoke_1_dtl_right", "framesProcessed": 60, "avgConfidence": 0.85 }
  ]
}
```

---

## Decision Criteria

The pose engine will be selected based on:

| Priority | Criterion | Weight |
|----------|-----------|--------|
| 1 | **License** — must be commercially usable without copyleft | BLOCKER |
| 2 | **Landmark quality** — confidence, stability, coverage | High |
| 3 | **Performance** — inference time acceptable for mobile | High |
| 4 | **Integration** — works with Expo SDK 57 / Dev Build | High |
| 5 | **Landmark count** — more = better (33 > 17) | Medium |
| 6 | **Memory** — stays within mobile limits | Medium |
| 7 | **Cross-platform** — Android + iOS | Medium |
| 8 | **Maintenance** — actively maintained library | Low |

### Preliminary Assessment (Pre-Benchmark)

| Candidate | License OK | Integration | Landmarks | Risk |
|-----------|-----------|-------------|-----------|------|
| ExecuTorch + YOLO | ❌ AGPL model | npm package exists | 17 | **License blocker** |
| ExecuTorch + MoveNet | ✅ Apache 2.0 | Custom model load | 17 | Model conversion |
| MediaPipe Pose | ✅ Apache 2.0 | Custom module needed | 33 | Integration effort |
| TFLite + MoveNet | ✅ Apache 2.0 | Community package | 17 | Maintenance risk |

> [!IMPORTANT]
> **The default `react-native-executorch` YOLO pose models are AGPL-3.0 and cannot be
> used in a commercial product without a paid Ultralytics license.** This was documented
> in Phase 0 as the chosen approach but the license was not evaluated. This must be
> resolved before architecture lock.

---

## Next Steps

1. [ ] Build Expo Dev Build for Android
2. [ ] Install and test each commercially-licensed candidate
3. [ ] Run smoke test (3 videos)
4. [ ] Expand benchmark (10+ videos)
5. [ ] Record results in `benchmarks/pose-engine-comparison.json`
6. [ ] Update `P1_POSE_ARCHITECTURE_DECISION.md` with final decision
