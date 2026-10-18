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

/** YYYY-MM-DD key shifted by a number of days. */
export function addDays(dateKey: string, days: number): string {
  const date = parseLocalDateString(dateKey);
  return getLocalDateString(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
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

/** A total of time played: '0 min', '42 min', '3 h 05'. */
export function formatPlayTime(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')}`;
  return `${minutes} min`;
}

/** Time left before an event: whole hours from 2 h ('23 h'), then '1 h 05', then '12 min'. */
export function formatTimeLeft(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  if (hours >= 2) return `${hours} h`;
  if (hours === 1) return `1 h ${String(totalMinutes % 60).padStart(2, '0')}`;
  return `${totalMinutes} min`;
}

/** Days of a YYYY-MM month as YYYY-MM-DD keys, Monday-first weeks padded with null. */
export function getMonthGrid(month: string): (string | null)[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const offset = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Days left in the current week, today included (Monday → 7, Sunday → 1). */
export function getDaysLeftInWeek(d: Date = new Date()): number {
  return 7 - ((d.getDay() + 6) % 7);
}

/** Milliseconds until the next whole minute: the clock of the screens ticks on it. */
export function msUntilNextMinute(now: Date = new Date()): number {
  return 60_000 - (now.getTime() % 60_000);
}
