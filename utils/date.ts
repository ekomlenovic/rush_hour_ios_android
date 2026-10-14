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
