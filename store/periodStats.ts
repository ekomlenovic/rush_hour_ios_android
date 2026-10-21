import type { Level, PeriodStats } from './types';
import type { WinKind } from './stats';
import { isBossLevel } from '../data/bosses';
import { addMonths, getLocalDateString } from '../utils/date';

/**
 * Counters of the recap, per month and per year (issue 125, see docs/GAME_DESIGN.md, Récap).
 * Months are kept for a rolling window, years for ever: each one is a small object of numbers.
 */

/** Months kept: the current one and the 12 before, for the year and the comparison with the month before */
export const RECAP_MONTHS_KEPT = 13;

export const emptyPeriodStats = (): PeriodStats => ({
  wins: 0,
  newLevels: 0,
  starsGained: 0,
  perfectWins: 0,
  playTimeMs: 0,
  moves: 0,
  bossWins: 0,
  hardestWinMoves: 0,
  nightWins: 0,
  earlyWins: 0,
  achievements: 0,
  resultsShared: 0,
  cosmetics: 0,
});

/** Fields that keep their highest value instead of adding up */
const MAX_FIELDS: ReadonlySet<keyof PeriodStats> = new Set(['hardestWinMoves']);

export const monthKeyOf = (date: Date): string => getLocalDateString(date).slice(0, 7);
export const yearKeyOf = (date: Date): string => String(date.getFullYear());

/** Oldest month kept at a given date */
export const oldestKeptMonth = (now: Date): string => addMonths(monthKeyOf(now), -(RECAP_MONTHS_KEPT - 1));

export interface PeriodState {
  monthlyStats: Record<string, PeriodStats>;
  yearlyStats: Record<string, PeriodStats>;
}

/** A period with the increments added (the maxima kept) */
export function addToPeriod(period: PeriodStats | undefined, increments: Partial<PeriodStats>): PeriodStats {
  const next = { ...emptyPeriodStats(), ...period };
  for (const [field, amount] of Object.entries(increments) as [keyof PeriodStats, number][]) {
    if (!amount) continue;
    next[field] = MAX_FIELDS.has(field) ? Math.max(next[field], amount) : next[field] + amount;
  }
  return next;
}

/** Only the months still in the window */
export function keptMonths(monthlyStats: Record<string, PeriodStats>, now: Date): Record<string, PeriodStats> {
  const oldest = oldestKeptMonth(now);
  return Object.fromEntries(Object.entries(monthlyStats).filter(([month]) => month >= oldest));
}

/**
 * Adds to the month and the year of `now`. The year is counted along with its months: it is complete
 * when it ends, before its months leave the window, and it is kept for ever
 */
export function addToPeriods(state: PeriodState, increments: Partial<PeriodStats>, now: Date = new Date()): PeriodState {
  const month = monthKeyOf(now);
  const year = yearKeyOf(now);
  return {
    monthlyStats: keptMonths({ ...state.monthlyStats, [month]: addToPeriod(state.monthlyStats[month], increments) }, now),
    yearlyStats: { ...state.yearlyStats, [year]: addToPeriod(state.yearlyStats[year], increments) },
  };
}

/** What a win adds to the recap */
export function winIncrements(level: Pick<Level, 'id' | 'minMoves'>, stars: number, kind: WinKind, now: Date = new Date()): Partial<PeriodStats> {
  const hour = now.getHours();
  return {
    wins: 1,
    perfectWins: stars === 3 ? 1 : 0,
    bossWins: kind === 'level' && isBossLevel(level.id) ? 1 : 0,
    hardestWinMoves: level.minMoves,
    nightWins: hour < 5 ? 1 : 0,
    earlyWins: kind === 'daily' && hour >= 5 && hour < 7 ? 1 : 0,
  };
}
