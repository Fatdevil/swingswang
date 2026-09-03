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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteAsync } from 'expo-file-system/legacy';
import { useAnalysis } from '../src/hooks/useAnalysis';
import { checkRealEngineAvailability, createPoseEngine } from '../src/features/pose/PoseEngineFactory';
import { evaluateCameraSnapshot, CameraReadinessResult } from '../src/features/camera/cameraReadiness';
import { SkeletonOverlay } from '../src/components/pose/SkeletonOverlay';
import { Logger } from '../src/utils/logger';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, BORDER_RADIUS } from '../src/constants/theme';
import { SwingGuideOverlay } from '../src/components/camera/SwingGuideOverlay';
import { CameraControls } from '../src/components/camera/CameraControls';
import { useCameraCapture } from '../src/hooks/useCameraCapture';

// Safe requires for native packages
let CameraView: any = View;
let useCameraPermissions: any = () => [null, () => {}];
let useMicrophonePermissions: any = () => [null, () => {}];

try {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
  useMicrophonePermissions = expoCamera.useMicrophonePermissions;
} catch (e) {
  Logger.pose.warn('expo-camera not linked natively.');
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAPSHOT_INTERVAL_MS = 500;

export default function CameraScreen() {
  const router = useRouter();
  const { swingConfig, setVideoSource } = useAnalysis();

  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [isAnalyzingSnapshot, setIsAnalyzingSnapshot] = useState(false);
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

  const {
    cameraMode,
    isRecording,
    countdown,
    autoCapture,
    setAutoCapture,
    handleRecordPress,
    startAutoRecording,
    triggerHaptic,
    recordingStartedRef
  } = useCameraCapture({
    cameraRef,
    cameraLayout,
    setVideoSource,
    router,
    requestMicrophonePermission,
  });

  const isAnalyzingRef = useRef(false);

  // Initialize Pose Engine matching native availability
  const engineAvailability = checkRealEngineAvailability();
  const isMockEngine = !engineAvailability.available;
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
          if (isMockEngine) {
            setReadiness({
              status: 'SEARCHING',
              message: 'Position Check Unavailable',
              subtext: 'ExecuTorch pose engine is not linked. Use manual record button.',
              confidence: 0,
              poseFrame: null,
              color: 'yellow',
            });
          } else {
            setReadiness({
              status: 'SEARCHING',
              message: 'Searching for golfer...',
              subtext: 'Stand in view with your full body visible.',
              confidence: 0,
              poseFrame: null,
              color: 'red',
            });
          }
          Logger.pose.info('Pose engine initialized successfully', { isMockEngine });
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
  }, [poseEngine, isMockEngine]);

  // Request camera permission at mount (microphone deferred to recording start — Finding 19)
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      requestCameraPermission();
    }
  }, [cameraPermission]);

  // 2 Hz Snapshot loop for setup detector (disabled in MOCK mode to prevent synthetic false positives)
  useEffect(() => {
    if (isRecording || recordingStartedRef.current || cameraMode !== 'picture' || !cameraPermission?.granted || !engineReady || isMockEngine) {
      return;
    }

    let active = true;

    const runSnapshotCycle = async () => {
      if (!active || isAnalyzingRef.current || !cameraRef.current) return;

      isAnalyzingRef.current = true;
      setIsAnalyzingSnapshot(true);
      let photoUri: string | null = null;

      try {
        // Take picture from camera stream
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3, // low quality downscaled photo to save CPU time
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

        // Auto-capture trigger (only for real pose engine)
        if (stabilizedResult.status === 'READY' && autoCapture && !isRecording && !recordingStartedRef.current) {
          triggerHaptic('success');
          startAutoRecording();
        }
      } catch (error) {
        Logger.pose.warn('Camera snapshot analysis failed', { error: String(error) });
      } finally {
        // Clean up temporary image file instantly (Risk 5 & Finding 7)
        if (photoUri) {
          try {
            await deleteAsync(photoUri, { idempotent: true });
          } catch (e) {
            Logger.video.warn('Snapshot temp file cleanup failed', { uri: photoUri, error: String(e) });
          }
        }
        isAnalyzingRef.current = false;
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
  }, [isRecording, cameraMode, cameraPermission, poseEngine, swingConfig.cameraView, autoCapture, engineReady, isMockEngine]);

  // Render permission screen if not granted
  if (!cameraPermission || !cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} accessibilityElementsHidden={true} />
          <Text style={styles.permissionTitle} accessibilityRole="header">Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to capture your swing and perform biomechanical pose checks.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestCameraPermission} accessibilityRole="button" accessibilityLabel="Grant camera permission">
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={styles.backBtnGhost} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back to home screen">
            <Text style={styles.backBtnGhostText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
        {!isRecording && <SwingGuideOverlay cameraView={swingConfig.cameraView} />}

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
            <Pressable style={styles.circleBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close camera and go back">
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.badgeContainer} accessible={true} accessibilityLabel={`Camera view: ${swingConfig.cameraView === 'FO' ? 'Face On' : 'Down the Line'}`}>
              <Text style={styles.badgeText}>
                {swingConfig.cameraView === 'FO' ? 'Face On' : 'Down the Line'}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Setup HUD status card */}
          {!isRecording && (
            <View style={[styles.statusCard, { borderColor: getReadinessColor(readiness.color) }]} accessible={true} accessibilityRole="alert" accessibilityLabel={`${readiness.message}. ${readiness.subtext}`}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: getReadinessColor(readiness.color) }]} />
                <Text style={styles.statusTitle}>{readiness.message}</Text>
              </View>
              <Text style={styles.statusSubtext}>{readiness.subtext}</Text>
            </View>
          )}

          {/* Countdown indicator */}
          {countdown !== null && (
            <View style={styles.countdownContainer} accessible={true} accessibilityRole="alert" accessibilityLabel={`Recording starts in ${countdown}`}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}

          {/* Recording indicator */}
          {isRecording && countdown === null && (
            <View style={styles.recordingIndicator} accessible={true} accessibilityRole="alert" accessibilityLabel="Recording swing in progress">
              <View style={styles.redDot} />
              <Text style={styles.recordingText}>RECORDING SWING</Text>
            </View>
          )}
        </SafeAreaView>

        {/* Bottom controls */}
        <CameraControls
          isRecording={isRecording}
          autoCapture={autoCapture}
          readinessStatus={readiness.status}
          onToggleAutoCapture={() => setAutoCapture(!autoCapture)}
          onRecordPress={handleRecordPress}
        />
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
