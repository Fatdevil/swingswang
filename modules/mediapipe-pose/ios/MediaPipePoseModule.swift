import ExpoModulesCore
import MediaPipeTasksVision
import UIKit

/**
 * MediaPipePoseModule — iOS
 *
 * Status: PARTIAL — detectImage works, processVideo returns NOT_IMPLEMENTED.
 * Full AVAssetReader video pipeline deferred until Android architecture is proven.
 */
public class MediaPipePoseModule: Module {
  private var poseLandmarker: PoseLandmarker?
  private var currentVariant: String?

  public func definition() -> ModuleDefinition {
    Name("MediaPipePose")

    // ── isAvailable ──────────────────────────────────────────────────
    AsyncFunction("isAvailable") { (modelVariant: String) -> Bool in
      let modelName = self.modelName(for: modelVariant)
      return Bundle.main.path(forResource: modelName, ofType: "task") != nil
    }

    // ── detectImage ──────────────────────────────────────────────────
    AsyncFunction("detectImage") { (imageUri: String, modelVariant: String) -> [String: Any?] in
      if self.poseLandmarker == nil || self.currentVariant != modelVariant {
        try self.initializeLandmarker(modelVariant: modelVariant)
      }

      guard let landmarker = self.poseLandmarker else {
        throw NSError(domain: "MediaPipePose", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "PoseLandmarker not initialized"])
      }

      guard let image = self.loadImage(from: imageUri) else {
        throw NSError(domain: "MediaPipePose", code: 2,
          userInfo: [NSLocalizedDescriptionKey: "Could not load image from URI: \(imageUri)"])
      }

      guard let mpImage = try? MPImage(uiImage: image) else {
        throw NSError(domain: "MediaPipePose", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Could not create MPImage"])
      }

      let startTime = CFAbsoluteTimeGetCurrent()
      let result = try landmarker.detect(image: mpImage)
      let inferenceDurationMs = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0

      return self.convertSingleResult(result: result, timestampMs: 0, inferenceDurationMs: inferenceDurationMs)
    }

    // ── processVideo — NOT IMPLEMENTED on iOS ────────────────────────
    AsyncFunction("processVideo") { (videoUri: String, modelVariant: String, targetFps: Double, maxFrames: Int) -> [String: Any] in
      throw NSError(domain: "MediaPipePose", code: 100,
        userInfo: [
          NSLocalizedDescriptionKey: "IOS_VIDEO_NOT_IMPLEMENTED: Video processing is not yet available on iOS. Use Android for R0 verification.",
          "code": "IOS_VIDEO_NOT_IMPLEMENTED"
        ])
    }

    // ── release ──────────────────────────────────────────────────────
    AsyncFunction("release") {
      self.poseLandmarker = nil
      self.currentVariant = nil
    }

    OnDestroy {
      self.poseLandmarker = nil
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  private func modelName(for variant: String) -> String {
    switch variant {
    case "full": return "pose_landmarker_full"
    case "heavy": return "pose_landmarker_heavy"
    default: return "pose_landmarker_lite"
    }
  }

  private func initializeLandmarker(modelVariant: String) throws {
    poseLandmarker = nil

    let name = modelName(for: modelVariant)
    guard let modelPath = Bundle.main.path(forResource: name, ofType: "task") else {
      throw NSError(domain: "MediaPipePose", code: 4,
        userInfo: [NSLocalizedDescriptionKey: "Model file not found: \(name).task. Run scripts/download-models.sh."])
    }

    let baseOptions = BaseOptions()
    baseOptions.modelAssetPath = modelPath

    let options = PoseLandmarkerOptions()
    options.baseOptions = baseOptions
    options.runningMode = .image
    options.numPoses = 1
    options.minPoseDetectionConfidence = 0.5
    options.minPosePresenceConfidence = 0.5
    options.minTrackingConfidence = 0.5

    poseLandmarker = try PoseLandmarker(options: options)
    currentVariant = modelVariant
  }

  private func convertSingleResult(result: PoseLandmarkerResult, timestampMs: Int, inferenceDurationMs: Double) -> [String: Any?] {
    guard !result.landmarks.isEmpty else {
      return [
        "timestampMs": timestampMs,
        "landmarks": [] as [[String: Double]],
        "worldLandmarks": [] as [[String: Double]],
        "inferenceDurationMs": inferenceDurationMs
      ]
    }

    let landmarks = result.landmarks[0]
    let worldLandmarks = result.worldLandmarks.isEmpty ? [] : result.worldLandmarks[0]

    let landmarkList: [[String: Double]] = landmarks.map { lm in
      [
        "x": Double(lm.x),
        "y": Double(lm.y),
        "z": Double(lm.z),
        "visibility": Double(lm.visibility?.doubleValue ?? 0),
        "presence": Double(lm.presence?.doubleValue ?? 0)
      ]
    }

    let worldLandmarkList: [[String: Double]] = worldLandmarks.map { lm in
      [
        "x": Double(lm.x),
        "y": Double(lm.y),
        "z": Double(lm.z),
        "visibility": Double(lm.visibility?.doubleValue ?? 0),
        "presence": Double(lm.presence?.doubleValue ?? 0)
      ]
    }

    return [
      "timestampMs": timestampMs,
      "landmarks": landmarkList,
      "worldLandmarks": worldLandmarkList,
      "inferenceDurationMs": inferenceDurationMs
    ]
  }

  private func loadImage(from uriString: String) -> UIImage? {
    if let url = URL(string: uriString), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    return UIImage(contentsOfFile: uriString)
  }
}
