import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';
import { getInstallerPackage } from '../modules/rush-device';

/** Native side of the review prompt (issue 318): the rules are in store/reviewPrompt.ts */

const PLAY_STORE_INSTALLER = 'com.android.vending';
const PACKAGE = 'com.rushhours.app';
const PLAY_STORE_PAGE = `https://play.google.com/store/apps/details?id=${PACKAGE}`;

/**
 * The Google Play build: not iOS (SideStore), the web, nor the APK of the GitHub releases
 * (built with EXPO_PUBLIC_DONATION_LINK, see build.yml)
 */
export function isPlayStoreBuild(): boolean {
  return Platform.OS === 'android' && process.env.EXPO_PUBLIC_DONATION_LINK !== '1';
}

/** The Google Play build installed by the Play Store: not one installed by hand (a test build, a copied APK) */
export function isPlayStoreInstall(): boolean {
  return isPlayStoreBuild() && getInstallerPackage() === PLAY_STORE_INSTALLER;
}

/** Google's in-app review window: Google decides whether it shows (its own quota), nothing tells the app */
export async function requestStoreReview(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
  } catch (error) {
    console.warn('[review] request failed', error);
  }
}

/** "Rate the game" of the options: the page of the game in the Play Store app, its web page without it */
export async function openStorePage(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE}`);
  } catch {
    await Linking.openURL(PLAY_STORE_PAGE).catch(() => {});
  }
}
