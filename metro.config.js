// metro.config.js
// SwingSwang
//
// Metro bundler configuration for Expo SDK 57.
// Adds .pte and .bin extensions for ExecuTorch model assets.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add ExecuTorch model file extensions to asset resolution
config.resolver.assetExts.push('pte', 'bin');

module.exports = config;
