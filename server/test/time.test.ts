import { describe, expect, it } from 'vitest';
import {
  addDays, closesAt, currentChallengeDate, isoWeek, isValidDate, localDate, periodBounds, releaseAt, zonedTimeToInstant,
} from '../src/time';

const paris = { timeZone: 'Europe/Paris', releaseTime: '12:00' };

describe('time zones', () => {
  it('turns a local time into an instant, summer and winter time', () => {
    expect(new Date(zonedTimeToInstant('2026-07-01', '12:00', 'Europe/Paris')).toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(new Date(zonedTimeToInstant('2026-12-01', '12:00', 'Europe/Paris')).toISOString()).toBe('2026-12-01T11:00:00.000Z');
    expect(new Date(zonedTimeToInstant('2026-10-16', '12:00', 'Pacific/Auckland')).toISOString()).toBe('2026-10-15T23:00:00.000Z');
    expect(new Date(zonedTimeToInstant('2026-10-16', '00:00', 'America/New_York')).toISOString()).toBe('2026-10-16T04:00:00.000Z');
  });

  it('gives the local date of an instant', () => {
    const instant = Date.parse('2026-10-15T23:30:00Z');
    expect(localDate(instant, 'Europe/Paris')).toBe('2026-10-16');
    expect(localDate(instant, 'America/New_York')).toBe('2026-10-15');
  });
});

describe('challenge days', () => {
  it('a challenge comes out at the release time and lasts until the next one', () => {
    expect(new Date(releaseAt('2026-10-16', paris)).toISOString()).toBe('2026-10-16T10:00:00.000Z');
    expect(closesAt('2026-10-16', paris)).toBe(releaseAt('2026-10-17', paris));
  });

  it('the current challenge is the last one released', () => {
    expect(currentChallengeDate(Date.parse('2026-10-16T09:59:59Z'), paris)).toBe('2026-10-15');
    expect(currentChallengeDate(Date.parse('2026-10-16T10:00:00Z'), paris)).toBe('2026-10-16');
    expect(currentChallengeDate(Date.parse('2026-10-16T23:30:00Z'), paris)).toBe('2026-10-16');
  });

  it('a day with a change of time lasts 23 or 25 hours, the release time stays the same', () => {
    // Back to winter time on Sunday 2026-10-25 in Paris
    expect(closesAt('2026-10-24', paris) - releaseAt('2026-10-24', paris)).toBe(25 * 3_600_000);
    // Summer time on Sunday 2026-03-29
    expect(closesAt('2026-03-28', paris) - releaseAt('2026-03-28', paris)).toBe(23 * 3_600_000);
  });

  it('midnight release', () => {
    const midnight = { timeZone: 'Europe/Paris', releaseTime: '00:00' };
    expect(currentChallengeDate(Date.parse('2026-10-16T21:59:00Z'), midnight)).toBe('2026-10-16');
    expect(currentChallengeDate(Date.parse('2026-10-16T22:00:00Z'), midnight)).toBe('2026-10-17');
  });
});

describe('dates', () => {
  it('validates dates', () => {
    expect(isValidDate('2026-10-16')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-10-16T00:00')).toBe(false);
    expect(isValidDate('16/10/2026')).toBe(false);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('weeks are ISO weeks, Monday to Sunday', () => {
    expect(isoWeek('2026-10-16')).toBe('2026-W42');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(periodBounds('week', '2026-10-16')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(periodBounds('week', '2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(periodBounds('week', '2026-10-19')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('months are calendar months', () => {
    expect(periodBounds('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodBounds('day', '2026-02-10')).toEqual({ from: '2026-02-10', to: '2026-02-10' });
  });
});
