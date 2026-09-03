# Swing Swang

**AI-Powered Golf Swing Analysis**

A cross-platform mobile app that analyzes golf swings using on-device pose estimation to measure biomechanical movement patterns. All processing happens locally — no cloud, no data upload.

## What It Does

```
Record swing / Import video → Extract frames → Pose estimation → Stabilize data
→ Detect swing events → Quality gate → Calculate 7 metrics → Display results
```

Every displayed result comes from actual video analysis through an 11-stage pipeline. No fake AI. No hard-coded scores.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.86 + Expo SDK 57 |
| Language | TypeScript 6.0 |
| Navigation | Expo Router |
| Pose Estimation | ExecuTorch (device) / Mock (development) |
| Video Playback | expo-video |
| Video Frames | expo-video-thumbnails |
| Camera | expo-camera |
| Skeleton Overlay | react-native-svg |
| State | React Context + useReducer |
| Testing | Jest (288 tests, 24 suites) |

## Getting Started

### Prerequisites

- Node.js 22+
- npm 11+
- Expo CLI: `npx expo` (no global install needed)

### Install

```bash
cd SwingSwang
npm install
```

### Development

```bash
npx expo start
```

This starts the Expo dev server. Options:
- **Web preview**: Press `w` — limited functionality but great for layout work
- **iOS simulator**: Press `i`
- **Android device**: Install EAS development build, then scan QR code

### Native Development Build (required for real pose inference)

```bash
npx eas-cli build --platform android --profile development
npx eas-cli build --platform ios --profile development
```

## Project Structure

```
SwingSwang/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Tab navigation + plus menu
│   ├── index.tsx           # Home dashboard (orchestrator)
│   ├── camera.tsx          # Live camera recording + pose HUD
│   ├── player.tsx          # Video playback with skeleton overlay
│   ├── results.tsx         # Metrics display + export
│   ├── analyze.tsx         # Processing screen
│   ├── debug.tsx           # Dev-only diagnostics (__DEV__ gated)
│   └── plus.tsx            # Quick action placeholder
├── src/
│   ├── components/
│   │   ├── home/           # Dashboard cards (Streak, Score, Friends, Practice, Setup)
│   │   ├── camera/         # Camera overlay + controls
│   │   ├── pose/           # Skeleton overlay, landmark debug
│   │   ├── ui/             # Button, Card, Badge, ProgressBar, MetricResultCard
│   │   └── video/          # Video player, metadata card
│   ├── features/
│   │   ├── analysis/       # 11-stage pipeline orchestration + JSON export
│   │   ├── camera/         # Camera readiness heuristics
│   │   ├── confidence/     # Multi-stage confidence scoring
│   │   ├── events/         # Swing phase detection (address, backswing, impact, follow-through)
│   │   ├── metrics/        # 7 biomechanical metrics + registry pattern
│   │   ├── pose/           # Pose engine (adapter pattern: ExecuTorch / Mock)
│   │   ├── quality/        # Video quality gate (4 checks)
│   │   ├── stabilization/  # 4-stage pose data cleanup
│   │   ├── timeline/       # Timestamped pose data management
│   │   └── video/          # Video import + frame extraction
│   ├── hooks/              # useAnalysis, useCameraCapture, usePoseOverlay, useVideoPlayer
│   ├── context/            # AnalysisContext (global state)
│   ├── types/              # TypeScript type definitions (v0 + v1 schemas)
│   ├── config/             # Analysis thresholds
│   ├── constants/          # Theme, skeleton connections
│   └── utils/              # Geometry, math, coordinates, streak, score, logger
├── tests/                  # 24 test files, 288 tests, 4543 lines
│   ├── analysis/           # Pipeline integration tests
│   ├── camera/             # Camera readiness tests
│   ├── events/             # Swing event detection + signal extractors
│   ├── metrics/            # 6 metric test files + registry
│   ├── quality/            # Video quality engine
│   ├── stabilization/      # Filter, interpolator, outlier, smoother, stabilizer
│   └── helpers/            # Test fixtures
├── docs/                   # Technical documentation
└── benchmarks/             # Performance baselines
```

## Biomechanical Metrics (7)

| Metric | Unit | Description |
|--------|------|-------------|
| Head Movement | shoulder-widths | Normalized head displacement from address position |
| Torso Angle Change | degrees | Maximum torso lean change from vertical |
| Hip Movement Proxy | hip-widths | Normalized lateral hip displacement |
| Hand Depth | shoulder-widths | Hand movement in depth axis during swing |
| Knee Flex | degrees | Knee flexion angle change through swing phases |
| Pelvis Sway | hip-widths | Lateral pelvis displacement during swing |
| Tempo | ratio | Backswing-to-downswing timing ratio |

Each metric includes confidence scoring, reliability status, and limitation documentation.

## Pipeline Architecture

The analysis pipeline runs 11 stages sequentially:

1. **Video Import** — Load and validate video metadata
2. **Frame Extraction** — Extract frames at configured FPS
3. **Pose Estimation** — Run ExecuTorch/Mock on each frame
4. **Timeline Building** — Build timestamped pose sequence
5. **Pose Stabilization** — 4-stage cleanup (filter → outlier → interpolate → smooth)
6. **Quality Gate** — 4 checks (body visibility, golfer size, pose coverage, video suitability)
7. **Event Detection** — Identify swing phases (address, backswing, transition, downswing, impact, follow-through)
8. **Metric Computation** — Calculate all registered metrics via registry pattern
9. **Confidence Scoring** — Multi-stage confidence (video, pose, events, metrics, overall)
10. **Warning Aggregation** — Collect and deduplicate warnings
11. **Result Assembly** — Build final AnalysisResultV1

## Testing

```bash
npx jest
```

24 test files covering:
- Geometry and coordinate math
- All 7 biomechanical metrics
- Metric registry pattern
- Pose stabilization pipeline (4 stages)
- Swing event detection + signal extractors
- Video quality engine
- Camera readiness heuristics
- Analysis pipeline integration
- Confidence scoring

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System architecture and data flow |
| [KNOWN_LIMITATIONS](docs/KNOWN_LIMITATIONS.md) | Honest technical limitations |
| [PHASE_0_TECHNICAL_DECISIONS](docs/PHASE_0_TECHNICAL_DECISIONS.md) | Original technology choices |
| [Phase 1 docs](docs/phase1/) | Sprint A/B recovery, pose engine audit, performance baseline |

## Privacy

All video processing happens on-device. No video data is uploaded to external servers.
