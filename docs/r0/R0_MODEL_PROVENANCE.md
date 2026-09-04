# R0 Model Provenance

This document tracks the provenance of the MediaPipe Pose Landmarker models used in SwingSwang.

## Model Details

* **Model:** MediaPipe Pose Landmarker v1 (float16)
* **SDK:** `com.google.mediapipe:tasks-vision:1.0.0`
* **License:** Apache 2.0 (Google MediaPipe)
* **Download timestamp:** 2026-09-04T14:57+02:00
* **Source:** Google Cloud Storage (version-locked `/1/`, not `/latest/`)

## File Metadata

| Variant | Filename | Size (bytes) | SHA-256 | Source URL |
|---------|----------|-------------|---------|------------|
| **Lite** | `pose_landmarker_lite.task` | 5,777,746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` | [Link](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) |
| **Full** | `pose_landmarker_full.task` | 9,398,198 | `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1` | [Link](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task) |
| **Heavy** | `pose_landmarker_heavy.task` | 30,664,242 | `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b` | [Link](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task) |

## Integrity Verification

Checksums are hardcoded in `scripts/download-models.sh`. The script:

1. Downloads from version-locked URLs (not `/latest/`)
2. Verifies SHA-256 after download — aborts on mismatch
3. Is idempotent — skips download if file exists with correct checksum
4. Works on macOS (shasum) and Linux (sha256sum)

## Access in EAS Build

Models are excluded from Git (`.gitignore`). The `eas-build-post-install` hook in `package.json` runs `./scripts/download-models.sh` during EAS build:

1. Runs after npm install and Expo prebuild, before native compilation
2. Downloads models to `android/app/src/main/assets/`
3. Verifies checksums — build fails if any model is corrupted or silently changed

The build **never** accepts an undocumented model file change.

## R0 Development Build

All 3 variants (Lite, Full, Heavy) are included in the R0 Development Build for benchmarking.

Production builds will include **only** the benchmark winner to minimize APK size.

## Previous Decisions

> Ultralytics YOLO Enterprise License is **not used**. Pricing was offert-based and is no longer relevant. YOLO has been fully removed from the codebase (AGPL-3.0 incompatibility).
