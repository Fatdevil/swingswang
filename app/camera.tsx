/**
 * camera.tsx — Golf Swing Recorder & Guide
 * SwingSwang
 *
 * Camera recording screen with real-time pose detector HUD,
 * silhouette guides, haptic cues, and auto-capture.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { checkRealEngineAvailability, createPoseEngine } from '../src/features/pose/PoseEngineFactory';
import { evaluateCameraSnapshot, CameraReadinessResult } from '../src/features/camera/cameraReadiness';
import { SkeletonOverlay } from '../src/components/pose/SkeletonOverlay';
import { Logger } from '../src/utils/logger';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '../src/constants/theme';
import type { PoseFrame } from '../src/types/pose';

// Safe requires for native packages
let CameraView: any = View;
let useCameraPermissions: any = () => [null, () => {}];
let useMicrophonePermissions: any = () => [null, () => {}];
let Haptics: any = null;

try {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
  useMicrophonePermissions = expoCamera.useMicrophonePermissions;
} catch (e) {
  Logger.pose.warn('expo-camera not linked natively.');
}

try {
  Haptics = require('expo-haptics');
} catch (e) {
  Logger.pose.warn('expo-haptics not linked natively.');
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAPSHOT_INTERVAL_MS = 500;
const RECORDING_DURATION_MS = 5000;

export default function CameraScreen() {
  const router = useRouter();
  const { swingConfig, setVideoSource } = useAnalysis();

  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingSnapshot, setIsAnalyzingSnapshot] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoCapture, setAutoCapture] = useState(true);

  const [engineReady, setEngineReady] = useState(false);
  // Snapshot readiness states
  const [readiness, setReadiness] = useState<CameraReadinessResult>({
    status: 'SEARCHING',
    message: 'Initializing pose engine...',
    subtext: 'Please wait while we set up real-time tracking.',
    confidence: 0,
    poseFrame: null,
    color: 'yellow',
  });
  const [cameraLayout, setCameraLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH * (16 / 9) });

  // Counter to require 2 consecutive READY snapshots (1.0 second) for stability
  const readyCounterRef = useRef(0);
  const recordingStartedRef = useRef(false);

  const resetCameraStates = () => {
    setIsRecording(false);
    setCameraMode('picture');
    setCountdown(null);
    readyCounterRef.current = 0;
    recordingStartedRef.current = false;
  };

  // Initialize Pose Engine matching native availability
  const engineAvailability = checkRealEngineAvailability();
  const poseEngine = useMemo(() => {
    return createPoseEngine({ mode: engineAvailability.available ? 'REAL' : 'MOCK' });
  }, [engineAvailability.available]);

  // Handle pose engine lifecycle initialization
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await poseEngine.initialize();
        if (active) {
          setEngineReady(true);
          setReadiness({
            status: 'SEARCHING',
            message: 'Searching for golfer...',
            subtext: 'Stand in view with your full body visible.',
            confidence: 0,
            poseFrame: null,
            color: 'red',
          });
          Logger.pose.info('Pose engine initialized successfully');
        }
      } catch (err) {
        Logger.pose.error('Failed to initialize pose engine', { error: String(err) });
        if (active) {
          setReadiness({
            status: 'SEARCHING',
            message: 'Engine Init Failed',
            subtext: err instanceof Error ? err.message : String(err),
            confidence: 0,
            poseFrame: null,
            color: 'red',
          });
        }
      }
    };
    init();
    return () => {
      active = false;
      poseEngine.dispose();
    };
  }, [poseEngine]);

  // Request permissions at mount
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      requestCameraPermission();
    }
    if (microphonePermission && !microphonePermission.granted) {
      requestMicrophonePermission();
    }
  }, [cameraPermission, microphonePermission]);

  // Haptic trigger helper
  const triggerHaptic = (type: 'success' | 'warning') => {
    if (Haptics) {
      try {
        if (type === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } catch (err) {
        // Ignored in non-native environments
      }
    }
  };

  // 2 Hz Snapshot loop for setup detektor
  useEffect(() => {
    if (isRecording || recordingStartedRef.current || cameraMode !== 'picture' || !cameraPermission?.granted || !engineReady) {
      return;
    }

    let active = true;

    const runSnapshotCycle = async () => {
      if (!active || isAnalyzingSnapshot || !cameraRef.current) return;

      setIsAnalyzingSnapshot(true);
      let photoUri: string | null = null;

      try {
        // Take picture from camera stream
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3, // low quality downscaled photo to save CPU time (Risk 4)
          skipProcessing: true,
        });

        if (!photo || !active) return;
        photoUri = photo.uri;

        // Perform frame-level pose estimation, passing actual photo dimensions
        const poseFrame = await poseEngine.analyzeFrame(photoUri!, 0, 0, photo.width, photo.height);
        if (!active) return;

        // Run readiness heuristics check
        const result = evaluateCameraSnapshot(poseFrame, swingConfig.cameraView);

        // Apply hysteresis: stable for 2 snapshots (1.0 second)
        if (result.status === 'READY') {
          readyCounterRef.current += 1;
        } else {
          readyCounterRef.current = 0;
        }

        const stabilizedResult = {
          ...result,
          status: readyCounterRef.current >= 2 ? ('READY' as const) : result.status === 'READY' ? ('LOW_CONFIDENCE' as const) : result.status,
          color: readyCounterRef.current >= 2 ? ('green' as const) : result.status === 'READY' ? ('yellow' as const) : result.color,
          message: readyCounterRef.current >= 2 ? result.message : readyCounterRef.current === 1 ? 'Holding steady...' : result.message,
        };

        setReadiness(stabilizedResult);

        // Auto-capture trigger
        if (stabilizedResult.status === 'READY' && autoCapture && !isRecording && !recordingStartedRef.current) {
          triggerHaptic('success');
          startAutoRecording();
        }
      } catch (error) {
        Logger.pose.warn('Camera snapshot analysis failed', { error: String(error) });
      } finally {
        // Clean up temporary image file instantly (Risk 5)
        if (photoUri) {
          try {
            await FileSystem.deleteAsync(photoUri, { idempotent: true });
          } catch (e) {
            // Ignored
          }
        }
        if (active) {
          setIsAnalyzingSnapshot(false);
        }
      }
    };

    const interval = setInterval(runSnapshotCycle, SNAPSHOT_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isRecording, cameraMode, cameraPermission, poseEngine, swingConfig.cameraView, autoCapture, engineReady]);

  // Handle manual record press
  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      triggerHaptic('success');
      startManualRecording();
    }
  };

  const startAutoRecording = () => {
    if (recordingStartedRef.current) return;
    recordingStartedRef.current = true;
    setIsRecording(true);
    let count = 3;
    setCountdown(count);

    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        setCountdown(null);
        recordActiveClip();
      }
    }, 1000);
  };

  const startManualRecording = () => {
    if (recordingStartedRef.current) return;
    recordingStartedRef.current = true;
    setIsRecording(true);
    recordActiveClip();
  };

  const recordActiveClip = async () => {
    if (!cameraRef.current) return;
    let recordingTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      setCameraMode('video');
      // Brief pause to allow camera view mode transition
      await new Promise((r) => setTimeout(r, 200));

      const videoPromise = cameraRef.current.recordAsync({
        maxDuration: RECORDING_DURATION_MS / 1000,
      });

      // Automatically stop recording after 5 seconds
      recordingTimeout = setTimeout(() => {
        stopRecording();
      }, RECORDING_DURATION_MS);

      const video = await videoPromise;
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
      }

      if (video?.uri) {
        setVideoSource({
          uri: video.uri,
          metadata: {
            duration: RECORDING_DURATION_MS / 1000,
            width: cameraLayout.width || 1080,
            height: cameraLayout.height || 1920,
            orientation: 'portrait',
            frameRate: 30,
            fileSize: 0,
            mimeType: 'video/mp4',
          },
        });
        Logger.video.info('Camera recording complete', { uri: video.uri });
        router.replace('/');
      }
    } catch (err) {
      Logger.video.error('Failed to record camera clip', { error: String(err) });
    } finally {
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
      }
      resetCameraStates();
    }
  };

  const stopRecording = () => {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
    }
  };

  // Render permission screen if not granted
  if (!cameraPermission || !cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to capture your swing and perform biomechanical pose checks.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestCameraPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={styles.backBtnGhost} onPress={() => router.back()}>
            <Text style={styles.backBtnGhostText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Get matching guide silhouette path based on view selection
  const renderGuideSilhouette = () => {
    if (swingConfig.cameraView === 'FO') {
      // Face On (FO) standing profile guide
      return (
        <Svg width="200" height="360" viewBox="0 0 200 360" style={styles.silhouette}>
          {/* Head */}
          <Circle cx="100" cy="50" r="22" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
          {/* Spine & Body */}
          <Line x1="100" y1="72" x2="100" y2="180" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Shoulders */}
          <Line x1="70" y1="85" x2="130" y2="85" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Hips */}
          <Line x1="75" y1="180" x2="125" y2="180" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Left Leg */}
          <Line x1="75" y1="180" x2="65" y2="300" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Right Leg */}
          <Line x1="125" y1="180" x2="135" y2="300" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Left Arm */}
          <Line x1="70" y1="85" x2="90" y2="170" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Right Arm */}
          <Line x1="130" y1="85" x2="110" y2="170" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Golf Club representation */}
          <Path d="M 100,170 L 150,280 M 145,280 L 155,285" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
        </Svg>
      );
    } else {
      // Down The Line (DTL) bent stance profile guide
      return (
        <Svg width="200" height="360" viewBox="0 0 200 360" style={styles.silhouette}>
          {/* Head */}
          <Circle cx="120" cy="70" r="22" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
          {/* Bent spine */}
          <Path d="M 120,92 Q 105,120 85,160" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
          {/* Hips to ankles (profile bent leg) */}
          <Path d="M 85,160 L 75,225 L 85,310" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
          {/* Hanging profile arms */}
          <Line x1="108" y1="105" x2="125" y2="190" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
          {/* Club representation */}
          <Path d="M 125,190 L 175,270 M 170,270 L 180,275" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
        </Svg>
      );
    }
  };

  const getReadinessColor = (color: string) => {
    switch (color) {
      case 'green': return '#10B981';
      case 'yellow': return '#F59E0B';
      case 'orange': return '#EF4444';
      default: return '#EF4444';
    }
  };

  return (
    <View style={styles.container}>
      {/* Live Camera Preview */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        mode={cameraMode}
        onLayout={(e: any) => {
          const { width, height } = e.nativeEvent.layout;
          setCameraLayout({ width, height });
        }}
      >
        {/* Render Silhouette Overlay */}
        {!isRecording && renderGuideSilhouette()}

        {/* Real-time Golfer Skeleton HUD Overlay */}
        {!isRecording && readiness.poseFrame && (
          <SkeletonOverlay
            poseFrame={readiness.poseFrame}
            videoWidth={readiness.poseFrame.sourceWidth}
            videoHeight={readiness.poseFrame.sourceHeight}
            displayWidth={cameraLayout.width}
            displayHeight={cameraLayout.height}
          />
        )}

        {/* Status Callout Banner */}
        <SafeAreaView style={styles.hudOverlay}>
          <View style={styles.header}>
            <Pressable style={styles.circleBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>
                {swingConfig.cameraView === 'FO' ? 'Face On' : 'Down the Line'}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Setup HUD status card */}
          {!isRecording && (
            <View style={[styles.statusCard, { borderColor: getReadinessColor(readiness.color) }]}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: getReadinessColor(readiness.color) }]} />
                <Text style={styles.statusTitle}>{readiness.message}</Text>
              </View>
              <Text style={styles.statusSubtext}>{readiness.subtext}</Text>
            </View>
          )}

          {/* Countdown indicator */}
          {countdown !== null && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}

          {/* Recording indicator */}
          {isRecording && countdown === null && (
            <View style={styles.recordingIndicator}>
              <View style={styles.redDot} />
              <Text style={styles.recordingText}>RECORDING SWING</Text>
            </View>
          )}
        </SafeAreaView>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {/* Toggle Auto Capture */}
          <Pressable
            style={[styles.toggleBtn, autoCapture && styles.toggleBtnActive]}
            onPress={() => setAutoCapture(!autoCapture)}
          >
            <Ionicons
              name={autoCapture ? 'flash' : 'flash-off'}
              size={20}
              color={autoCapture ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text style={[styles.toggleBtnText, autoCapture && styles.toggleBtnTextActive]}>
              Auto-Capture: {autoCapture ? 'ON' : 'OFF'}
            </Text>
          </Pressable>

          {/* Record button */}
          <View style={styles.recordRow}>
            <Pressable
              style={[
                styles.recordOuterCircle,
                isRecording && styles.recordOuterActive,
                readiness.status === 'READY' && !isRecording && styles.recordOuterReady,
              ]}
              onPress={handleRecordPress}
            >
              <View
                style={[
                  styles.recordInnerCircle,
                  isRecording ? styles.recordInnerActive : styles.recordInnerIdle,
                ]}
              />
            </Pressable>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  hudOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    fontFamily: FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  silhouette: {
    position: 'absolute',
    top: '22%',
    left: '50%',
    marginLeft: -100,
    opacity: 0.8,
  },
  statusCard: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTitle: {
    fontFamily: FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  statusSubtext: {
    fontFamily: FONT_FAMILY,
    color: 'rgba(255,255,255,0.7)',
    fontSize: FONT_SIZE.xs,
  },
  countdownContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  countdownText: {
    fontFamily: FONT_FAMILY,
    fontSize: 96,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLORS.accent,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  recordingIndicator: {
    position: 'absolute',
    top: '15%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    fontFamily: FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold as any,
    letterSpacing: 1.5,
  },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.lg,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: 'transparent',
  },
  toggleBtnText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: FONT_WEIGHT.bold as any,
  },
  recordRow: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  recordOuterCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordOuterReady: {
    borderColor: '#10B981',
  },
  recordOuterActive: {
    borderColor: '#EF4444',
  },
  recordInnerCircle: {
    borderRadius: 25,
  },
  recordInnerIdle: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
  },
  recordInnerActive: {
    width: 32,
    height: 32,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  permissionTitle: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold as any,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  permissionText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  permissionBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    fontFamily: FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  backBtnGhost: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtnGhostText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
  },
});
