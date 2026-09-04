/**
 * r0-verify.tsx — R0 MediaPipe Verification Screen
 * SwingSwang
 *
 * Internal verification screen for Block 2 device testing.
 * Only accessible in __DEV__ builds. Not available in production.
 *
 * Capabilities:
 * 1. Check isAvailable() for each model variant
 * 2. Select model variant (Lite/Full/Heavy)
 * 3. Import image → detectImage() → show landmarks + inference time
 * 4. Import video → processVideo() → show frame count, timestamps, times
 * 5. Pose overlay on first detected frame
 * 6. Export anonymized verification report
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { COLORS, SPACING, FONT_SIZE, FONT_FAMILY } from '../src/constants/theme';
import {
  isAvailable,
  detectImage,
  processVideo,
  release,
  type MediaPipeModelVariant,
  type MediaPipeFrameResult,
  type MediaPipeVideoResult,
} from '../modules/mediapipe-pose';

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

interface AvailabilityResult {
  lite: boolean | null;
  full: boolean | null;
  heavy: boolean | null;
}

export default function R0VerifyScreen() {
  // Production guard
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.blocked}>
          <Text style={styles.blockedTitle}>Not Available</Text>
          <Text style={styles.blockedText}>
            R0 verification is only available in development builds.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const [variant, setVariant] = useState<MediaPipeModelVariant>('lite');
  const [availability, setAvailability] = useState<AvailabilityResult>({
    lite: null, full: null, heavy: null,
  });
  const [availStatus, setAvailStatus] = useState<TestStatus>('idle');

  const [imageResult, setImageResult] = useState<MediaPipeFrameResult | null>(null);
  const [imageStatus, setImageStatus] = useState<TestStatus>('idle');
  const [imageError, setImageError] = useState<string | null>(null);

  const [videoResult, setVideoResult] = useState<MediaPipeVideoResult | null>(null);
  const [videoStatus, setVideoStatus] = useState<TestStatus>('idle');
  const [videoError, setVideoError] = useState<string | null>(null);

  // ── 1. Check availability ──────────────────────────────────────
  const checkAvailability = useCallback(async () => {
    setAvailStatus('running');
    try {
      const [lite, full, heavy] = await Promise.all([
        isAvailable('lite'),
        isAvailable('full'),
        isAvailable('heavy'),
      ]);
      setAvailability({ lite, full, heavy });
      setAvailStatus(lite || full || heavy ? 'pass' : 'fail');
    } catch (e) {
      setAvailStatus('fail');
      Alert.alert('Error', String(e));
    }
  }, []);

  // ── 3. Image detection ─────────────────────────────────────────
  const testImageDetection = useCallback(async () => {
    setImageStatus('running');
    setImageError(null);
    setImageResult(null);
    try {
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
      });
      if (pick.canceled || !pick.assets?.[0]) {
        setImageStatus('idle');
        return;
      }

      const result = await detectImage(pick.assets[0].uri, variant);
      setImageResult(result);
      setImageStatus(result.landmarks.length === 33 ? 'pass' : 'fail');
    } catch (e: any) {
      setImageError(e?.message || String(e));
      setImageStatus('fail');
    }
  }, [variant]);

  // ── 4. Video processing ────────────────────────────────────────
  const testVideoProcessing = useCallback(async () => {
    setVideoStatus('running');
    setVideoError(null);
    setVideoResult(null);
    try {
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        quality: 1,
      });
      if (pick.canceled || !pick.assets?.[0]) {
        setVideoStatus('idle');
        return;
      }

      const result = await processVideo(pick.assets[0].uri, variant, {
        targetFps: 15,
        maxFrames: 100,
      });
      setVideoResult(result);

      // Verify monotonic timestamps
      let monotonic = true;
      for (let i = 1; i < result.frames.length; i++) {
        if (result.frames[i].timestampMs <= result.frames[i - 1].timestampMs) {
          monotonic = false;
          break;
        }
      }

      setVideoStatus(
        result.processedFrameCount > 0 && monotonic ? 'pass' : 'fail'
      );
    } catch (e: any) {
      setVideoError(e?.message || String(e));
      setVideoStatus('fail');
    }
  }, [variant]);

  // ── 6. Export report ───────────────────────────────────────────
  const exportReport = useCallback(async () => {
    const inferTimes = videoResult?.frames.map(f => f.inferenceDurationMs).sort((a, b) => a - b) ?? [];
    const p50 = inferTimes.length > 0 ? inferTimes[Math.floor(inferTimes.length * 0.5)] : null;
    const p95 = inferTimes.length > 0 ? inferTimes[Math.floor(inferTimes.length * 0.95)] : null;

    let monotonic = true;
    if (videoResult) {
      for (let i = 1; i < videoResult.frames.length; i++) {
        if (videoResult.frames[i].timestampMs <= videoResult.frames[i - 1].timestampMs) {
          monotonic = false;
          break;
        }
      }
    }

    const report = {
      title: 'R0 MediaPipe Android Verification',
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      modelVariant: variant,
      sdkVersion: '1.0.0',
      availability,
      imageTest: {
        status: imageStatus,
        landmarkCount: imageResult?.landmarks.length ?? 0,
        worldLandmarkCount: imageResult?.worldLandmarks.length ?? 0,
        inferenceDurationMs: imageResult?.inferenceDurationMs ?? null,
        error: imageError,
      },
      videoTest: {
        status: videoStatus,
        processedFrameCount: videoResult?.processedFrameCount ?? 0,
        decodedFrameCount: videoResult?.decodedFrameCount ?? 0,
        samplingSkippedFrameCount: videoResult?.samplingSkippedFrameCount ?? 0,
        decodeDroppedFrameCount: videoResult?.decodeDroppedFrameCount ?? 0,
        sourceDurationMs: videoResult?.sourceDurationMs ?? 0,
        timestampsMonotonic: monotonic,
        inferenceP50Ms: p50,
        inferenceP95Ms: p95,
        error: videoError,
      },
    };

    await Share.share({
      message: JSON.stringify(report, null, 2),
      title: 'R0 Verification Report',
    });
  }, [availability, imageResult, imageStatus, imageError, videoResult, videoStatus, videoError, variant]);

  // ── 8. Release resources ───────────────────────────────────────
  const releaseResources = useCallback(async () => {
    try {
      await release();
      Alert.alert('Released', 'MediaPipe resources freed.');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }, []);

  const statusIcon = (s: TestStatus) =>
    s === 'pass' ? '✅' : s === 'fail' ? '❌' : s === 'running' ? '⏳' : '⬜';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>R0 MediaPipe Verification</Text>
        <Text style={styles.subtitle}>Block 2 Device Testing</Text>

        {/* Model Variant Selector */}
        <Card title="Model Variant">
          <View style={styles.variantRow}>
            {(['lite', 'full', 'heavy'] as MediaPipeModelVariant[]).map(v => (
              <Text
                key={v}
                style={[styles.variantBtn, variant === v && styles.variantActive]}
                onPress={() => setVariant(v)}
              >
                {v.toUpperCase()}
              </Text>
            ))}
          </View>
        </Card>

        {/* 1. Availability Check */}
        <Card title={`${statusIcon(availStatus)} Availability`}>
          <Button title="Check isAvailable()" onPress={checkAvailability} />
          {availability.lite !== null && (
            <View style={styles.resultBlock}>
              <Text style={styles.mono}>Lite:  {availability.lite ? '✅' : '❌'}</Text>
              <Text style={styles.mono}>Full:  {availability.full ? '✅' : '❌'}</Text>
              <Text style={styles.mono}>Heavy: {availability.heavy ? '✅' : '❌'}</Text>
            </View>
          )}
        </Card>

        {/* 3. Image Detection */}
        <Card title={`${statusIcon(imageStatus)} Image Detection`}>
          <Button title="Pick Image → detectImage()" onPress={testImageDetection} />
          {imageResult && (
            <View style={styles.resultBlock}>
              <Text style={styles.mono}>Landmarks: {imageResult.landmarks.length}</Text>
              <Text style={styles.mono}>World: {imageResult.worldLandmarks.length}</Text>
              <Text style={styles.mono}>
                Inference: {imageResult.inferenceDurationMs.toFixed(1)} ms
              </Text>
              {imageResult.landmarks.length > 0 && (
                <Text style={styles.pass}>
                  {imageResult.landmarks.length === 33 ? '✅ 33 landmarks' : `⚠️ ${imageResult.landmarks.length} landmarks`}
                </Text>
              )}
            </View>
          )}
          {imageError && <Text style={styles.error}>{imageError}</Text>}
        </Card>

        {/* 4. Video Processing */}
        <Card title={`${statusIcon(videoStatus)} Video Processing`}>
          <Button title="Pick Video → processVideo()" onPress={testVideoProcessing} />
          {videoResult && (
            <View style={styles.resultBlock}>
              <Text style={styles.mono}>Duration: {videoResult.sourceDurationMs} ms</Text>
              <Text style={styles.mono}>Decoded: {videoResult.decodedFrameCount}</Text>
              <Text style={styles.mono}>Processed: {videoResult.processedFrameCount}</Text>
              <Text style={styles.mono}>Skipped (sampling): {videoResult.samplingSkippedFrameCount}</Text>
              <Text style={styles.mono}>Dropped (decode): {videoResult.decodeDroppedFrameCount}</Text>
              <Text style={styles.mono}>Variant: {videoResult.modelVariant}</Text>
              {videoResult.frames.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>First 5 frame timestamps (ms):</Text>
                  {videoResult.frames.slice(0, 5).map((f, i) => (
                    <Text key={i} style={styles.mono}>
                      #{i}: ts={f.timestampMs} landmarks={f.landmarks.length} infer={f.inferenceDurationMs.toFixed(1)}ms
                    </Text>
                  ))}
                  <Text style={styles.sectionLabel}>Inference stats:</Text>
                  <Text style={styles.mono}>
                    Avg: {(videoResult.frames.reduce((s, f) => s + f.inferenceDurationMs, 0) / videoResult.frames.length).toFixed(1)} ms
                  </Text>
                </>
              )}
            </View>
          )}
          {videoError && <Text style={styles.error}>{videoError}</Text>}
        </Card>

        {/* Actions */}
        <Card title="Actions">
          <Button title="📤 Export Report" onPress={exportReport} />
          <View style={{ height: 8 }} />
          <Button title="🗑 Release Resources" onPress={releaseResources} />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundPrimary,
  },
  scroll: {
    padding: SPACING.md,
  },
  blocked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  blockedTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontFamily: FONT_FAMILY,
    fontWeight: '700' as any,
    marginBottom: 8,
  },
  blockedText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY,
    textAlign: 'center',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xl,
    fontFamily: FONT_FAMILY,
    fontWeight: '700' as any,
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY,
    marginBottom: SPACING.md,
  },
  variantRow: {
    flexDirection: 'row',
    gap: 8,
  },
  variantBtn: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundTertiary,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY,
    fontWeight: '600' as any,
    overflow: 'hidden',
  },
  variantActive: {
    backgroundColor: COLORS.accent,
    color: COLORS.textPrimary,
  },
  resultBlock: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.backgroundTertiary,
    borderRadius: 8,
  },
  mono: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  sectionLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY,
    marginTop: 8,
    marginBottom: 4,
  },
  pass: {
    color: '#4ade80',
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY,
    fontWeight: '600' as any,
    marginTop: 8,
  },
  error: {
    color: '#ef4444',
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY,
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 4,
  },
});
