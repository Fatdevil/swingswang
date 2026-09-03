import { useState, useRef, useEffect } from 'react';
import { Logger } from '@/utils/logger';

// Safe requires for native packages
let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  Logger.pose.warn('expo-haptics not linked natively.');
}

const RECORDING_DURATION_MS = 5000;

interface UseCameraCaptureProps {
  cameraRef: React.MutableRefObject<any>;
  cameraLayout: { width: number; height: number };
  setVideoSource: (source: any) => void;
  router: any;
}

export function useCameraCapture({ cameraRef, cameraLayout, setVideoSource, router }: UseCameraCaptureProps) {
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoCapture, setAutoCapture] = useState(true);

  const recordingStartedRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const resetCameraStates = () => {
    clearAllTimers();
    setIsRecording(false);
    setCameraMode('picture');
    setCountdown(null);
    recordingStartedRef.current = false;
    recordingStartTimeRef.current = null;
  };

  // Unmount & focus loss cleanup guard (Finding 6)
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (cameraRef.current && recordingStartedRef.current) {
        try {
          cameraRef.current.stopRecording();
        } catch (e) {
          // Ignored on unmount
        }
      }
    };
  }, []);

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

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
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
    try {
      setCameraMode('video');
      // Brief pause to allow camera view mode transition
      await new Promise((r) => setTimeout(r, 200));

      const videoPromise = cameraRef.current.recordAsync({
        maxDuration: RECORDING_DURATION_MS / 1000,
      });

      recordingStartTimeRef.current = Date.now();

      // Automatically stop recording after max duration
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, RECORDING_DURATION_MS);

      const video = await videoPromise;

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      // Calculate actual elapsed duration instead of hardcoding 5.0 seconds (Finding 2)
      const actualDurationSeconds = recordingStartTimeRef.current
        ? Math.max(0.5, Math.min(10, (Date.now() - recordingStartTimeRef.current) / 1000))
        : RECORDING_DURATION_MS / 1000;

      if (video?.uri) {
        setVideoSource({
          uri: video.uri,
          metadata: {
            duration: actualDurationSeconds,
            width: cameraLayout.width || 1080,
            height: cameraLayout.height || 1920,
            orientation: 'portrait',
            frameRate: 30,
            fileSize: 0,
            mimeType: 'video/mp4',
          },
        });
        Logger.video.info('Camera recording complete', { uri: video.uri, duration: actualDurationSeconds });
        router.replace('/');
      }
    } catch (err) {
      Logger.video.error('Failed to record camera clip', { error: String(err) });
    } finally {
      resetCameraStates();
    }
  };

  const stopRecording = () => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stopRecording();
      } catch (e) {
        Logger.video.warn('stopRecording failed or camera not ready', { error: String(e) });
      }
    }
  };

  return {
    cameraMode,
    isRecording,
    countdown,
    autoCapture,
    setAutoCapture,
    handleRecordPress,
    startAutoRecording,
    resetCameraStates,
    triggerHaptic,
    recordingStartedRef
  };
}

