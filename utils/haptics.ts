import * as Haptics from 'expo-haptics';
export { Haptics };
import { useGameStore } from '../store/gameStore';

/**
 * Custom wrapper for Haptics that checks if haptics are enabled in the game store.
 */
export const haptics = {
  impactAsync: async (style: Haptics.ImpactFeedbackStyle) => {
    if (useGameStore.getState().isHapticsEnabled) {
      return Haptics.impactAsync(style);
    }
  },
  notificationAsync: async (type: Haptics.NotificationFeedbackType) => {
    if (useGameStore.getState().isHapticsEnabled) {
      return Haptics.notificationAsync(type);
    }
  },
  selectionAsync: async () => {
    if (useGameStore.getState().isHapticsEnabled) {
      return Haptics.selectionAsync();
    }
  },
};
