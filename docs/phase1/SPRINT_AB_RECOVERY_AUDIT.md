# Sprint A/B Recovery Audit

**Date**: 2026-07-07
**Auditor**: Antigravity Sprint AB Recovery
**Repository**: SwingSwang (Expo SDK 57, React Native 0.86.0)
**Baseline**: 21 test suites, 271 tests, 0 TypeScript errors

---

## Codex Finding Verification

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | `createPoseEngine()` always returns MockPoseEngine | **CONFIRMED** | ExecuTorchAdapter.ts L241-247: hardcoded `return new MockPoseEngine()` |
| 2 | Real videos receive synthetic pose data | **CONFIRMED** | MockPoseEngine.generateSwingPose() uses Math.random + fixed base positions, ignores imageUri |
| 3 | ExecuTorchAdapter.analyzeFrame() returns null | **CONFIRMED** | L52-54: `return null` with comment "Placeholder" |
| 4 | If ExecuTorchAdapter enabled, zero PoseFrames | **CONFIRMED** | analyzeFrame always returns null, pipeline throws "No person detected" |
| 5 | Sprint B metrics exist but pipeline uses old path | **CONFIRMED** | analysisPipeline.ts L84: `calculateAllMetrics(timeline)` - Phase 0 only |
| 6 | AnalysisResult/MetricsBundle only has head/torso/hip | **CONFIRMED** | analysis.ts L47-51: MetricsBundle = 3 fields |
| 7 | Production pipeline doesn't use Sprint B architecture | **CONFIRMED** | MetricRegistry, events, stabilization, quality gate - all disconnected |
| 8 | "Analyze Swing" selects video but doesn't run analysis | **CONFIRMED** | selectAndLoadVideo -> router.push('/') -> user taps "PROCESS VIDEO" |
| 9 | analyze.tsx exists but not integrated | **CONFIRMED** | _layout.tsx: analyze route has `href: null` (hidden) |
| 10 | Frame extraction is sequential | **CONFIRMED** | frameExtractor.ts: sequential for loop with await |
| 11 | Mix of deprecated and newer video APIs | **CONFIRMED** | expo-av (player) + expo-video + expo-video-thumbnails |
| 12 | Duration can be zero if picker metadata unavailable | **CONFIRMED** | videoImporter.ts L68: `asset.duration || 0` |
| 13 | Passing tests don't prove production integration | **CONFIRMED** | Zero integration tests for pipeline |

**All 13 Codex findings CONFIRMED.**

---

## Current Pipeline (Actual)

```
User -> "Analyze Swing" -> selectAndLoadVideo -> Home
User -> "PROCESS VIDEO" -> runAnalysisPipeline():
  createPoseEngine() -> MockPoseEngine (ALWAYS)
  extractFrames() -> expo-video-thumbnails (REAL)
  processVideoFrames() -> MockPoseEngine (FAKE poses)
  [Stabilization: SKIPPED]
  buildTimeline() -> PoseTimeline (fake data)
  [Quality Gate: SKIPPED]
  [Event Detection: SKIPPED]
  calculateAllMetrics() -> 3 legacy metrics
  buildAnalysisResult() -> AnalysisResult v0.1
  -> router.push('/player')
```

## Disconnected Modules

| Module | Files | Tests | Production |
|--------|-------|-------|-----------|
| Stabilization Engine | 7 | 40 | Never called |
| Event Detection | 4 | 30 | Never called |
| Quality Gate | 6 | 12 | Never called |
| MetricRegistry V1 | 1 | 10 | Never instantiated |
| V1 Metrics (tempo, pelvisSway, kneeFlex, handDepth) | 4 | 31 | Never called |
| ExecuTorchAdapter | 1 | 0 | Returns null |
| analyze.tsx | 1 | 0 | Never navigated to |

## Package Status

No pose inference package installed (no react-native-executorch, @mediapipe, tensorflow-lite).
Real pose requires adding native dependency + Dev Build.

## Test Baseline

Test Suites: 21 passed, 21 total
Tests: 271 passed, 271 total
TypeScript: 0 errors
