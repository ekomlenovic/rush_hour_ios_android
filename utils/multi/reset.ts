import { addDays, parseLocalDateString } from '../date';

/**
 * Back to zero, from the admin panel: the days a reset covers. Dates are 'YYYY-MM-DD'
 * days of the server (the day of a challenge, the day a duel ended); null bounds: all.
 */

export type ResetPreset = 'today' | 'week' | 'month' | 'dates' | 'all';
export const RESET_PRESETS: readonly ResetPreset[] = ['today', 'week', 'month', 'dates', 'all'];

/** The days of a preset around today; `dates`: the days chosen */
export function resetRange(preset: ResetPreset, today: string, dates: { from: string; to: string }): { from: string | null; to: string | null } {
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'week': {
      // ISO week: Monday to Sunday
      const monday = addDays(today, -((parseLocalDateString(today).getDay() + 6) % 7));
      return { from: monday, to: addDays(monday, 6) };
    }
    case 'month': {
      const first = `${today.slice(0, 7)}-01`;
      const date = parseLocalDateString(first);
      const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return { from: first, to: addDays(first, days - 1) };
    }
    case 'dates': return dates.from <= dates.to ? dates : { from: dates.to, to: dates.from };
    case 'all': return { from: null, to: null };
  }
}
