/**
 * Mock for modules/mediapipe-pose
 * Used by Jest when the native module is not available.
 */
module.exports = {
  isAvailable: jest.fn().mockResolvedValue(false),
  detectImage: jest.fn().mockRejectedValue(new Error('Native module not available in test')),
  processVideo: jest.fn().mockRejectedValue(new Error('Native module not available in test')),
  release: jest.fn().mockResolvedValue(undefined),
  default: {
    isAvailable: jest.fn().mockResolvedValue(false),
    detectImage: jest.fn().mockRejectedValue(new Error('Native module not available in test')),
    processVideo: jest.fn().mockRejectedValue(new Error('Native module not available in test')),
    release: jest.fn().mockResolvedValue(undefined),
  },
};
