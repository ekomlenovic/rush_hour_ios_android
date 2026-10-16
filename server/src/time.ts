/**
 * Dates of the multiplayer challenge: a challenge comes out every day at the release
 * time of the server, in its time zone, and lasts until the next one. It is named
 * after the day it comes out ('YYYY-MM-DD', in the time zone of the server).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local date and time of an instant in a time zone */
function zonedParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Offset of a time zone from UTC at an instant, in ms */
function zoneOffset(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** The day after (or `days` days after) a date */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Number of days from `from` to `to` */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** Day of the week of a date, 0 = Sunday */
export function weekday(date: string): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The instant of a local date and time ('HH:MM') in a time zone */
export function zonedTimeToInstant(date: string, time: string, timeZone: string): number {
  const { year, month, day } = parseDate(date);
  const [hour, minute] = time.split(':').map(Number);
  const local = Date.UTC(year, month - 1, day, hour, minute);
  // The offset depends on the instant itself (summer time): refine once
  let instant = local - zoneOffset(local, timeZone);
  instant = local - zoneOffset(instant, timeZone);
  return instant;
}

/** Local date ('YYYY-MM-DD') of an instant in a time zone */
export function localDate(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return formatDate(p.year, p.month, p.day);
}

export interface ReleaseChange {
  /** First date released at that time */
  from: string;
  /** 'HH:MM'; null: back to RELEASE_TIME */
  releaseTime: string | null;
}

export interface Schedule {
  timeZone: string;
  /** 'HH:MM' */
  releaseTime: string;
  /** Changes made by the admin, oldest first: each one applies from its date on, the past never moves */
  changes?: ReleaseChange[];
}

/** Release time of the challenge of a date */
export function releaseTimeOn(date: string, schedule: Schedule): string {
  let time = schedule.releaseTime;
  for (const change of schedule.changes ?? []) if (change.from <= date) time = change.releaseTime ?? schedule.releaseTime;
  return time;
}

/** When the challenge of a date comes out */
export function releaseAt(date: string, schedule: Schedule): number {
  return zonedTimeToInstant(date, releaseTimeOn(date, schedule), schedule.timeZone);
}

/** When the challenge of a date closes: the release of the next one */
export function closesAt(date: string, schedule: Schedule): number {
  return releaseAt(addDays(date, 1), schedule);
}

/** The challenge being played at an instant: the last one released */
export function currentChallengeDate(now: number, schedule: Schedule): string {
  const today = localDate(now, schedule.timeZone);
  return now >= releaseAt(today, schedule) ? today : addDays(today, -1);
}

/** ISO week of a date ('2026-W42'), Monday to Sunday */
export function isoWeek(date: string): string {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // Thursday of the same week
  const weekYear = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(weekYear, 0, 1)) / DAY_MS + 1) / 7);
  return `${weekYear}-W${pad(week)}`;
}

/** First and last dates of the week or the month of a date */
export function periodBounds(period: 'day' | 'week' | 'month', date: string): { from: string; to: string } {
  if (period === 'day') return { from: date, to: date };
  if (period === 'week') {
    const monday = addDays(date, -((weekday(date) + 6) % 7));
    return { from: monday, to: addDays(monday, 6) };
  }
  const { year, month } = parseDate(date);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: formatDate(year, month, 1), to: formatDate(year, month, last) };
}
