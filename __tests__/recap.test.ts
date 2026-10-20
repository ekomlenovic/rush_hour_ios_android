import type { TFunction } from 'i18next';
import { DAILY_LEVEL_ID, useGameStore, type ChallengeResult } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { addToPeriods, emptyPeriodStats, isBossLevel, RECAP_MONTHS_KEPT } from '../store/periodStats';
import {
  availableRecaps, buildRecap, buildRecapShareText, pendingRecap, periodBounds, pickProfile, recapHighlights, type RecapSource,
} from '../utils/recap';
import { planReminders } from '../utils/reminders';
import { addMonths, getWeekStart } from '../utils/date';
import { APP_URL } from '../utils/shareResult';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { resetStore, setToday, winMapLevel } from './helpers';

const store = () => useGameStore.getState();
const t = ((key: string, options?: Record<string, unknown>) => (options?.count !== undefined ? `${key}:${options.count}` : key)) as unknown as TFunction;
const win: ChallengeResult = { completed: true, score: 1200, stars: 3, moves: 12, minMoves: 12 };

/** A recap source with nothing played */
const source = (partial: Partial<RecapSource> = {}): RecapSource => ({
  monthlyStats: {},
  yearlyStats: {},
  achievementMonths: {},
  recapSince: null,
  dailyChallengeProgress: {},
  weeklyChallengeProgress: {},
  frozenDates: [],
  ...partial,
});

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  setToday('2026-10-20');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('recap counters in the store (issue 125)', () => {
  it('counts a map level won: win, new level, stars and the hardest level', () => {
    const level = sampleLevels[3];
    winMapLevel(level, { stars: 2 });
    expect(store().monthlyStats['2026-10']).toMatchObject({ wins: 1, newLevels: 1, starsGained: 2, perfectWins: 0, hardestWinMoves: level.minMoves });
    expect(store().yearlyStats['2026']).toEqual(store().monthlyStats['2026-10']);
  });

  it('counts only the stars added by a better result, and no new level when replayed', () => {
    winMapLevel(sampleLevels[0], { stars: 2 });
    winMapLevel(sampleLevels[0], { stars: 3 });
    winMapLevel(sampleLevels[0], { stars: 1 });
    expect(store().monthlyStats['2026-10']).toMatchObject({ wins: 3, newLevels: 1, starsGained: 3, perfectWins: 1 });
  });

  it('counts the moves, the play time and a boss', () => {
    const boss = sampleLevels[19];
    expect(isBossLevel(boss.id)).toBe(true);
    expect(isBossLevel(sampleLevels[18].id)).toBe(false);
    store().loadLevel(boss);
    const v = boss.vehicles.find(x => !x.isTarget)!;
    store().moveVehicle(v.id, v.row, v.col);
    store().addPlayTime(42_000);
    store().completeLevel(boss.id, boss.minMoves * 100, 3, 42_000);
    expect(store().monthlyStats['2026-10']).toMatchObject({ moves: 1, playTimeMs: 42_000, bossWins: 1 });
  });

  it('counts a daily won between 5 and 7 AM as early, a win after midnight as night', () => {
    setToday('2026-10-20', 6);
    store().loadLevel({ ...sampleLevels[0], id: DAILY_LEVEL_ID });
    store().completeDailyChallenge('2026-10-20', 300, 3);
    setToday('2026-10-21', 2);
    winMapLevel(sampleLevels[1]);
    expect(store().monthlyStats['2026-10']).toMatchObject({ wins: 2, earlyWins: 1, nightWins: 1 });
  });

  it('dates the achievements unlocked and counts them, and the results shared', () => {
    winMapLevel(sampleLevels[0]);
    expect(store().achievementMonths.first_win).toBe('2026-10');
    expect(store().monthlyStats['2026-10'].achievements).toBe(store().achievements.length);
    store().recordResultShared();
    expect(store().monthlyStats['2026-10'].resultsShared).toBe(1);
  });

  it('counts the styles of the garage unlocked', () => {
    // 50 stars unlock the paper board
    useGameStore.setState({ progress: sampleLevels.slice(1, 17).map(l => ({ levelId: l.id, completed: true, bestScore: 0, stars: 3 })) });
    winMapLevel(sampleLevels[0], { stars: 3 });
    expect(store().monthlyStats['2026-10'].cosmetics).toBeGreaterThanOrEqual(1);
  });

  it('keeps 13 months and every year', () => {
    let state = { monthlyStats: {}, yearlyStats: {} };
    for (let i = 0; i < 30; i++) {
      state = addToPeriods(state, { wins: 1, hardestWinMoves: i }, new Date(2024, i, 15));
    }
    expect(Object.keys(state.monthlyStats)).toHaveLength(RECAP_MONTHS_KEPT);
    expect(Object.keys(state.monthlyStats)[0]).toBe('2025-06');
    expect(state.yearlyStats).toMatchObject({ 2024: { wins: 12, hardestWinMoves: 11 }, 2025: { wins: 12 }, 2026: { wins: 6, hardestWinMoves: 29 } });
  });

  it('stays small: under 10 KB after 10 years of play', () => {
    let state = { monthlyStats: {}, yearlyStats: {} };
    const big = Object.fromEntries(Object.keys(emptyPeriodStats()).map(k => [k, 123_456_789]));
    for (let i = 0; i < 120; i++) state = addToPeriods(state, big, new Date(2026, i, 1));
    expect(JSON.stringify(state).length).toBeLessThan(10_000);
  });
});

describe('buildRecap', () => {
  it('reads the challenges, the frozen days and the achievements of the period', () => {
    const recap = buildRecap(source({
      monthlyStats: { '2026-09': { ...emptyPeriodStats(), wins: 7 } },
      dailyChallengeProgress: {
        '2026-08-31': win,
        '2026-09-01': win,
        '2026-09-02': { ...win, stars: 2 },
        '2026-09-04': win,
        '2026-09-05': { completed: false, score: 0, stars: 0 },
      },
      // Week 36 starts on Monday August 31st: it belongs to August
      weeklyChallengeProgress: { '2026-W36': win, '2026-W37': win },
      frozenDates: ['2026-09-03', '2026-10-01'],
      achievementMonths: { first_win: '2026-09', daily_winner: '2026-08' },
    }), '2026-09');
    expect(recap).toMatchObject({
      kind: 'month', start: '2026-09-01', end: '2026-09-30',
      dailies: 3, perfectDailies: 2, bestDailyRun: 2, freezesUsed: 1, weeklies: 1, achievementIds: ['first_win'], partialSince: null,
    });
    expect(recap.stats.wins).toBe(7);
    expect(getWeekStart('2026-W36')).toBe('2026-08-31');
  });

  it('a year adds up its months', () => {
    const recap = buildRecap(source({
      yearlyStats: { 2026: { ...emptyPeriodStats(), wins: 40 } },
      dailyChallengeProgress: { '2026-01-05': win, '2026-12-31': win, '2025-12-31': win },
      achievementMonths: { first_win: '2026-02', daily_winner: '2025-12' },
    }), '2026');
    expect(recap).toMatchObject({ kind: 'year', dailies: 2, achievementIds: ['first_win'] });
    expect(recap.stats.wins).toBe(40);
    expect(periodBounds('2026')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('says it is incomplete for the period of the update, and compares only with a period fully counted', () => {
    const counted = source({
      recapSince: '2026-10-20',
      monthlyStats: { '2026-10': { ...emptyPeriodStats(), wins: 5 }, '2026-11': { ...emptyPeriodStats(), wins: 9 }, '2026-12': { ...emptyPeriodStats(), wins: 4 } },
      dailyChallengeProgress: { '2026-10-02': win, '2026-11-02': win },
    });
    expect(buildRecap(counted, '2026-10').partialSince).toBe('2026-10-20');
    // October was only partly counted: the dailies compare, the wins do not
    expect(buildRecap(counted, '2026-11').previous).toEqual({ key: '2026-10', wins: null, dailies: 1 });
    expect(buildRecap(counted, '2026-11').partialSince).toBeNull();
    expect(buildRecap(counted, '2026-12').previous).toEqual({ key: '2026-11', wins: 9, dailies: 1 });
    expect(buildRecap(source(), '2026-12').previous).toBeNull();
  });

  it('picks a profile', () => {
    const stats = (partial: object) => ({ ...emptyPeriodStats(), ...partial });
    expect(pickProfile(stats({}), 28, 30)).toBe('loyal');
    expect(pickProfile(stats({ wins: 10, perfectWins: 7 }), 0, 30)).toBe('perfectionist');
    expect(pickProfile(stats({ wins: 10, earlyWins: 3 }), 3, 30)).toBe('early');
    expect(pickProfile(stats({ wins: 10, nightWins: 4 }), 0, 30)).toBe('night');
    expect(pickProfile(stats({ wins: 10, bossWins: 2 }), 0, 30)).toBe('boss');
    expect(pickProfile(stats({ wins: 30, newLevels: 25 }), 0, 30)).toBe('explorer');
    expect(pickProfile(stats({ wins: 3 }), 1, 30)).toBe('driver');
  });

  it('has a text for every profile, in both languages', () => {
    for (const profile of ['loyal', 'perfectionist', 'early', 'night', 'boss', 'explorer', 'driver']) {
      for (const strings of [en, fr]) {
        expect(strings.recap).toHaveProperty(`profile_${profile}`);
        expect(strings.recap).toHaveProperty(`profile_${profile}_desc`);
      }
    }
  });
});

describe('the home screen announces the recap', () => {
  const played = source({
    monthlyStats: { '2026-10': { ...emptyPeriodStats(), wins: 3 } },
    yearlyStats: { 2026: { ...emptyPeriodStats(), wins: 3 } },
  });

  it('from the 1st of the month, for 7 days, until opened', () => {
    const at = (day: string) => new Date(`${day}T12:00:00`);
    expect(pendingRecap({ ...played, recapsSeen: {} }, at('2026-10-31'))).toBeNull();
    expect(pendingRecap({ ...played, recapsSeen: {} }, at('2026-11-01'))).toBe('2026-10');
    expect(pendingRecap({ ...played, recapsSeen: {} }, at('2026-11-07'))).toBe('2026-10');
    expect(pendingRecap({ ...played, recapsSeen: {} }, at('2026-11-08'))).toBeNull();
    expect(pendingRecap({ ...played, recapsSeen: { month: '2026-10' } }, at('2026-11-02'))).toBeNull();
  });

  it('not for a month without anything played', () => {
    expect(pendingRecap({ ...source(), recapsSeen: {} }, new Date(2026, 10, 1))).toBeNull();
  });

  it('the year from December 26th to January 1st', () => {
    const year = { ...played, recapsSeen: { month: '2026-11' } };
    expect(pendingRecap(year, new Date(2026, 11, 25))).toBeNull();
    expect(pendingRecap(year, new Date(2026, 11, 26))).toBe('2026');
    expect(pendingRecap(year, new Date(2027, 0, 1))).toBe('2026');
    expect(pendingRecap({ ...year, recapsSeen: { year: '2026' } }, new Date(2026, 11, 28))).toBeNull();
    expect(pendingRecap(year, new Date(2027, 0, 2))).toBeNull();
  });

  it('a recap opened is no longer announced, an older one opened again changes nothing', () => {
    store().markRecapSeen('2026-10');
    store().markRecapSeen('2026-08');
    store().markRecapSeen('2026');
    expect(store().recapsSeen).toEqual({ month: '2026-10', year: '2026' });
  });

  it('the profile lists the last 12 months and every year played', () => {
    const keys = availableRecaps(source({
      monthlyStats: { '2026-10': { ...emptyPeriodStats(), wins: 1 }, '2026-03': { ...emptyPeriodStats(), moves: 4 } },
      yearlyStats: { 2026: { ...emptyPeriodStats(), wins: 1 }, 2024: { ...emptyPeriodStats(), wins: 9 } },
      dailyChallengeProgress: { '2025-12-24': win },
    }), new Date(2026, 9, 20));
    expect(keys).toEqual(['2026-10', '2026-03', '2025-12', '2026', '2025', '2024']);
  });
});

describe('sharing the recap', () => {
  const recap = buildRecap(source({
    monthlyStats: { '2026-10': { ...emptyPeriodStats(), wins: 12, starsGained: 20, playTimeMs: 3_600_000 } },
    dailyChallengeProgress: { '2026-10-01': win, '2026-10-02': win },
  }), '2026-10');

  it('keeps 3 or 4 strong numbers', () => {
    const highlights = recapHighlights(t, recap);
    expect(highlights.map(h => h.value)).toEqual(['12', '+20', '2', '1 h 00']);
  });

  it('a Wordle-like text with emojis and the link of the game', () => {
    const text = buildRecapShareText(t, recap, 'fr');
    expect(text).toContain('🏁 12');
    expect(text).toContain('🧩 2');
    expect(text.split('\n').pop()).toBe(APP_URL);
  });
});

describe('the recap reminder', () => {
  const input = { now: new Date(2026, 9, 20, 12), reminderHour: 19, completedDailies: new Set<string>(), completedWeeklies: new Set<string>(), currentStreak: 0 };

  it('on the 1st of the next month and on December 26th, when something was played', () => {
    const reminders = planReminders(t, { ...input, playedThisMonth: true, playedThisYear: true, language: 'fr' });
    const recap = reminders.filter(r => r.id.startsWith('recap-'));
    expect(recap.map(r => [r.id, r.date])).toEqual([
      ['recap-2026-10', new Date(2026, 10, 1, 11)],
      ['recap-2026', new Date(2026, 11, 26, 11)],
    ]);
  });

  it('nothing without anything played', () => {
    expect(planReminders(t, input).some(r => r.id.startsWith('recap-'))).toBe(false);
  });

  it('the month after December is January', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    const reminders = planReminders(t, { ...input, now: new Date(2026, 11, 28, 12), playedThisMonth: true, playedThisYear: true });
    expect(reminders.filter(r => r.id.startsWith('recap-')).map(r => r.id)).toEqual(['recap-2026-12']);
  });
});
