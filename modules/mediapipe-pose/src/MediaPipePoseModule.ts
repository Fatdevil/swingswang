import { requireOptionalNativeModule, Platform } from 'expo-modules-core';

const MediaPipePoseModule = Platform.OS === 'web'
  ? null
  : requireOptionalNativeModule('MediaPipePose');

export default MediaPipePoseModule;
