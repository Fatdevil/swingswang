# Video API Migration Plan

> **Date:** 2026-07-07  
> **Status:** EVALUATION REQUIRED

---

## Current State

### Playback
- **`expo-av`** `Video` component used in `player.tsx`
- **`expo-video`** `VideoView` exists in unused `VideoPlayer.tsx` component
- `expo-av` is **deprecated** in favor of `expo-video`

### Frame Extraction
- **`expo-video-thumbnails`** `getThumbnailAsync()` used in `frameExtractor.ts`
- Sequential extraction at 15fps
- JPEG quality 0.8

---

## Migration Path: Playback

### `expo-av` → `expo-video`

`expo-video` is the official replacement. Key API differences:

| Feature | expo-av | expo-video |
|---------|---------|------------|
| Component | `<Video>` | `<VideoView>` |
| Player | Inline props | `useVideoPlayer(source)` hook |
| Events | `onPlaybackStatusUpdate` callback | Event listeners on player |
| Current time | From status update | Polling or `timeUpdate` event |
| Playback rate | `rate` prop | `player.playbackRate` |
| Seeking | `setPositionAsync()` | `player.seekTo()` |

**Migration risk:** Low. The unused `VideoPlayer.tsx` already wraps `expo-video`.

---

## Migration Path: Frame Extraction

### `expo-video-thumbnails` → `expo-video` `generateThumbnailsAsync`

> [!IMPORTANT]
> `expo-video` provides `generateThumbnailsAsync()`. This should be prototyped and 
> benchmarked, but the following must be verified before adoption:
>
> 1. **Timestamp accuracy** — Do extracted frames correspond to the exact requested
>    timestamps? This is critical for pose timeline accuracy.
> 2. **Pose engine interoperability** — Can the output format (URI, dimensions, encoding)
>    be consumed directly by the pose estimation engine?
> 3. **Performance** — Is batch extraction faster than sequential `getThumbnailAsync()`?

### Evaluation Checklist

- [ ] Prototype `generateThumbnailsAsync` with a test video
- [ ] Compare timestamps of extracted frames vs requested timestamps
- [ ] Verify output image format works with pose engine input
- [ ] Benchmark extraction time vs `expo-video-thumbnails`
- [ ] Test with 30fps and 60fps source videos
- [ ] Test with portrait and landscape videos
- [ ] Test with various durations (3s, 5s, 10s)

### Fallback Strategy

If `expo-video` `generateThumbnailsAsync` has issues:
1. Keep `expo-video-thumbnails` — it still works even if deprecated
2. Native frame extraction via Expo Module — full control, best performance
3. The native module approach aligns with the long-term architecture if the 
   pose engine also runs natively

---

## Action Items

1. [ ] Migrate `player.tsx` from expo-av to expo-video
2. [ ] Add seek/scrub bar to player
3. [ ] Prototype expo-video `generateThumbnailsAsync` for frame extraction
4. [ ] Benchmark timestamp accuracy
5. [ ] Verify pose engine interop
6. [ ] Decision: adopt or keep expo-video-thumbnails as interim
