export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a YYYY-MM-DD key as a local date (new Date('YYYY-MM-DD') would be UTC). */
export function parseLocalDateString(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Days since 1970 for a YYYY-MM-DD key; rounding absorbs daylight saving shifts. */
export function getDayNumber(dateKey: string): number {
  return Math.round(parseLocalDateString(dateKey).getTime() / 86400000);
}

/** Number of days from one YYYY-MM-DD key to another (positive if `to` is later). */
export function daysBetween(from: string, to: string): number {
  return getDayNumber(to) - getDayNumber(from);
}

/**
 * Runs of consecutive days in a set of YYYY-MM-DD keys:
 * the longest one, and the one ending on the most recent day.
 */
export function computeDayRuns(dateKeys: string[]): { longest: number; latest: number; latestKey: string | null } {
  const sorted = [...new Set(dateKeys)].sort((a, b) => getDayNumber(a) - getDayNumber(b));
  let longest = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { longest, latest: run, latestKey: sorted.length > 0 ? sorted[sorted.length - 1] : null };
}

/** ISO 8601 week key, e.g. '2026-W42'. Weeks start on Monday. */
export function getWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayOfWeek = date.getUTCDay() || 7;
  // The ISO year is the one containing the Thursday of this week
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** '1:42' under an hour, '3h05' above. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Days left in the current week, today included (Monday → 7, Sunday → 1). */
export function getDaysLeftInWeek(d: Date = new Date()): number {
  return 7 - ((d.getDay() + 6) % 7);
}
