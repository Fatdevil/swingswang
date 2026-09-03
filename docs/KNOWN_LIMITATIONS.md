# Known Limitations

> Last updated: 2026-09-03

Honest documentation of what this system cannot do, where it may produce inaccurate results, and what constraints exist.

## Pose Estimation

### Mock Engine in Development
- The default development environment runs a **Mock Pose Engine** that generates synthetic pose data
- Real pose inference requires a **Native Development Build** with ExecuTorch linked
- Expo Go cannot run real pose estimation — this is an Expo limitation, not a bug
- Mock data produces plausible but not real biomechanical measurements

### ExecuTorch Constraints
- Requires native build (iOS or Android) — not available in web preview
- Model loading adds ~2-3 seconds to first analysis
- Single-person detection only — cannot handle multiple golfers in frame
- Landmark accuracy degrades with:
  - Low lighting conditions
  - Loose/baggy clothing
  - Partially occluded body (behind objects, cropped frame)
  - Very fast motion (motion blur)

### 2D Limitations
- All pose estimation is **2D only** — no depth information
- "Hand depth" and "pelvis sway" metrics use geometric proxies, not true 3D measurements
- Camera angle significantly affects measurement accuracy (Face On vs Down the Line)
- No correction for lens distortion or perspective

## Video Processing

### Frame Extraction
- Uses `expo-video-thumbnails` which extracts frames at approximate timestamps
- Frame timing is not guaranteed to be exact — ±50ms variance is normal
- Very short videos (< 1 second) may not extract enough frames for reliable analysis
- Maximum tested video length: ~30 seconds; longer videos increase processing time linearly

### Video Quality Gate
- Quality checks are heuristic-based, not ML-based
- False positives: May reject valid videos with unusual camera angles
- False negatives: May accept videos where the golfer is partially out of frame
- Body visibility check requires at least 60% of key landmarks to be detected

## Metrics

### General Accuracy
- All 7 metrics are **relative measurements**, not absolute biomechanical values
- Values are normalized to body proportions (shoulder-width, hip-width) for cross-person comparison
- Accuracy depends heavily on pose estimation quality — low confidence = unreliable metrics
- Metrics marked as `MARGINAL` or `NOT_RELIABLE` should be interpreted with caution

### Specific Metric Limitations

| Metric | Key Limitation |
|--------|---------------|
| Head Movement | Cannot distinguish intentional head turn from lateral sway |
| Torso Angle | 2D projection — does not capture true spinal rotation |
| Hip Proxy | Lateral movement only — no rotation measurement |
| Hand Depth | Proxy based on hand-shoulder distance — not true depth |
| Knee Flex | Requires clear leg visibility — fails with baggy pants |
| Pelvis Sway | 2D proxy — cannot separate sway from rotation |
| Tempo | Depends on accurate swing event detection — unreliable if events are missed |

### Swing Event Detection
- Rule-based heuristics, not ML-based classification
- Requires minimum 10 reliable frames to detect events
- May fail to detect:
  - Very slow practice swings
  - Partial swings (chips, putts)
  - Non-standard swing patterns
- Event timestamps have ±1-2 frame accuracy

## Stabilization Pipeline

- Kalman filter assumes smooth motion — sudden jerky movements may be over-smoothed
- Outlier detection uses z-score thresholds — extreme but valid poses may be incorrectly filtered
- Gap interpolation fills maximum 3 consecutive missing frames — larger gaps are rejected
- Adaptive smoothing strength is tuned for full golf swings — may be suboptimal for short swings

## Camera (Live Recording)

- Auto-capture requires 2 consecutive "READY" snapshots (1.0 second stability) before triggering
- Camera snapshot analysis runs at 2 Hz — fast setup changes may be missed
- Haptic feedback requires native build (`expo-haptics` not available in Expo Go)
- Recording is fixed at 5 seconds maximum
- Camera mode switch (picture → video) has a 200ms delay that may cause brief visual flicker

## Platform & Infrastructure

### No Backend
- All data is local — no cloud sync, no backup
- Friend system is entirely mock/local — friend codes don't connect to real users
- Streak data is stored in AsyncStorage — clearing app data resets everything

### No UI Tests
- 288 tests cover business logic only (features/, utils/)
- Zero component/UI tests — visual regressions are not automatically caught
- No E2E tests (Detox/Maestro)

### Licensing
- YOLO model weights (v8/v11) are licensed under **AGPL-3.0**
- Commercial use requires either:
  - Open-sourcing the entire application under AGPL
  - Purchasing a commercial license from Ultralytics
  - Switching to an Apache 2.0 licensed model (MoveNet, ViTPose, RTMPose)

## Accessibility

- Accessibility labels added to all interactive and informative elements
- Screen reader testing has not been performed on physical devices
- Color contrast ratios have not been formally audited against WCAG 2.1
- No support for reduced motion preferences
- Custom fonts (KG Red Hands) may not scale properly with OS-level font size settings
