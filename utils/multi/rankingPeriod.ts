import { addDays } from '../date';
import { resetRange } from './reset';
import type { RankingQuery } from './api';

/**
 * The period of the weekly rankings: a week or a month, stepped back one at a time from the
 * current one (offset 0, -1 the one before…), two dates chosen by the player, or all time
 * (duels). Dates are 'YYYY-MM-DD' days of the server (the day of a challenge, the day a
 * duel ended).
 */

export type RankingMode = 'week' | 'month' | 'dates' | 'all';
export const CHALLENGE_MODES: readonly RankingMode[] = ['week', 'month', 'dates'];
export const DUEL_MODES: readonly RankingMode[] = [...CHALLENGE_MODES, 'all'];

/** How far back the weeks and the months go */
export const MAX_WEEKS_BACK = 52;
export const MAX_MONTHS_BACK = 36;

/** The weeks or the months offered, the current one first: 0, -1, -2… */
export const stripOffsets = (mode: 'week' | 'month'): number[] =>
  Array.from({ length: (mode === 'week' ? MAX_WEEKS_BACK : MAX_MONTHS_BACK) + 1 }, (_, i) => (i === 0 ? 0 : -i));

export interface RankingView {
  mode: RankingMode;
  /** Weeks or months back from the current one: 0, -1, -2… */
  offset: number;
  dates: { from: string; to: string };
}

/** Two days in the right order */
export const orderedDates = (dates: { from: string; to: string }) =>
  dates.from <= dates.to ? dates : { from: dates.to, to: dates.from };

/** A day of the month `offset` months away from the one of `today` */
export function shiftMonth(today: string, offset: number): string {
  const [year, month] = today.split('-').map(Number);
  const index = year * 12 + (month - 1) + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

/** The day the period is asked around */
function anchor(view: RankingView, today: string): string {
  return view.mode === 'week' ? addDays(today, 7 * view.offset) : shiftMonth(today, view.offset);
}

/** What to ask the server; the current week and month are left to its own today */
export function rankingQuery(view: RankingView, today: string): RankingQuery {
  switch (view.mode) {
    case 'week':
    case 'month':
      return view.offset === 0 ? { period: view.mode } : { period: view.mode, date: anchor(view, today) };
    case 'dates': return { period: 'range', ...orderedDates(view.dates) };
    case 'all': return { period: 'all' };
  }
}

/** The days a view covers; null: all time */
export function rankingDays(view: RankingView, today: string): { from: string; to: string } | null {
  switch (view.mode) {
    case 'week':
    case 'month':
      return resetRange(view.mode, anchor(view, today), view.dates) as { from: string; to: string };
    case 'dates': return orderedDates(view.dates);
    case 'all': return null;
  }
}

/** A period over: its ranking is final (podium, my place) */
export function isPeriodOver(view: RankingView, today: string): boolean {
  const days = rankingDays(view, today);
  return !!days && days.to < today;
}
