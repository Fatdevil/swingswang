import ExpoModulesCore
import MediaPipeTasksVision
import UIKit

public class MediaPipePoseModule: Module {
  private var poseLandmarker: PoseLandmarker?
  private var currentVariant: String?

  public func definition() -> ModuleDefinition {
    Name("MediaPipePose")

    AsyncFunction("initialize") { (modelVariant: String) in
      try self.initializeLandmarker(modelVariant: modelVariant)
    }

    AsyncFunction("detectPose") { (imageUri: String, modelVariant: String) -> [[String: Any]] in
      // Auto-initialize if needed
      if self.poseLandmarker == nil || self.currentVariant != modelVariant {
        try self.initializeLandmarker(modelVariant: modelVariant)
      }

      guard let landmarker = self.poseLandmarker else {
        throw NSError(domain: "MediaPipePose", code: 1, userInfo: [NSLocalizedDescriptionKey: "PoseLandmarker not initialized"])
      }

      // Load image
      guard let image = self.loadImage(from: imageUri) else {
        throw NSError(domain: "MediaPipePose", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not load image from URI: \(imageUri)"])
      }

      guard let mpImage = try? MPImage(uiImage: image) else {
        throw NSError(domain: "MediaPipePose", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not create MPImage"])
      }

      let result = try landmarker.detect(image: mpImage)

      var poses: [[String: Any]] = []

      for i in 0..<result.landmarks.count {
        let landmarks = result.landmarks[i]
        let worldLandmarks = i < result.worldLandmarks.count ? result.worldLandmarks[i] : []

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

        poses.append([
          "landmarks": landmarkList,
          "worldLandmarks": worldLandmarkList,
          "timestampMs": Int(Date().timeIntervalSince1970 * 1000)
        ])
      }

      return poses
    }

    AsyncFunction("release") {
      self.poseLandmarker = nil
      self.currentVariant = nil
    }

    OnDestroy {
      self.poseLandmarker = nil
    }
  }

  private func initializeLandmarker(modelVariant: String) throws {
    poseLandmarker = nil

    let modelName: String
    switch modelVariant {
    case "full":
      modelName = "pose_landmarker_full"
    case "heavy":
      modelName = "pose_landmarker_heavy"
    default:
      modelName = "pose_landmarker_lite"
    }

    guard let modelPath = Bundle.main.path(forResource: modelName, ofType: "task") else {
      throw NSError(domain: "MediaPipePose", code: 4, userInfo: [NSLocalizedDescriptionKey: "Model file not found: \(modelName).task"])
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

  private func loadImage(from uriString: String) -> UIImage? {
    if let url = URL(string: uriString), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    // Try as a direct path
    return UIImage(contentsOfFile: uriString)
  }
}
