package expo.modules.mediapipepose

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import com.google.mediapipe.tasks.vision.core.RunningMode
import java.io.File
import java.io.FileNotFoundException

class MediaPipePoseModule : Module() {
  private var poseLandmarker: PoseLandmarker? = null
  private var currentVariant: String? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("MediaPipePose")

    AsyncFunction("initialize") { modelVariant: String, promise: Promise ->
      try {
        initializeLandmarker(modelVariant)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_INIT", "Failed to initialize MediaPipe Pose Landmarker: ${e.message}", e)
      }
    }

    AsyncFunction("detectPose") { imageUri: String, modelVariant: String, promise: Promise ->
      try {
        // Auto-initialize if not done or variant changed
        if (poseLandmarker == null || currentVariant != modelVariant) {
          initializeLandmarker(modelVariant)
        }

        val landmarker = poseLandmarker
          ?: throw IllegalStateException("PoseLandmarker not initialized")

        // Load image from URI
        val bitmap = loadBitmapFromUri(imageUri)
          ?: throw FileNotFoundException("Could not load image from URI: $imageUri")

        val mpImage = BitmapImageBuilder(bitmap).build()

        // Run detection
        val result: PoseLandmarkerResult = landmarker.detect(mpImage)

        // Convert result to JS-compatible format
        val poses = mutableListOf<Map<String, Any>>()

        for (i in result.landmarks().indices) {
          val landmarks = result.landmarks()[i]
          val worldLandmarks = if (i < result.worldLandmarks().size) {
            result.worldLandmarks()[i]
          } else {
            emptyList()
          }

          val landmarkList = landmarks.map { lm ->
            mapOf(
              "x" to lm.x().toDouble(),
              "y" to lm.y().toDouble(),
              "z" to lm.z().toDouble(),
              "visibility" to (lm.visibility().orElse(0f)).toDouble(),
              "presence" to (lm.presence().orElse(0f)).toDouble()
            )
          }

          val worldLandmarkList = worldLandmarks.map { lm ->
            mapOf(
              "x" to lm.x().toDouble(),
              "y" to lm.y().toDouble(),
              "z" to lm.z().toDouble(),
              "visibility" to (lm.visibility().orElse(0f)).toDouble(),
              "presence" to (lm.presence().orElse(0f)).toDouble()
            )
          }

          poses.add(mapOf(
            "landmarks" to landmarkList,
            "worldLandmarks" to worldLandmarkList,
            "timestampMs" to System.currentTimeMillis()
          ))
        }

        promise.resolve(poses)
      } catch (e: Exception) {
        promise.reject("ERR_DETECT", "Pose detection failed: ${e.message}", e)
      }
    }

    AsyncFunction("release") { promise: Promise ->
      try {
        poseLandmarker?.close()
        poseLandmarker = null
        currentVariant = null
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_RELEASE", "Failed to release PoseLandmarker: ${e.message}", e)
      }
    }

    OnDestroy {
      poseLandmarker?.close()
      poseLandmarker = null
    }
  }

  private fun initializeLandmarker(modelVariant: String) {
    // Close existing instance if variant changed
    poseLandmarker?.close()

    val modelAssetName = when (modelVariant) {
      "lite" -> "pose_landmarker_lite.task"
      "full" -> "pose_landmarker_full.task"
      "heavy" -> "pose_landmarker_heavy.task"
      else -> "pose_landmarker_lite.task"
    }

    val baseOptions = BaseOptions.builder()
      .setModelAssetPath(modelAssetName)
      .build()

    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.IMAGE)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()

    poseLandmarker = PoseLandmarker.createFromOptions(context, options)
    currentVariant = modelVariant
  }

  private fun loadBitmapFromUri(uriString: String): android.graphics.Bitmap? {
    return try {
      val uri = Uri.parse(uriString)
      if (uri.scheme == "file" || uri.scheme == null) {
        val path = uri.path ?: return null
        BitmapFactory.decodeFile(path)
      } else {
        val inputStream = context.contentResolver.openInputStream(uri)
        BitmapFactory.decodeStream(inputStream).also {
          inputStream?.close()
        }
      }
    } catch (e: Exception) {
      null
    }
  }
}
