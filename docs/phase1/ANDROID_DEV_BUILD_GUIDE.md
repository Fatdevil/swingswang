# Android Dev Build Guide — Swing Swang

## Prerequisites

1. **Android device** with USB debugging enabled
2. **Android Studio** installed (for SDK tools)
3. **Java 17+** (bundled with Android Studio)
4. **EAS CLI**: `npm install -g eas-cli`
5. **Expo account**: `eas login`

## Option A: EAS Cloud Build (Recommended)

The easiest way — builds on Expo's servers, no local Android SDK needed.

```bash
# From SwingSwang/ directory:
eas build --platform android --profile development
```

This creates a `.apk` file you install on your Android device.

### First Time Setup
```bash
# Login to Expo
eas login

# Configure project (already done — eas.json exists)
eas build:configure
```

### Install on Device
1. Build completes → download `.apk` URL from terminal
2. Transfer to phone and install
3. Allow "Install from unknown sources" if prompted

## Option B: Local Build

Requires Android SDK, Java 17, and ~10 min build time.

```bash
# Generate native Android project
npx expo prebuild --platform android

# Build and run on connected device
npx expo run:android
```

### Troubleshooting Local Build
- **ANDROID_HOME not set**: Set environment variable to Android SDK path
- **No device found**: Enable USB debugging, run `adb devices`
- **Build fails**: Check Java version: `java --version` (needs 17+)

## After Installing Dev Build

1. Start Metro bundler on your PC:
   ```bash
   npx expo start --dev-client
   ```

2. Open the app on your phone
3. It should connect to Metro and load the JS bundle
4. ExecuTorch will initialize and load the YOLO26N_POSE model

## Verifying Real Pose Inference

1. Import a golf swing video (Home → + → Analyze Swing)
2. Check Debug tab for:
   - `ExecuTorch initialized with ExpoResourceFetcher`
   - `Loading YOLO26N_POSE model...`
   - `ExecuTorch model loaded in Xms`
3. Frame analysis should show real landmark positions that **change with the video content**

## Key Files

| File | Purpose |
|------|---------|
| `eas.json` | EAS Build profiles (development, preview, production) |
| `app.json` | Expo config with plugins |
| `metro.config.js` | Asset extensions for .pte model files |
| `src/features/pose/executorchInit.ts` | ExecuTorch initialization |
| `src/features/pose/ExecuTorchPoseAdapter.ts` | Real pose engine adapter |
| `src/features/pose/PoseEngineFactory.ts` | Engine selection (MOCK vs REAL) |

## License Notes

> ⚠️ **YOLO26N_POSE model weights are AGPL-3.0 licensed (Ultralytics).**
> For commercial closed-source distribution, an Enterprise License from
> Ultralytics is required. See `docs/phase1/P1_POSE_ARCHITECTURE_DECISION.md`.
>
> The `react-native-executorch` runtime is MIT licensed — no restrictions.
