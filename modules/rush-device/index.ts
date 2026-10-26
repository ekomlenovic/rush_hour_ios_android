import { requireOptionalNativeModule } from 'expo';

/** Native side, Android only: absent on iOS (every iPhone and iPad has a back camera), in Expo Go, on the web and in the tests */
interface RushDeviceModule {
  scannerCamera(): 'back' | 'front' | null;
}

const RushDevice = requireOptionalNativeModule<RushDeviceModule>('RushDevice');

export type ScannerCamera = 'back' | 'front';

/**
 * The camera the QR code scanner can use, null when the phone has none: the camera is optional
 * in the Android manifest so that Google Play keeps the app on the devices without one
 */
export function getScannerCamera(): ScannerCamera | null {
  return RushDevice ? RushDevice.scannerCamera() : 'back';
}
