package expo.modules.mediapipepose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.SystemClock
import androidx.exifinterface.media.ExifInterface
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileNotFoundException
import java.io.InputStream
import java.util.concurrent.Executors

class MediaPipePoseModule : Module() {
  // Dedicated single thread for all inference — never reuse from multiple threads
  private val inferenceExecutor = Executors.newSingleThreadExecutor { r ->
    Thread(r, "mediapipe-inference").apply { isDaemon = true }
  }

  private var imageLandmarker: PoseLandmarker? = null
  private var videoLandmarker: PoseLandmarker? = null
  private var currentImageVariant: String? = null
  private var currentVideoVariant: String? = null

  private val context: Context
    get() = appContext.reactContext
      ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("MediaPipePose")

    // ── isAvailable ──────────────────────────────────────────────────
    AsyncFunction("isAvailable") { modelVariant: String, promise: Promise ->
      inferenceExecutor.execute {
        try {
          val assetName = modelAssetName(modelVariant)
          val available = try {
            context.assets.open(assetName).use { true }
          } catch (_: Exception) {
            false
          }
          promise.resolve(available)
        } catch (e: Exception) {
          promise.reject("ERR_AVAILABLE", e.message ?: "Unknown error", e)
        }
      }
    }

    // ── detectImage ──────────────────────────────────────────────────
    AsyncFunction("detectImage") { imageUri: String, modelVariant: String, promise: Promise ->
      inferenceExecutor.execute {
        var bitmap: Bitmap? = null
        try {
          val landmarker = getOrCreateImageLandmarker(modelVariant)

          bitmap = loadBitmapFromUri(imageUri)
            ?: throw FileNotFoundException("Could not load image from URI: $imageUri")

          val rotation = readExifRotation(imageUri)
          val rotatedBitmap = applyRotation(bitmap, rotation)
          if (rotatedBitmap !== bitmap) {
            bitmap.recycle()
            bitmap = rotatedBitmap
          }

          val mpImage = BitmapImageBuilder(bitmap).build()

          val inferenceStartNs = SystemClock.elapsedRealtimeNanos()
          val result: PoseLandmarkerResult = landmarker.detect(mpImage)
          val inferenceDurationMs =
            (SystemClock.elapsedRealtimeNanos() - inferenceStartNs) / 1_000_000.0

          val frameResult = convertSingleResult(result, 0L, inferenceDurationMs)
          promise.resolve(frameResult)
        } catch (e: Exception) {
          promise.reject("ERR_DETECT_IMAGE", "Image detection failed: ${e.message}", e)
        } finally {
          bitmap?.recycle()
        }
      }
    }

    // ── processVideo ─────────────────────────────────────────────────
    AsyncFunction("processVideo") { videoUri: String, modelVariant: String,
                                     targetFps: Double, maxFrames: Int,
                                     promise: Promise ->
      inferenceExecutor.execute {
        var extractor: MediaExtractor? = null
        var codec: MediaCodec? = null
        var landmarker: PoseLandmarker? = null

        try {
          // 1. Setup MediaExtractor
          extractor = MediaExtractor()
          val uri = Uri.parse(videoUri)
          if (uri.scheme == "file" || uri.scheme == null) {
            extractor.setDataSource(uri.path ?: throw FileNotFoundException("Invalid video path"))
          } else {
            extractor.setDataSource(context, uri, null)
          }

          // 2. Find video track
          var videoTrackIndex = -1
          var videoFormat: MediaFormat? = null
          for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("video/")) {
              videoTrackIndex = i
              videoFormat = format
              break
            }
          }
          if (videoTrackIndex < 0 || videoFormat == null) {
            throw IllegalArgumentException("No video track found in file")
          }
          extractor.selectTrack(videoTrackIndex)

          val mime = videoFormat.getString(MediaFormat.KEY_MIME)!!
          val width = videoFormat.getInteger(MediaFormat.KEY_WIDTH)
          val height = videoFormat.getInteger(MediaFormat.KEY_HEIGHT)
          val rotation = if (videoFormat.containsKey(MediaFormat.KEY_ROTATION))
            videoFormat.getInteger(MediaFormat.KEY_ROTATION) else 0
          val durationUs = if (videoFormat.containsKey(MediaFormat.KEY_DURATION))
            videoFormat.getLong(MediaFormat.KEY_DURATION) else 0L

          // 3. Create PoseLandmarker in VIDEO mode (separate instance)
          landmarker = createLandmarker(modelVariant, RunningMode.VIDEO)

          // 4. Create MediaCodec decoder
          codec = MediaCodec.createDecoderByType(mime)
          codec.configure(videoFormat, null, null, 0) // ByteBuffer mode
          codec.start()

          // 5. Decode + inference loop
          val bufferInfo = MediaCodec.BufferInfo()
          var inputEos = false
          val results = mutableListOf<Map<String, Any?>>()

          var lastProcessedTimeUs = -1L
          val intervalUs = if (targetFps > 0) (1_000_000.0 / targetFps).toLong() else 0L

          var decodedFrameCount = 0
          var processedFrameCount = 0
          var samplingSkippedFrameCount = 0
          var decodeDroppedFrameCount = 0
          var lastMonotonicMs = -1L

          val imageProcessingOptions = if (rotation != 0) {
            ImageProcessingOptions.builder()
              .setRotationDegrees(rotation)
              .build()
          } else null

          val effectiveMaxFrames = if (maxFrames > 0) maxFrames else Int.MAX_VALUE

          while (true) {
            // Feed input buffers
            if (!inputEos) {
              val inputIndex = codec.dequeueInputBuffer(10_000)
              if (inputIndex >= 0) {
                val inputBuffer = codec.getInputBuffer(inputIndex)!!
                val sampleSize = extractor.readSampleData(inputBuffer, 0)
                if (sampleSize < 0) {
                  codec.queueInputBuffer(
                    inputIndex, 0, 0, 0,
                    MediaCodec.BUFFER_FLAG_END_OF_STREAM
                  )
                  inputEos = true
                } else {
                  val sampleTime = extractor.sampleTime
                  codec.queueInputBuffer(inputIndex, 0, sampleSize, sampleTime, 0)
                  extractor.advance()
                }
              }
            }

            // Drain output buffers
            val outputIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000)
            if (outputIndex >= 0) {
              val presentationTimeUs = bufferInfo.presentationTimeUs

              if (bufferInfo.size > 0) {
                decodedFrameCount++

                // Sampling: skip frames that are too close to the last processed frame
                val shouldProcess = processedFrameCount < effectiveMaxFrames &&
                    (lastProcessedTimeUs < 0 ||
                        intervalUs == 0L ||
                        (presentationTimeUs - lastProcessedTimeUs) >= intervalUs)

                if (shouldProcess) {
                  try {
                    val image = codec.getOutputImage(outputIndex)
                    if (image != null) {
                      try {
                        // Convert YUV Image to Bitmap for MediaPipe
                        val bitmap = yuvImageToBitmap(image, width, height)
                        try {
                          val rotatedBitmap = applyRotation(bitmap, rotation)
                          val bitmapToUse = if (rotatedBitmap !== bitmap) {
                            bitmap.recycle()
                            rotatedBitmap
                          } else bitmap

                          try {
                            val mpImage = BitmapImageBuilder(bitmapToUse).build()

                            // Ensure monotonic timestamps (in ms)
                            val timestampMs = presentationTimeUs / 1000
                            val safeTimestampMs = if (timestampMs <= lastMonotonicMs) {
                              lastMonotonicMs + 1
                            } else timestampMs

                            val inferenceStartNs = SystemClock.elapsedRealtimeNanos()
                            val poseResult = if (imageProcessingOptions != null) {
                              landmarker.detectForVideo(mpImage, safeTimestampMs, imageProcessingOptions)
                            } else {
                              landmarker.detectForVideo(mpImage, safeTimestampMs)
                            }
                            val inferenceDurationMs =
                              (SystemClock.elapsedRealtimeNanos() - inferenceStartNs) / 1_000_000.0

                            val frameResult = convertSingleResult(
                              poseResult, safeTimestampMs, inferenceDurationMs
                            )
                            results.add(frameResult)

                            lastMonotonicMs = safeTimestampMs
                            lastProcessedTimeUs = presentationTimeUs
                            processedFrameCount++
                          } finally {
                            if (bitmapToUse !== bitmap) bitmapToUse.recycle()
                          }
                        } catch (e: Exception) {
                          // Rotation or inference failed for this frame
                          decodeDroppedFrameCount++
                        }
                      } finally {
                        image.close()
                      }
                    } else {
                      decodeDroppedFrameCount++
                    }
                  } catch (e: Exception) {
                    decodeDroppedFrameCount++
                  }
                } else {
                  samplingSkippedFrameCount++
                }
              }

              codec.releaseOutputBuffer(outputIndex, false)

              if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                break
              }
            } else if (outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER && inputEos) {
              // No more output after EOS signaled
              break
            }
            // INFO_OUTPUT_FORMAT_CHANGED and INFO_OUTPUT_BUFFERS_CHANGED are handled implicitly
          }

          val videoResult = mapOf(
            "frames" to results,
            "sourceDurationMs" to (durationUs / 1000),
            "decodedFrameCount" to decodedFrameCount,
            "processedFrameCount" to processedFrameCount,
            "samplingSkippedFrameCount" to samplingSkippedFrameCount,
            "decodeDroppedFrameCount" to decodeDroppedFrameCount,
            "modelVariant" to modelVariant
          )

          promise.resolve(videoResult)

        } catch (e: Exception) {
          promise.reject("ERR_PROCESS_VIDEO", "Video processing failed: ${e.message}", e)
        } finally {
          try { codec?.stop() } catch (_: Exception) {}
          try { codec?.release() } catch (_: Exception) {}
          try { extractor?.release() } catch (_: Exception) {}
          try { landmarker?.close() } catch (_: Exception) {}
        }
      }
    }

    // ── release ──────────────────────────────────────────────────────
    AsyncFunction("release") { promise: Promise ->
      inferenceExecutor.execute {
        try {
          imageLandmarker?.close()
          imageLandmarker = null
          currentImageVariant = null
          videoLandmarker?.close()
          videoLandmarker = null
          currentVideoVariant = null
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ERR_RELEASE", "Failed to release: ${e.message}", e)
        }
      }
    }

    OnDestroy {
      inferenceExecutor.execute {
        imageLandmarker?.close()
        imageLandmarker = null
        videoLandmarker?.close()
        videoLandmarker = null
      }
      inferenceExecutor.shutdown()
    }
  }

  // ── Landmarker management ────────────────────────────────────────

  private fun getOrCreateImageLandmarker(variant: String): PoseLandmarker {
    if (imageLandmarker != null && currentImageVariant == variant) {
      return imageLandmarker!!
    }
    imageLandmarker?.close()
    imageLandmarker = createLandmarker(variant, RunningMode.IMAGE)
    currentImageVariant = variant
    return imageLandmarker!!
  }

  private fun createLandmarker(variant: String, mode: RunningMode): PoseLandmarker {
    val assetName = modelAssetName(variant)

    // Verify asset exists before creating landmarker
    try {
      context.assets.open(assetName).close()
    } catch (e: Exception) {
      throw FileNotFoundException(
        "Model file not found in assets: $assetName. " +
        "Run scripts/download-models.sh to download MediaPipe models."
      )
    }

    val baseOptions = BaseOptions.builder()
      .setModelAssetPath(assetName)
      .build()

    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(mode)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()

    return PoseLandmarker.createFromOptions(context, options)
  }

  private fun modelAssetName(variant: String): String = when (variant) {
    "full" -> "pose_landmarker_full.task"
    "heavy" -> "pose_landmarker_heavy.task"
    else -> "pose_landmarker_lite.task"
  }

  // ── Result conversion ────────────────────────────────────────────

  private fun convertSingleResult(
    result: PoseLandmarkerResult,
    timestampMs: Long,
    inferenceDurationMs: Double
  ): Map<String, Any?> {
    if (result.landmarks().isEmpty()) {
      return mapOf(
        "timestampMs" to timestampMs,
        "landmarks" to emptyList<Any>(),
        "worldLandmarks" to emptyList<Any>(),
        "inferenceDurationMs" to inferenceDurationMs
      )
    }

    // First (and only) detected pose
    val landmarks = result.landmarks()[0]
    val worldLandmarks = if (result.worldLandmarks().isNotEmpty()) {
      result.worldLandmarks()[0]
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

    return mapOf(
      "timestampMs" to timestampMs,
      "landmarks" to landmarkList,
      "worldLandmarks" to worldLandmarkList,
      "inferenceDurationMs" to inferenceDurationMs
    )
  }

  // ── Bitmap loading ───────────────────────────────────────────────

  private fun loadBitmapFromUri(uriString: String): Bitmap? {
    return try {
      val uri = Uri.parse(uriString)
      if (uri.scheme == "file" || uri.scheme == null) {
        val path = uri.path ?: return null
        BitmapFactory.decodeFile(path)
      } else {
        val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
        inputStream?.use { BitmapFactory.decodeStream(it) }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun readExifRotation(uriString: String): Int {
    return try {
      val uri = Uri.parse(uriString)
      val path = uri.path ?: return 0
      val exif = ExifInterface(path)
      when (exif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90
        ExifInterface.ORIENTATION_ROTATE_180 -> 180
        ExifInterface.ORIENTATION_ROTATE_270 -> 270
        else -> 0
      }
    } catch (_: Exception) {
      0
    }
  }

  private fun applyRotation(bitmap: Bitmap, degrees: Int): Bitmap {
    if (degrees == 0) return bitmap
    val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  // ── YUV → Bitmap conversion ──────────────────────────────────────

  private fun yuvImageToBitmap(image: android.media.Image, width: Int, height: Int): Bitmap {
    val yBuffer = image.planes[0].buffer
    val uBuffer = image.planes[1].buffer
    val vBuffer = image.planes[2].buffer

    val yRowStride = image.planes[0].rowStride
    val yPixelStride = image.planes[0].pixelStride
    val uvRowStride = image.planes[1].rowStride
    val uvPixelStride = image.planes[1].pixelStride

    val argb = IntArray(width * height)

    for (row in 0 until height) {
      for (col in 0 until width) {
        val yIndex = row * yRowStride + col * yPixelStride
        val uvIndex = (row / 2) * uvRowStride + (col / 2) * uvPixelStride

        val yVal = (yBuffer[yIndex].toInt() and 0xFF).toFloat()
        val uVal = (uBuffer[uvIndex].toInt() and 0xFF).toFloat() - 128f
        val vVal = (vBuffer[uvIndex].toInt() and 0xFF).toFloat() - 128f

        var r = (yVal + 1.370705f * vVal).toInt()
        var g = (yVal - 0.337633f * uVal - 0.698001f * vVal).toInt()
        var b = (yVal + 1.732446f * uVal).toInt()

        r = r.coerceIn(0, 255)
        g = g.coerceIn(0, 255)
        b = b.coerceIn(0, 255)

        argb[row * width + col] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
      }
    }

    return Bitmap.createBitmap(argb, width, height, Bitmap.Config.ARGB_8888)
  }
}
