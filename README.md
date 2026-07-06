# Swing Swang

**AI-Powered Golf Swing Analysis — Phase 0 Technical Proof of Concept**

A cross-platform mobile application that analyzes golf swings using real pose estimation to measure body movement patterns.

## What This Is

Phase 0 proves the core technical pipeline:

```
Open app → Import video → Play video → Extract frames → Run pose estimation
→ Show skeleton overlay → Calculate metrics → Display real results
```

Every displayed result comes from actual video analysis. No fake AI. No hard-coded scores.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo |
| Language | TypeScript |
| Navigation | Expo Router |
| Pose Estimation | ExecuTorch (device) / Mock (development) |
| Video Playback | expo-av |
| Video Frames | expo-video thumbnails |
| Skeleton Overlay | react-native-svg |
| State | React Context + useReducer |

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

### Development (Windows)

```bash
npx expo start
```

This starts the Expo dev server. For UI development, use:
- **Web preview**: Press `w` — limited functionality but great for layout work
- **Android device**: Install EAS development build APK, then scan QR code

### Build for Android (requires Expo account)

```bash
npx eas-cli build --platform android --profile development
```

This builds in the cloud — no Android Studio needed.

## Project Structure

```
SwingSwang/
├── app/              # Expo Router screens (Home, Player, Results, Debug)
├── src/
│   ├── components/   # Reusable UI components
│   ├── features/     # Core logic modules
│   │   ├── video/    # Video import + frame extraction
│   │   ├── pose/     # Pose estimation engine (adapter pattern)
│   │   ├── timeline/ # Timestamped pose data
│   │   ├── metrics/  # Movement measurements (3 metrics)
│   │   ├── confidence/ # Reliability scoring
│   │   └── analysis/ # Pipeline orchestration + export
│   ├── hooks/        # React hooks
│   ├── types/        # TypeScript type definitions
│   ├── utils/        # Pure geometry, math, coordinates
│   └── constants/    # Theme, config, skeleton connections
├── tests/            # Jest tests
└── docs/             # Technical documentation
```

## Three Phase 0 Metrics

1. **Head Movement** — Normalized head displacement from address position (shoulder-width units)
2. **Torso Angle Change** — Maximum torso lean change from vertical (degrees)
3. **Hip Movement Proxy** — Normalized lateral hip displacement (hip-width units)

Each metric includes confidence scoring and honest limitation documentation.

## Testing

```bash
npx jest
```

7 test files covering geometry, coordinates, metrics, confidence, and timeline.

## Documentation

| Document | Description |
|----------|-------------|
| [PHASE_0_TECHNICAL_DECISIONS](docs/PHASE_0_TECHNICAL_DECISIONS.md) | Why we chose each technology |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System architecture |
| [KNOWN_LIMITATIONS](docs/KNOWN_LIMITATIONS.md) | Honest technical limitations |

## What Phase 0 Does NOT Include

- Final swing scores
- Swing phase detection
- Coaching feedback
- Drill recommendations
- Cloud processing
- Authentication
- Social features

See [PHASE_1_RECOMMENDATIONS](docs/PHASE_1_RECOMMENDATIONS.md) for the roadmap.

## Privacy

All video processing happens on-device. No video data is uploaded to external servers.
