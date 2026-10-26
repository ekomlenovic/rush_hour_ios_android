import fs from 'fs';
import path from 'path';

const mockNative = { module: null as null | { scannerCamera: () => 'back' | 'front' | null } };
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative.module }));

function load() {
  let getScannerCamera!: typeof import('../modules/rush-device').getScannerCamera;
  jest.isolateModules(() => {
    ({ getScannerCamera } = require('../modules/rush-device'));
  });
  return getScannerCamera;
}

describe('getScannerCamera', () => {
  it('uses the back camera without the native module (iOS, Expo Go)', () => {
    mockNative.module = null;
    expect(load()()).toBe('back');
  });

  it.each(['back', 'front', null] as const)('returns what Android reports: %s', (camera) => {
    mockNative.module = { scannerCamera: () => camera };
    expect(load()()).toBe(camera);
  });

  it('reads the back camera first, then the front one, on Android', () => {
    const kotlin = fs.readFileSync(
      path.join(__dirname, '../modules/rush-device/android/src/main/java/expo/modules/rushdevice/RushDeviceModule.kt'),
      'utf8',
    );
    expect(kotlin.indexOf('FEATURE_CAMERA)')).toBeGreaterThan(-1);
    expect(kotlin.indexOf('FEATURE_CAMERA)')).toBeLessThan(kotlin.indexOf('FEATURE_CAMERA_FRONT'));
  });
});
