import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SOURCE_BASE_URL = 'https://raw.githubusercontent.com/ekomlenovic/rush_hour_ios_android/refs/heads/main';
const SOURCE_URL = Platform.OS === 'ios' 
  ? `${SOURCE_BASE_URL}/sidestore-source.json`
  : `${SOURCE_BASE_URL}/android-source.json`;

export interface UpdateInfo {
  isUpdateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadURL?: string;
  isStoreUpdate?: boolean; // True if downloading via Play Store/App Store
  error?: string;
}

/**
 * Checks if a new version of the app is available on GitHub.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = Constants.expoConfig?.version || '0.0.0';

  try {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch update info: ${response.status}`);
    }

    const data = await response.json();
    const latestApp = data.apps?.[0];

    if (!latestApp || !latestApp.version) {
      throw new Error('Invalid update information received');
    }

    const latestVersion = latestApp.version;
    const downloadURL = latestApp.downloadURL;

    const isStoreUpdate = downloadURL?.includes('play.google.com') || downloadURL?.includes('apps.apple.com') || downloadURL?.startsWith('market://');

    return {
      isUpdateAvailable: isVersionGreater(latestVersion, currentVersion),
      latestVersion,
      currentVersion,
      downloadURL,
      isStoreUpdate,
    };
  } catch (error) {
    console.error('Update check failed:', error);
    return {
      isUpdateAvailable: false,
      latestVersion: '0.0.0',
      currentVersion,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compares two semantic version strings.
 * Returns true if v1 > v2.
 */
function isVersionGreater(v1: string, v2: string): boolean {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }

  return false;
}
