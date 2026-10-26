import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore, whenSaveLoaded } from '@/store/gameStore';
import { getFreezeCapacity, getPlayerLevel } from '@/data/progression';
import { buildWidgetData, widgetInput } from '@/utils/widget';
import { isWidgetAvailable, setWidgetData } from '@/modules/rush-widget';

/** Last data written: the widget is redrawn only when what it shows changes */
let written: string | null = null;

/**
 * Keeps the home screen widget in line with the player's progress (issue 151): rewritten at
 * each progress, like the reminders (useReminderSync), and when the app comes back to the foreground.
 */
export function useWidgetSync() {
  const { t, i18n } = useTranslation();
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const currentStreak = useGameStore(s => s.currentStreak);
  const lastStreakDate = useGameStore(s => s.lastStreakDate);
  const streakFreezes = useGameStore(s => s.streakFreezes);
  // The slots, not the XP: it changes at every win
  const freezeCapacity = useGameStore(s => getFreezeCapacity(getPlayerLevel(s.xp)));
  const reminderHour = useGameStore(s => s.reminderHour);
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundCount(c => c + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isWidgetAvailable) return;
    let outdated = false;
    // Written from the loaded save, never from the empty state of the first frames
    whenSaveLoaded().then(() => {
      const state = useGameStore.getState();
      if (outdated || state.saveLoadFailed) return;
      const json = JSON.stringify(buildWidgetData(t, widgetInput(state, new Date())));
      if (json === written) return;
      try {
        setWidgetData(json);
        written = json;
      } catch (error) {
        console.warn('Widget update failed', error);
      }
    });
    return () => {
      outdated = true;
    };
  }, [dailyChallengeProgress, currentStreak, lastStreakDate, streakFreezes, freezeCapacity, reminderHour, foregroundCount, i18n.language]);
}
