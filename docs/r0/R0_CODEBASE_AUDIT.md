# R0: Codebase Audit & Mock Hardening

## References to MockPoseEngine / mode: 'MOCK'
The following files still maintain a reference to the mock implementation, primarily for testing and development safety nets:
- `src/features/pose/PoseEngineFactory.ts`: Can still construct a mock engine for test/demo mode, but no longer dynamically falls back to it on error.
- `src/features/pose/MockPoseEngine.ts`: The mock engine implementation itself.
- `src/hooks/useAnalysis.ts`: Requests the 'REAL' or 'MOCK' engine config conditionally based on availability (which is gated by production checks).

## Pipeline Default Behavior
- **Before**: `analysisPipeline.ts` would default to initializing with `{ mode: 'MOCK' }` if no `engineConfig` was explicitly passed.
- **After**: The `engineConfig` parameter is strictly required in `analysisPipeline.ts`. The pipeline will throw an explicit error (`engineConfig is required`) to prevent silent fallbacks to the mock engine in production.

## `__DEV__` Guard Status
- **Before**: `useAnalysis.ts` allowed the mock engine to run in production if the user manually activated `debugMode`. (`const isMockBlocked = !__DEV__ && !state.debugMode && !availability.available;`)
- **After**: The `debugMode` bypass has been completely removed. The check is now `!__DEV__ && !availability.available;`, making it unconditionally impossible to use the mock engine when the real engine fails in a production environment.

## Release Build Path
In an EAS Production Build, the `__DEV__` flag evaluates to `false`. 
1. When `startAnalysis` is invoked, `checkRealEngineAvailability()` attempts to verify the MediaPipe integration.
2. If the module is present, it returns `available: true`, mapping the request to `REAL` mode in `PoseEngineFactory`.
3. If the module is missing or fails, it returns `available: false`.
4. `useAnalysis.ts` checks `!__DEV__ && !availability.available`, resulting in a fatal error thrown immediately.
5. `PoseEngineFactory` throws if 'REAL' mode fails initialization.
6. The UI correctly handles missing real engine during live camera recording by removing the overlay instead of rendering a broken mock state.

## Conclusion
Due to the removal of the fallback parameters and the unbypassable `__DEV__` guards, **the mock pose engine cannot reach or operate within a release build** under any circumstances. If the real pose engine is unavailable in production, the application will forcefully block analysis functions rather than emit synthetic or mock results.
