import type { TFunction } from 'i18next';
import type { ChallengeResult } from '../store/types';
import { settleStreak, type StreakState } from '../store/streak';
import { getFreezeCapacity, getPlayerLevel } from '../data/progression';
import { addDays, getLocalDateString } from './date';
import { TIME_ZONE_TOLERANCE_DAYS } from './challengeDates';
import { streakDangerHour } from './reminders';

/**
 * Home screen widget (issue 151): streak, freezes and the daily challenge, without opening the app.
 * The app works out what the widget shows on each day to come, the widget picks the entry of
 * its own date: at midnight it shows the next day without the app (rules in docs/GAME_DESIGN.md).
 * A derived copy kept on the phone only: never in the store, never in the save.
 */

/** Format of the data read by the widgets (modules/rush-widget, targets/widget): bump it on any change */
export const WIDGET_DATA_VERSION = 1;

/** Opens today's daily: the app adds the date when it opens the link, not when the widget was drawn */
export const WIDGET_DAILY_LINK = 'rush-hours://game?levelId=daily';

/** At most this many days ahead: far more than the freezes can cover */
const MAX_WIDGET_DAYS = 31;

/** What the widget shows on one day */
export interface WidgetDay {
  /** Local YYYY-MM-DD key */
  date: string;
  /** The streak as the app shows it that day: days missed are settled (freezes, or 0 once lost) */
  streak: number;
  freezes: number;
  done: boolean;
  /** Stars of the daily, 0 while it is not done */
  stars: number;
  /** "days" under the streak */
  unit: string;
  /** "To do" / "Done" */
  status: string;
  /** Read in one go by VoiceOver / TalkBack */
  label: string;
  /** Daily not done yet with a streak to lose: "streak in danger" in the evening */
  danger: boolean;
}

export interface WidgetData {
  version: number;
  /** Freeze slots (filled or empty) */
  capacity: number;
  /** Hour from which an unfinished daily puts the streak in danger, as the reminder says */
  dangerHour: number;
  link: string;
  texts: {
    /** Name of the widget: "Daily challenge" above the status */
    daily: string;
    /** Medium widget: countdown once the daily is done */
    nextIn: string;
    /** Medium widget, in the evening */
    danger: string;
    /** Medium widget, countdown under "streak in danger" */
    timeLeft: string;
    /** Medium widget, otherwise */
    play: string;
  };
  /**
   * Today, then the days to come until nothing changes any more. A date after the last one
   * shows the last one, a date before the first one shows the first one (widgetDayFor).
   */
  days: WidgetDay[];
}

export interface WidgetInput extends Omit<StreakState, 'bestStreak'> {
  now: Date;
  freezeCapacity: number;
  dangerHour: number;
  dailyChallengeProgress: Record<string, ChallengeResult>;
}

/** Saved fields the widget is computed from */
export type WidgetSource = Omit<StreakState, 'bestStreak'> & Pick<WidgetInput, 'dailyChallengeProgress'> & {
  xp: number;
  reminderHour: number;
};

export function widgetInput(state: WidgetSource, now: Date): WidgetInput {
  const { currentStreak, lastStreakDate, streakFreezes, frozenDates, stats, dailyChallengeProgress } = state;
  return {
    now,
    currentStreak,
    lastStreakDate,
    streakFreezes,
    frozenDates,
    stats,
    dailyChallengeProgress,
    freezeCapacity: getFreezeCapacity(getPlayerLevel(state.xp)),
    dangerHour: streakDangerHour(state.reminderHour),
  };
}

function widgetDay(t: TFunction, input: WidgetInput, date: string): WidgetDay {
  const settled = { ...input, ...settleStreak(input, date).patch };
  const result = input.dailyChallengeProgress[date];
  const done = !!result?.completed;
  const stars = done ? result.stars : 0;
  const streak = settled.currentStreak;
  const freezes = settled.streakFreezes;
  return {
    date,
    streak,
    freezes,
    done,
    stars,
    unit: t('widget.streak_days', { count: streak }),
    status: done ? t('widget.done') : t('widget.todo'),
    label: [
      t('widget.a11y_streak', { count: streak }),
      t('widget.a11y_freezes', { count: freezes }),
      done ? t('widget.a11y_done', { count: stars }) : t('widget.a11y_todo'),
    ].join(', '),
    danger: !done && streak > 0,
  };
}

/** Everything the widget needs, in the language of the app */
export function buildWidgetData(t: TFunction, input: WidgetInput): WidgetData {
  const today = getLocalDateString(input.now);
  const days: WidgetDay[] = [];
  for (let i = 0; i < MAX_WIDGET_DAYS; i++) {
    const day = widgetDay(t, input, addDays(today, i));
    days.push(day);
    // A lost streak stays at 0 and its freezes are kept: every day after is the same
    // (a save made ahead in time can still hold a win tomorrow)
    if (i > TIME_ZONE_TOLERANCE_DAYS && day.streak === 0) break;
  }
  return {
    version: WIDGET_DATA_VERSION,
    capacity: input.freezeCapacity,
    dangerHour: input.dangerHour,
    link: WIDGET_DAILY_LINK,
    texts: {
      daily: t('widget.daily'),
      nextIn: t('widget.next_in'),
      danger: t('widget.danger'),
      timeLeft: t('widget.time_left'),
      play: t('widget.play'),
    },
    days,
  };
}

/**
 * The entry a widget shows on a date. The widgets do the same (WidgetData.swift, WidgetData.kt):
 * a date key compared with the others, no "done" flag that would outlive midnight.
 */
export function widgetDayFor(data: WidgetData, dateKey: string): WidgetDay {
  const { days } = data;
  return days.find(day => day.date === dateKey)
    ?? (dateKey > days[days.length - 1].date ? days[days.length - 1] : days[0]);
}

/** The medium widget's extra line at a given time: countdown, streak in danger or "tap to play" */
export function widgetExtra(data: WidgetData, now: Date): 'next' | 'danger' | 'play' {
  const day = widgetDayFor(data, getLocalDateString(now));
  if (day.done) return 'next';
  return day.danger && now.getHours() >= data.dangerHour ? 'danger' : 'play';
}
