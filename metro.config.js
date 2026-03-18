const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add .wasm to asset extensions so Metro can resolve expo-sqlite web worker
config.resolver.assetExts = [...(config.resolver.assetExts || []), "wasm"];

module.exports = config;
