# Architecture

> Last updated: 2026-09-03

## Overview

SwingSwang uses a **unidirectional data flow** architecture built on React Context + useReducer for state management, with a modular feature system organized around an **11-stage analysis pipeline**.

```
┌─────────────────────────────────────────────────────────┐
│                     App Layer (Expo Router)              │
│  index.tsx │ camera.tsx │ player.tsx │ results.tsx │ ... │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                  Context Layer                           │
│            AnalysisContext + useReducer                   │
│  State: videoSource, status, analysisResult,             │
│         poseTimeline, swingConfig, history, friends       │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                  Feature Layer                           │
│  video/ │ pose/ │ stabilization/ │ quality/ │ events/   │
│  metrics/ │ confidence/ │ analysis/ │ camera/            │
└─────────────────────────────────────────────────────────┘
```

## Analysis Pipeline (11 Stages)

The core of the system is `analysisPipeline.ts`, which orchestrates all feature modules:

```
Video Import
    │
    ▼
Frame Extraction ──── expo-video-thumbnails
    │
    ▼
Pose Estimation ───── PoseEngineFactory → ExecuTorch / Mock
    │
    ▼
Timeline Building ─── PoseTimeline (timestamped frames)
    │
    ▼
Stabilization ─────── PoseFilter → OutlierDetector → Interpolator → Smoother
    │
    ▼
Quality Gate ──────── 4 checks (body, size, coverage, suitability)
    │
    ▼
Event Detection ───── RuleBasedSwingEventDetectorV1
    │
    ▼
Metric Computation ── MetricEngine + Registry (7 metrics)
    │
    ▼
Confidence Scoring ── ConfidenceEngine (video, pose, events, metrics, overall)
    │
    ▼
Warning Aggregation
    │
    ▼
AnalysisResultV1 ──── Final output (schema v1.0)
```

## Key Design Patterns

### Adapter Pattern — Pose Engine
The pose estimation system uses an adapter pattern to swap between real and mock implementations:

```
PoseEngine (interface)
    ├── ExecuTorchPoseAdapter (real, native build)
    └── MockPoseEngine (synthetic data, dev/test)

PoseEngineFactory.createPoseEngine({ mode: 'REAL' | 'MOCK' })
```

The factory checks native module availability at runtime and transparently selects the correct adapter.

### Registry Pattern — Metrics
Metrics are registered in a central registry rather than hard-coded:

```
MetricRegistry
    ├── register(id, factory) — register a metric calculator
    ├── compute(id, data)     — run a single metric
    └── computeAll(data)      — run all registered metrics

defaultRegistry registers:
    headMovement, torsoAngle, hipProxy,
    handDepth, kneeFlex, pelvisSway, tempo
```

Adding a new metric = one factory function + one `register()` call.

### Pipeline Pattern — Stabilization
Pose data cleanup runs through 4 composable stages:

```
Raw PoseFrames
    │
    ▼
PoseFilter ──────── Remove low-confidence frames
    │
    ▼
PoseOutlierDetector ─ Z-score based outlier removal
    │
    ▼
PoseInterpolator ──── Fill gaps (max 3 frames)
    │
    ▼
PoseSmoother ──────── Adaptive Kalman smoothing
    │
    ▼
Clean PoseFrames
```

### Quality Gate Pattern
Video quality is assessed through 4 independent checks that each produce a pass/warn/fail status:

```
VideoQualityEngine
    ├── bodyVisibilityCheck   — Are key landmarks detected?
    ├── golferSizeCheck       — Is the golfer large enough in frame?
    ├── poseCoverageCheck     — Are enough frames reliable?
    └── videoSuitabilityCheck — Is video long enough, right orientation?
```

## State Management

All app state flows through `AnalysisContext`:

```typescript
// Key state shape
{
  videoSource: VideoSource | null,
  status: AnalysisStatus,           // idle → loading → analyzing → complete
  analysisResult: AnalysisResult | AnalysisResultV1 | null,
  poseTimeline: PoseTimeline | null,
  swingConfig: SwingConfig,          // cameraView, handedness, club
  history: number[],                 // past swing scores
  streakCount: number,
  friends: Friend[],
  debugMode: boolean,
}
```

Actions are dispatched via `useReducer` and consumed through the `useAnalysis()` hook.

## Component Architecture

```
Screen Components (app/)
    │
    ├── Home (index.tsx) ─── orchestrator
    │   ├── StreakCard
    │   ├── ScoreCard
    │   ├── FriendsCard (+ modal)
    │   ├── PracticeHub
    │   └── SwingSetupCard
    │
    ├── Camera (camera.tsx)
    │   ├── SwingGuideOverlay (SVG silhouettes)
    │   ├── CameraControls (record button + toggle)
    │   ├── SkeletonOverlay (live pose HUD)
    │   └── useCameraCapture (recording logic hook)
    │
    ├── Player (player.tsx)
    │   ├── VideoPlayer
    │   └── SkeletonOverlay
    │
    └── Results (results.tsx)
        ├── MetricResultCard (per metric)
        ├── ProgressBar (confidence)
        └── Card (stats sections)
```

## Data Flow: Recording a Swing

```
1. User opens Camera screen
2. CameraView streams live preview
3. useCameraCapture manages recording state machine:
     IDLE → SNAPSHOT_LOOP (2Hz) → READY_DETECTED → COUNTDOWN (3s) → RECORDING (5s)
4. Snapshot loop runs pose estimation on camera frames
5. evaluateCameraSnapshot() checks readiness heuristics
6. Hysteresis: 2 consecutive READY snapshots required for stability
7. Auto-capture triggers countdown → recordAsync()
8. Video saved → setVideoSource() → navigate to Home
9. User taps "PROCESS VIDEO"
10. analysisPipeline.run() executes 11 stages
11. Result stored in AnalysisContext
12. User navigates to Results screen
```

## Schema Versioning

Two result schemas coexist:

| Schema | Version | Usage |
|--------|---------|-------|
| `AnalysisResult` | v0.1 | Phase 0 — fixed 3 metrics (MetricsBundle) |
| `AnalysisResultV1` | v1.0 | Phase 1 — dynamic metrics (Record<string, MetricResultV1>) |

Type guard `isAnalysisResultV1()` is used for runtime version detection.
The pipeline currently produces V1 results; the V0 adapter (`phaseZeroAdapters.ts`) maintains backwards compatibility for display components.
