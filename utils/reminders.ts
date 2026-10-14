import type { TFunction } from 'i18next';
import { addDays, getLocalDateString, getWeekKey, parseLocalDateString } from './date';

export const DEFAULT_REMINDER_HOUR = 19;
/** "Streak in danger" comes this many hours after the daily reminder */
const STREAK_DANGER_DELAY_HOURS = 2;
/** Daily reminders are planned this many days ahead; reopening the app replans them */
const DAYS_AHEAD = 7;
const WEEKLY_REMINDER_HOUR = 10;

export interface ReminderInput {
  now: Date;
  reminderHour: number;
  /** YYYY-MM-DD keys of the completed dailies */
  completedDailies: Set<string>;
  /** YYYY-Www keys of the completed weeklies */
  completedWeeklies: Set<string>;
  currentStreak: number;
}

export interface PlannedReminder {
  id: string;
  date: Date;
  title: string;
  body: string;
}

function at(dateKey: string, hour: number): Date {
  const date = parseLocalDateString(dateKey);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/**
 * Local reminders to schedule from now on. Nothing is sent for a challenge already done,
 * and nothing in the past. Pure: the caller schedules them.
 */
export function planReminders(t: TFunction, input: ReminderInput): PlannedReminder[] {
  const { now, reminderHour, completedDailies, completedWeeklies, currentStreak } = input;
  const today = getLocalDateString(now);
  const reminders: PlannedReminder[] = [];

  // Daily challenge, every day not done yet
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    if (completedDailies.has(day)) continue;
    reminders.push({
      id: `daily-${day}`,
      date: at(day, reminderHour),
      title: t('reminders.daily_title'),
      body: t('reminders.daily_body'),
    });
  }

  // Streak in danger, on the first day the daily is still to do
  if (currentStreak > 0) {
    const day = completedDailies.has(today) ? addDays(today, 1) : today;
    reminders.push({
      id: `streak-${day}`,
      date: at(day, Math.min(reminderHour + STREAK_DANGER_DELAY_HOURS, 23)),
      title: t('reminders.streak_title'),
      body: t('reminders.streak_body', { count: currentStreak }),
    });
  }

  // New weekly challenge, on the next Monday (or this Monday morning if it is not done yet)
  const daysToMonday = (8 - now.getDay()) % 7;
  let monday = addDays(today, daysToMonday === 0 ? 0 : daysToMonday);
  if (daysToMonday === 0 && (completedWeeklies.has(getWeekKey(now)) || at(monday, WEEKLY_REMINDER_HOUR) <= now)) {
    monday = addDays(today, 7);
  }
  reminders.push({
    id: `weekly-${monday}`,
    date: at(monday, WEEKLY_REMINDER_HOUR),
    title: t('reminders.weekly_title'),
    body: t('reminders.weekly_body'),
  });

  return reminders
    .filter(r => r.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
