import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';
import { planReminders } from './reminders';

const CHANNEL_ID = 'reminders';
const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

if (isSupported) {
  // Reminders are useless while the app is open: keep them silent in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android 8+ needs the channel before scheduling; creating it again is a no-op */
async function ensureChannel(name: string) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Syncs run one after the other, so an outdated one never schedules after a newer one */
let syncQueue: Promise<void> = Promise.resolve();

/** Asks for the permission if needed. Local notifications only, no push token. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!isSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Keeps the scheduled reminders in line with the player's progress: replans everything
 * when the progress or the settings change, and when the app comes back to the foreground.
 */
export function useReminderSync() {
  const { t, i18n } = useTranslation();
  const enabled = useGameStore(s => s.notificationsEnabled);
  const reminderHour = useGameStore(s => s.reminderHour);
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const currentStreak = useGameStore(s => s.currentStreak);
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundCount(c => c + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    let outdated = false;
    const sync = async () => {
      if (outdated) return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!enabled) return;
      const { granted } = await Notifications.getPermissionsAsync();
      if (!granted) return;
      await ensureChannel(t('reminders.channel_name'));

      const completed = (progress: typeof dailyChallengeProgress) =>
        new Set(Object.keys(progress).filter(k => progress[k]?.completed));
      const reminders = planReminders(t, {
        now: new Date(),
        reminderHour,
        completedDailies: completed(dailyChallengeProgress),
        completedWeeklies: completed(weeklyChallengeProgress),
        currentStreak,
      });
      for (const reminder of reminders) {
        if (outdated) return;
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: { title: reminder.title, body: reminder.body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.date,
            channelId: CHANNEL_ID,
          },
        });
      }
    };
    syncQueue = syncQueue
      .then(sync)
      .catch(error => console.error('Reminder sync failed', error));
    return () => {
      outdated = true;
    };
  }, [enabled, reminderHour, dailyChallengeProgress, weeklyChallengeProgress, currentStreak, foregroundCount, i18n.language]);
}
