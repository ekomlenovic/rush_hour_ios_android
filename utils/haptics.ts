import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
export { Haptics };
import { useGameStore } from '../store/gameStore';

/**
 * On Android, expo-haptics' impact/notification/selection APIs are emulated with raw
 * `Vibrator` waveforms at very low amplitudes (30-70/255), which are barely or not at
 * all perceptible on devices with amplitude control. We use the system haptic engine
 * (`View.performHapticFeedback`) instead, like iOS does with UIFeedbackGenerator.
 */
const ANDROID_IMPACT: Record<Haptics.ImpactFeedbackStyle, Haptics.AndroidHaptics> = {
  [Haptics.ImpactFeedbackStyle.Light]: Haptics.AndroidHaptics.Context_Click,
  [Haptics.ImpactFeedbackStyle.Soft]: Haptics.AndroidHaptics.Context_Click,
  [Haptics.ImpactFeedbackStyle.Medium]: Haptics.AndroidHaptics.Virtual_Key,
  [Haptics.ImpactFeedbackStyle.Rigid]: Haptics.AndroidHaptics.Virtual_Key,
  [Haptics.ImpactFeedbackStyle.Heavy]: Haptics.AndroidHaptics.Long_Press,
};

const ANDROID_NOTIFICATION: Record<Haptics.NotificationFeedbackType, Haptics.AndroidHaptics> = {
  [Haptics.NotificationFeedbackType.Success]: Haptics.AndroidHaptics.Confirm,
  [Haptics.NotificationFeedbackType.Warning]: Haptics.AndroidHaptics.Reject,
  [Haptics.NotificationFeedbackType.Error]: Haptics.AndroidHaptics.Reject,
};

/**
 * Plays the Android system haptic, falling back to the Vibrator-based API when the
 * constant isn't available on this API level (e.g. Confirm/Reject require Android 11).
 */
async function playAndroid(type: Haptics.AndroidHaptics, fallback: () => Promise<void>) {
  try {
    await Haptics.performAndroidHapticsAsync(type);
  } catch {
    await fallback();
  }
}

// Haptics are fire-and-forget: never surface a native failure as an unhandled rejection.
async function safely(play: () => Promise<void>) {
  if (!useGameStore.getState().isHapticsEnabled) return;
  try {
    await play();
  } catch {}
}

/**
 * Custom wrapper for Haptics that checks if haptics are enabled in the game store.
 */
export const haptics = {
  impactAsync: (style: Haptics.ImpactFeedbackStyle) =>
    safely(() =>
      Platform.OS === 'android'
        ? playAndroid(ANDROID_IMPACT[style], () => Haptics.impactAsync(style))
        : Haptics.impactAsync(style),
    ),
  notificationAsync: (type: Haptics.NotificationFeedbackType) =>
    safely(() =>
      Platform.OS === 'android'
        ? playAndroid(ANDROID_NOTIFICATION[type], () => Haptics.notificationAsync(type))
        : Haptics.notificationAsync(type),
    ),
  selectionAsync: () =>
    safely(() =>
      Platform.OS === 'android'
        ? playAndroid(Haptics.AndroidHaptics.Context_Click, () => Haptics.selectionAsync())
        : Haptics.selectionAsync(),
    ),
};
