import { addDays, daysBetween, parseLocalDateString } from '@/utils/date';
import type { PeriodRow } from './api';

/** The recap of the last week is shown on the first days of the new one (Monday to Wednesday) */
export const RECAP_DAYS = 3;

/** Monday of the week of a date ('YYYY-MM-DD') */
export function mondayOf(date: string): string {
  return addDays(date, -((parseLocalDateString(date).getDay() + 6) % 7));
}

/** Show the recap of the last week: in the first days of the week of the challenge being played */
export function showsWeekRecap(currentDate: string): boolean {
  return daysBetween(mondayOf(currentDate), currentDate) < RECAP_DAYS;
}

/** A day of the week of a player: points scored, the game in progress, not played, or still to come */
export type DayCell =
  | { date: string; kind: 'points'; points: number }
  | { date: string; kind: 'playing' | 'missed' | 'upcoming' };

/**
 * The seven days of a player's week, Monday to Sunday. The days after the challenge being
 * played are still to come; so is the one being played while the player has not started it.
 */
export function weekCells(monday: string, days: NonNullable<PeriodRow['days']>, currentDate: string): DayCell[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const day = days.find(d => d.date === date);
    if (day) return day.status === 'playing' ? { date, kind: 'playing' } : { date, kind: 'points', points: day.points };
    return { date, kind: date < currentDate ? 'missed' : 'upcoming' };
  });
}
