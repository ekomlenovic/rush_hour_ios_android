/**
 * @jest-environment node
 */
import path from 'path';
import { compileModsAsync } from '@expo/config-plugins';
import { getPrebuildConfigAsync } from '@expo/prebuild-config';

// What `expo prebuild` writes in the Android manifest and the iOS Info.plist (introspection, no native folder)
const projectRoot = path.join(__dirname, '..');

// Unused by the app: removed from the merged manifest, the libraries' ones included
const BLOCKED = [
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

type Permission = { $: { 'android:name': string; 'tools:node'?: string } };

let manifest: any;
let infoPlist: Record<string, unknown>;

beforeAll(async () => {
  const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms: ['android', 'ios'] });
  const config = await compileModsAsync(exp, { projectRoot, introspect: true, platforms: ['android', 'ios'], assertMissingModProviders: false });
  manifest = config._internal?.modResults?.android?.manifest?.manifest;
  infoPlist = config._internal?.modResults?.ios?.infoPlist ?? {};
}, 120000);

describe('Android manifest', () => {
  it('only declares the permissions the app uses', () => {
    const permissions: Permission[] = manifest['uses-permission'] ?? [];
    const kept = permissions.filter((p) => p.$['tools:node'] !== 'remove').map((p) => p.$['android:name']);
    // Camera: the QR code scanner (components/QrScanner.tsx)
    expect(kept.sort()).toEqual(['android.permission.CAMERA', 'android.permission.INTERNET', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.VIBRATE']);
  });

  it('removes the unused permissions added by the libraries', () => {
    const removed = (manifest['uses-permission'] as Permission[]).filter((p) => p.$['tools:node'] === 'remove').map((p) => p.$['android:name']);
    expect(removed.sort()).toEqual([...BLOCKED].sort());
  });

  it('declares no media playback service', () => {
    const services: { $: Record<string, string> }[] = manifest.application?.[0]?.service ?? [];
    expect(services.filter((s) => s.$['android:foregroundServiceType'] === 'mediaPlayback')).toEqual([]);
    expect(services.map((s) => s.$['android:name'])).not.toContain('expo.modules.audio.service.AudioControlsService');
  });

  it('requires no hardware feature, the camera included (Play would hide the app without one)', () => {
    const features: { $: Record<string, string> }[] = manifest['uses-feature'] ?? [];
    expect(features.filter((f) => f.$['android:required'] !== 'false')).toEqual([]);
    expect(features.map((f) => f.$['android:name']).sort()).toEqual(['android.hardware.camera', 'android.hardware.camera.autofocus']);
  });
});

describe('iOS Info.plist', () => {
  it('has no background audio mode', () => {
    expect((infoPlist.UIBackgroundModes as string[] | undefined) ?? []).not.toContain('audio');
  });

  it('asks for no microphone access', () => {
    expect(infoPlist.NSMicrophoneUsageDescription).toBeUndefined();
  });

  it('says why it asks for the camera', () => {
    expect(infoPlist.NSCameraUsageDescription).toMatch(/QR code/);
  });
});
