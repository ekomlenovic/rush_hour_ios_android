import { addDays, daysBetween, getLocalDateString, getWeekKey, parseLocalDateString } from './date';
import { isValidDateKey } from './archives';

/**
 * Dates of the daily and weekly challenges a player can play or have won (issue 119).
 * The daily opens on its own day only: a past day is an archive, a day to come is not out yet.
 */

const WEEK_KEY = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

/**
 * A save made on a phone ahead in time (another time zone, a trip) can hold the date of
 * tomorrow: tolerated by the import and the migrations, never by the game itself
 */
export const TIME_ZONE_TOLERANCE_DAYS = 1;

/** The daily of a date can be opened: today's only */
export const isDailyOpen = (dateKey: string, now: Date = new Date()): boolean => dateKey === getLocalDateString(now);

/** The weekly of a week can be opened: this week's only */
export const isWeeklyOpen = (weekKey: string, now: Date = new Date()): boolean => weekKey === getWeekKey(now);

/** A daily win of a real day that has come (a game left open past midnight wins the day before) */
export function isDailyWinnable(dateKey: string, now: Date = new Date()): boolean {
  return isValidDateKey(dateKey) && daysBetween(dateKey, getLocalDateString(now)) >= 0;
}

/** A weekly win of a real week that has come */
export function isWeeklyWinnable(weekKey: string, now: Date = new Date()): boolean {
  return WEEK_KEY.test(weekKey) && weekKey <= getWeekKey(now);
}

/** Latest day a saved result can have: tomorrow, for a save made ahead in time */
export const latestSavedDate = (now: Date = new Date()): string => addDays(getLocalDateString(now), TIME_ZONE_TOLERANCE_DAYS);

/** Latest week a saved result can have: the week of tomorrow */
export const latestSavedWeek = (now: Date = new Date()): string => getWeekKey(parseLocalDateString(latestSavedDate(now)));

/** Today's daily, for a link without a date (the widget): the date is the one of the opening */
export const todayDailyHref = (now: Date = new Date()): string => `/game?levelId=daily&date=${getLocalDateString(now)}`;
