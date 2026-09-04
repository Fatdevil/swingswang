# MediaPipe Tasks Vision — keep classes used by reflection
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.mediapipe.**
-dontwarn com.google.protobuf.**

# Keep Expo module definition
-keep class expo.modules.mediapipepose.** { *; }
