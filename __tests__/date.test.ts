import {
  addDays,
  computeDayRuns,
  daysBetween,
  formatDuration,
  getDaysLeftInWeek,
  getLocalDateString,
  getWeekKey,
  parseLocalDateString,
} from '../utils/date';

// Run under several time zones (npm run test:tz): date keys are local dates

describe('date keys', () => {
  it('formats a local date, whatever the time of day', () => {
    expect(getLocalDateString(new Date(2026, 9, 14, 0, 5))).toBe('2026-10-14');
    expect(getLocalDateString(new Date(2026, 9, 14, 23, 55))).toBe('2026-10-14');
  });

  it('parses a key back to the same local day (never UTC)', () => {
    const date = parseLocalDateString('2026-10-14');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(14);
    expect(getLocalDateString(date)).toBe('2026-10-14');
  });

  it('finds the right weekday (Monday is the hard daily)', () => {
    expect(parseLocalDateString('2026-10-12').getDay()).toBe(1);
    expect(parseLocalDateString('2026-10-11').getDay()).toBe(0);
  });

  it('round-trips every day of a year', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 366; i++) {
      expect(getLocalDateString(parseLocalDateString(key))).toBe(key);
      key = addDays(key, 1);
    }
    expect(key).toBe('2027-01-02');
  });
});

describe('addDays / daysBetween', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is not shifted by daylight saving changes', () => {
    // Europe: last Sunday of March / October. US: second Sunday of March, first of November
    for (const [from, to] of [['2026-03-28', '2026-03-30'], ['2026-10-24', '2026-10-26'], ['2026-03-07', '2026-03-09'], ['2026-10-31', '2026-11-02']]) {
      expect(daysBetween(from, to)).toBe(2);
      expect(addDays(from, 2)).toBe(to);
    }
  });

  it('is signed', () => {
    expect(daysBetween('2026-10-14', '2026-10-10')).toBe(-4);
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
  });
});

describe('computeDayRuns', () => {
  it('returns zero for no day', () => {
    expect(computeDayRuns([])).toEqual({ longest: 0, latest: 0, latestKey: null });
  });

  it('finds the longest run and the latest one, in any order and with duplicates', () => {
    const keys = ['2026-10-14', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-13', '2026-10-02'];
    expect(computeDayRuns(keys)).toEqual({ longest: 3, latest: 2, latestKey: '2026-10-14' });
  });

  it('follows runs across a month end', () => {
    expect(computeDayRuns(['2026-02-27', '2026-02-28', '2026-03-01']).latest).toBe(3);
  });
});

describe('getWeekKey', () => {
  it('follows ISO 8601 weeks, starting on Monday', () => {
    expect(getWeekKey(new Date(2026, 9, 12))).toBe('2026-W42'); // Monday
    expect(getWeekKey(new Date(2026, 9, 18, 23, 59))).toBe('2026-W42'); // Sunday night
    expect(getWeekKey(new Date(2026, 9, 19, 0, 1))).toBe('2026-W43'); // next Monday
  });

  it('handles weeks spanning two years', () => {
    expect(getWeekKey(new Date(2026, 0, 1))).toBe('2026-W01'); // Thursday
    expect(getWeekKey(new Date(2027, 0, 1))).toBe('2026-W53'); // Friday of 2026's week 53
    expect(getWeekKey(new Date(2024, 11, 30))).toBe('2025-W01'); // Monday
  });
});

describe('getDaysLeftInWeek', () => {
  it('counts today: 7 on Monday, 1 on Sunday', () => {
    expect(getDaysLeftInWeek(new Date(2026, 9, 12))).toBe(7);
    expect(getDaysLeftInWeek(new Date(2026, 9, 14))).toBe(5);
    expect(getDaysLeftInWeek(new Date(2026, 9, 18))).toBe(1);
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(102_000)).toBe('1:42');
    expect(formatDuration(3_600_000 + 5 * 60_000)).toBe('1h05');
  });
});
