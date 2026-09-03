import { useState, useRef } from 'react';
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

  const resetCameraStates = () => {
    setIsRecording(false);
    setCameraMode('picture');
    setCountdown(null);
    recordingStartedRef.current = false;
  };

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
