Pod::Spec.new do |s|
  s.name           = 'MediaPipePose'
  s.version        = '1.0.0'
  s.summary        = 'MediaPipe Pose Landmarker for SwingSwang'
  s.description    = 'Expo module wrapping MediaPipe Pose Landmarker for on-device pose estimation'
  s.homepage       = 'https://github.com/swingswang'
  s.license        = { type: 'Apache-2.0' }
  s.author         = 'SwingSwang'
  s.source         = { git: '' }

  s.platform       = :ios, '16.0'
  s.swift_version  = '5.9'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '~> 0.10.21'
end
