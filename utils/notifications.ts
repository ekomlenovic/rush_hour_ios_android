import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';
import { planReminders } from './reminders';
import { monthKeyOf, yearKeyOf } from '../store/periodStats';

const CHANNEL_ID = 'reminders';

/**
 * expo-notifications, or null where it cannot run. Expo Go on Android throws as soon as
 * the module is imported (SDK 53+): imported at the top, it took the whole root layout
 * down with it. There, reminders are off and the rest of the app works.
 */
function loadNotifications(): typeof import('expo-notifications') | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    return require('expo-notifications');
  } catch (error) {
    console.warn('Reminders unavailable', error);
    return null;
  }
}

const Notifications = loadNotifications();

if (Notifications) {
  // Reminders are useless while the app is open: keep them silent in foreground,
  // except the test one from the options, which must show to be of any use
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isTest = notification.request.content.data?.test === true;
      return {
        shouldShowBanner: isTest,
        shouldShowList: isTest,
        shouldPlaySound: isTest,
        shouldSetBadge: false,
      };
    },
  });
}

/** Android 8+ needs the channel before scheduling; creating it again is a no-op */
async function ensureChannel(name: string) {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Syncs run one after the other, so an outdated one never schedules after a newer one */
let syncQueue: Promise<void> = Promise.resolve();

/** Delay of the test notification, long enough to leave the app and see it as a reminder */
export const TEST_REMINDER_DELAY_SECONDS = 5;

/** Asks for the permission if needed. Local notifications only, no push token. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!Notifications) return false;
  // Android 13+ shows the permission prompt only once the app has a notification channel
  await ensureChannel(i18n.t('reminders.channel_name'));
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Sends a reminder in a few seconds, to check that they reach the phone.
 * False when notifications are unavailable here (Expo Go on Android) or not allowed.
 */
export async function sendTestReminder(): Promise<boolean> {
  if (!Notifications || !(await requestReminderPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: 'test',
    content: {
      title: i18n.t('reminders.daily_title'),
      body: i18n.t('reminders.daily_body'),
      data: { test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_REMINDER_DELAY_SECONDS,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

/** The screen a touched reminder opens, null for none (the test one, an action button) */
function reminderLink(response: import('expo-notifications').NotificationResponse): string | null {
  if (!Notifications || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const url = response.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}

/**
 * Opens the screen a touched reminder announces (issue 191): the one that launched the app,
 * then each one touched while it runs. Returns the cleanup; a no-op where notifications are off.
 */
export function listenToReminderTaps(open: (url: string) => void): () => void {
  if (!Notifications) return () => {};
  const notifications = Notifications;
  let lastHandled: string | null = null;
  const handle = (response: import('expo-notifications').NotificationResponse | null) => {
    if (!response) return;
    // The response that launched the app can also reach the listener: opened once
    const key = `${response.notification.request.identifier}@${response.notification.date}`;
    if (key === lastHandled) return;
    lastHandled = key;
    // Not opened again by the next launch
    notifications.clearLastNotificationResponse();
    const url = reminderLink(response);
    if (url) open(url);
  };
  handle(notifications.getLastNotificationResponse());
  const subscription = notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
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
  // Booleans: they change once a month, not at every move
  const playedThisMonth = useGameStore(s => !!s.monthlyStats[monthKeyOf(new Date())]);
  const playedThisYear = useGameStore(s => !!s.yearlyStats[yearKeyOf(new Date())]);
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundCount(c => c + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!Notifications) return;
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
        playedThisMonth,
        playedThisYear,
        language: i18n.language,
      });
      for (const reminder of reminders) {
        if (outdated) return;
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: { title: reminder.title, body: reminder.body, data: { url: reminder.url } },
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
  }, [enabled, reminderHour, dailyChallengeProgress, weeklyChallengeProgress, currentStreak, playedThisMonth, playedThisYear, foregroundCount, i18n.language]);
}
