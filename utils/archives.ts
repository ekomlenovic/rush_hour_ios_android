import type { ChallengeResult } from '../store/types';
import { addDays, daysBetween, getLocalDateString, parseLocalDateString } from './date';

/**
 * Archives of the daily challenge: past dailies replayed as training (see docs/GAME_DESIGN.md).
 *
 * The puzzle of a day is regenerated from its date: an archive is only offered for dates
 * where the current generator gives the puzzle that was really played that day. The daily
 * generator was last changed on 2026-10-14 (Monday detection west of UTC, #20): before that,
 * some players got another puzzle on Mondays and Tuesdays. Changing the daily generator must
 * move this date forward (the generator is frozen by a test in __tests__/archives.test.ts).
 */
export const ARCHIVE_FIRST_DATE = '2026-10-14';
/** Archives go back this many days at most */
export const ARCHIVE_MAX_DAYS = 90;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date as a YYYY-MM-DD key (rejects '2026-02-30') */
export function isValidDateKey(dateKey: string): boolean {
  return DATE_KEY.test(dateKey) && getLocalDateString(parseLocalDateString(dateKey)) === dateKey;
}

/** Oldest day that can be replayed today */
export function getOldestArchiveDate(today: string = getLocalDateString()): string {
  const limit = addDays(today, -ARCHIVE_MAX_DAYS);
  return daysBetween(ARCHIVE_FIRST_DATE, limit) > 0 ? limit : ARCHIVE_FIRST_DATE;
}

/** Only past days can be replayed: never today (the real daily) nor the future */
export function isArchiveDateAvailable(dateKey: string, today: string = getLocalDateString()): boolean {
  if (!isValidDateKey(dateKey)) return false;
  return daysBetween(dateKey, today) >= 1 && daysBetween(getOldestArchiveDate(today), dateKey) >= 0;
}

/** Days that can be replayed, most recent first */
export function getArchiveDates(today: string = getLocalDateString()): string[] {
  const dates: string[] = [];
  const oldest = getOldestArchiveDate(today);
  for (let date = addDays(today, -1); daysBetween(oldest, date) >= 0; date = addDays(date, -1)) {
    dates.push(date);
  }
  return dates;
}

/** 'daily': won on the day itself, 'archive': won later as an archive, 'none': never won */
export type ArchiveDayStatus = 'daily' | 'archive' | 'none';

export function getArchiveDayStatus(
  dateKey: string,
  dailyProgress: Record<string, ChallengeResult>,
  archiveProgress: Record<string, ChallengeResult>,
): ArchiveDayStatus {
  if (dailyProgress[dateKey]?.completed) return 'daily';
  if (archiveProgress[dateKey]?.completed) return 'archive';
  return 'none';
}

/** Distinct past days won from the archives */
export function countArchiveWins(archiveProgress: Record<string, ChallengeResult>): number {
  return Object.values(archiveProgress).filter(r => r?.completed).length;
}

/**
 * Calendar months with every day won, on the day itself or as an archive.
 * Only months over: the current month can't be complete yet.
 */
export function countCompleteArchiveMonths(
  dailyProgress: Record<string, ChallengeResult>,
  archiveProgress: Record<string, ChallengeResult>,
  today: string = getLocalDateString(),
): number {
  // Only months with at least one archive: a month of dailies alone is not an archive month
  const months = new Set(
    Object.entries(archiveProgress).filter(([, r]) => r?.completed).map(([k]) => k.slice(0, 7)),
  );
  const currentMonth = today.slice(0, 7);
  let complete = 0;
  for (const month of months) {
    if (month >= currentMonth) continue;
    const [year, monthIndex] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthIndex, 0).getDate();
    let allDone = true;
    for (let day = 1; day <= daysInMonth && allDone; day++) {
      const key = `${month}-${String(day).padStart(2, '0')}`;
      allDone = getArchiveDayStatus(key, dailyProgress, archiveProgress) !== 'none';
    }
    if (allDone) complete++;
  }
  return complete;
}

export interface ArchiveMonth {
  /** YYYY-MM */
  month: string;
  /** Days of the month that can be replayed, most recent first */
  dates: string[];
}

/** Archive dates grouped by month, most recent month first */
export function groupArchiveDatesByMonth(dates: string[]): ArchiveMonth[] {
  const months: ArchiveMonth[] = [];
  for (const date of dates) {
    const month = date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.dates.push(date);
    else months.push({ month, dates: [date] });
  }
  return months;
}
