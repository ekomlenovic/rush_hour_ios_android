const { withAndroidManifest } = require('expo/config-plugins');

// Implied as required by the CAMERA permission when not declared
const CAMERA_FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus'];

/**
 * The camera only serves the QR code scanner, the app works without it. Google Play
 * reads the CAMERA permission as "a back camera with autofocus is required" and hides
 * the app on the devices without one (Chromebooks, cars, TVs, some tablets): declare
 * these features as optional.
 */
module.exports = function withOptionalCamera(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = (manifest['uses-feature'] ?? []).filter(
      (f) => !CAMERA_FEATURES.includes(f.$['android:name']),
    );
    for (const name of CAMERA_FEATURES) {
      features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    manifest['uses-feature'] = features;
    return config;
  });
};
