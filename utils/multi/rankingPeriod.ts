import { addDays } from '../date';
import { resetRange } from './reset';
import type { RankingQuery } from './api';

/**
 * The periods of the weekly rankings: this week or the last one, this month or the
 * last one, two dates chosen by the player, all time (duels). Dates are 'YYYY-MM-DD'
 * days of the server (the day of a challenge, the day a duel ended).
 */

export type RankingChoice = 'week' | 'last_week' | 'month' | 'last_month' | 'dates' | 'all';
export const CHALLENGE_CHOICES: readonly RankingChoice[] = ['week', 'last_week', 'month', 'last_month', 'dates'];
export const DUEL_CHOICES: readonly RankingChoice[] = [...CHALLENGE_CHOICES, 'all'];

/** Two days in the right order */
export const orderedDates = (dates: { from: string; to: string }) =>
  dates.from <= dates.to ? dates : { from: dates.to, to: dates.from };

/** A day of the last month */
const lastMonth = (today: string) => addDays(`${today.slice(0, 7)}-01`, -1);

/** What to ask the server; the current week and month are left to its own today */
export function rankingQuery(choice: RankingChoice, today: string, dates: { from: string; to: string }): RankingQuery {
  switch (choice) {
    case 'week': return { period: 'week' };
    case 'last_week': return { period: 'week', date: addDays(today, -7) };
    case 'month': return { period: 'month' };
    case 'last_month': return { period: 'month', date: lastMonth(today) };
    case 'dates': return { period: 'range', ...orderedDates(dates) };
    case 'all': return { period: 'all' };
  }
}

/** The days a choice covers, to show them; null: all time */
export function rankingDays(choice: RankingChoice, today: string, dates: { from: string; to: string }): { from: string; to: string } | null {
  switch (choice) {
    case 'week': return resetRange('week', today, dates) as { from: string; to: string };
    case 'last_week': return resetRange('week', addDays(today, -7), dates) as { from: string; to: string };
    case 'month': return resetRange('month', today, dates) as { from: string; to: string };
    case 'last_month': return resetRange('month', lastMonth(today), dates) as { from: string; to: string };
    case 'dates': return orderedDates(dates);
    case 'all': return null;
  }
}
