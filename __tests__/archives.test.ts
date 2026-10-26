import { generateDailyLevel } from '../utils/generator';
import {
  ARCHIVE_FIRST_DATE, ARCHIVE_MAX_DAYS, countCompleteArchiveMonths, getArchiveDayStatus, getCalendarMonths,
  getOldestArchiveDate, isArchiveDateAvailable,
} from '../utils/archives';
import { resolveLevel } from '../utils/levelResolver';
import { addDays } from '../utils/date';
import { archiveWinXp } from '../data/progression';
import { buildAchievementContext } from '../data/achievements';
import { ARCHIVE_LEVEL_ID, DAILY_LEVEL_ID, Level, useGameStore } from '../store/gameStore';
import { resetStore, setToday, winDaily } from './helpers';

const state = () => useGameStore.getState();

/** Compact form of a level: one 'id:row,col,length+orientation(*target)' string per vehicle */
const compact = (l: Level) => ({
  gridSize: l.gridSize,
  exitRow: l.exitRow,
  exitCol: l.exitCol,
  minMoves: l.minMoves,
  vehicles: l.vehicles.map(v => `${v.id}:${v.row},${v.col},${v.length}${v.orientation[0]}${v.isTarget ? '*' : ''}`),
});

describe('daily generator (frozen for the archives)', () => {
  // Archives regenerate past dailies from their date: if this test fails, the daily generator
  // changed and ARCHIVE_FIRST_DATE (utils/archives.ts) must move to the first day of the new one
  it.each([
    ['2026-10-14', {
      gridSize: 6, exitRow: 1, exitCol: 255, minMoves: 12,
      vehicles: ['target:1,4,2h*', 'blocker_0:0,3,2v', 'v2:0,1,2h', 'v3:3,2,3v', 'v4:3,3,2h', 'v5:4,3,2h',
        'v6:3,0,2h', 'v7:2,0,2h', 'v8:5,0,2h', 'v9:0,0,2v', 'v10:0,4,2h'],
    }],
    ['2026-10-15', {
      gridSize: 6, exitRow: 2, exitCol: 255, minMoves: 13,
      vehicles: ['target:2,4,2h*', 'blocker_1:1,2,2v', 'blocker_3:2,3,2v', 'v3:4,1,2v', 'v4:3,4,2h', 'v5:0,4,2v',
        'v6:3,2,2v', 'v7:0,2,2h', 'v8:5,4,2h', 'v9:4,0,2v', 'v10:2,0,2v'],
    }],
  ])('gives the same puzzle for %s', async (dateKey, expected) => {
    expect(compact((await generateDailyLevel(dateKey))!)).toEqual(expected);
  });
});

describe('archive dates', () => {
  const today = '2026-12-20';

  it('are past days only: never today nor the future', () => {
    expect(isArchiveDateAvailable(addDays(today, -1), today)).toBe(true);
    expect(isArchiveDateAvailable(today, today)).toBe(false);
    expect(isArchiveDateAvailable(addDays(today, 1), today)).toBe(false);
    expect(isArchiveDateAvailable('2027-01-01', today)).toBe(false);
  });

  it('include yesterday across a daylight saving change (Auckland, #153)', () => {
    expect(isArchiveDateAvailable('2027-09-26', '2027-09-27')).toBe(true);
    expect(isArchiveDateAvailable('2027-04-04', '2027-04-05')).toBe(true);
  });

  it('start with the current daily generator', () => {
    expect(isArchiveDateAvailable(ARCHIVE_FIRST_DATE, today)).toBe(true);
    expect(isArchiveDateAvailable(addDays(ARCHIVE_FIRST_DATE, -1), today)).toBe(false);
  });

  it(`go back ${ARCHIVE_MAX_DAYS} days at most`, () => {
    const later = '2027-06-01';
    expect(isArchiveDateAvailable(addDays(later, -ARCHIVE_MAX_DAYS), later)).toBe(true);
    expect(isArchiveDateAvailable(addDays(later, -ARCHIVE_MAX_DAYS - 1), later)).toBe(false);
    expect(getOldestArchiveDate(later)).toBe(addDays(later, -ARCHIVE_MAX_DAYS));
  });

  it('reject malformed dates', () => {
    for (const key of ['', 'yesterday', '2026-11-31', '2026-1-05', '2026-11-05T00:00']) {
      expect(isArchiveDateAvailable(key, today)).toBe(false);
    }
  });

  it('give the months of the calendar, oldest first', () => {
    expect(getCalendarMonths(ARCHIVE_FIRST_DATE)).toEqual(['2026-10']);
    expect(getCalendarMonths('2026-11-02')).toEqual(['2026-10', '2026-11']);
    expect(getCalendarMonths('2027-01-31')).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('archive day status', () => {
  const won = { completed: true, score: 300, stars: 3 };

  it('tells a day won on the day itself from one won as an archive', () => {
    expect(getArchiveDayStatus('2026-10-20', { '2026-10-20': won }, { '2026-10-20': won })).toBe('daily');
    expect(getArchiveDayStatus('2026-10-20', {}, { '2026-10-20': won })).toBe('archive');
    expect(getArchiveDayStatus('2026-10-20', {}, {})).toBe('none');
  });

  it('counts a month complete when every day is won, with at least one archive', () => {
    const november: Record<string, typeof won> = {};
    for (let d = 1; d <= 30; d++) november[`2026-11-${String(d).padStart(2, '0')}`] = won;
    const { '2026-11-07': missed, ...dailies } = november;
    expect(countCompleteArchiveMonths(dailies, {}, '2026-12-05')).toBe(0);
    expect(countCompleteArchiveMonths(dailies, { '2026-11-07': missed }, '2026-12-05')).toBe(1);
    // A month of dailies alone is not an archive month
    expect(countCompleteArchiveMonths(november, {}, '2026-12-05')).toBe(0);
    // The current month is never complete
    expect(countCompleteArchiveMonths(dailies, { '2026-11-07': missed }, '2026-11-30')).toBe(0);
  });
});

describe('archives in the store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Wins the archive of a day, playing on another day */
  const winArchive = (dateKey: string, stars = 3) =>
    state().completeArchiveChallenge(dateKey, stars * 100, stars, 30_000, { moves: 12, minMoves: 12 });

  it('never touch the streak, the freezes, the dailies nor the missions', () => {
    winDaily('2026-10-20');
    winDaily('2026-10-21');
    setToday('2026-10-23'); // the 22nd was missed
    state().recordAppOpen();
    const before = {
      currentStreak: state().currentStreak,
      bestStreak: state().bestStreak,
      lastStreakDate: state().lastStreakDate,
      streakFreezes: state().streakFreezes,
      frozenDates: state().frozenDates,
      dailyChallengeProgress: state().dailyChallengeProgress,
      missionCounters: state().dailyMissions?.counters,
    };

    winArchive('2026-10-22');

    expect(state().archiveProgress['2026-10-22']).toMatchObject({ completed: true, stars: 3, moves: 12, minMoves: 12 });
    expect({
      currentStreak: state().currentStreak,
      bestStreak: state().bestStreak,
      lastStreakDate: state().lastStreakDate,
      streakFreezes: state().streakFreezes,
      frozenDates: state().frozenDates,
      dailyChallengeProgress: state().dailyChallengeProgress,
      missionCounters: state().dailyMissions?.counters,
    }).toEqual(before);
  });

  it('never change the result of the day itself', () => {
    winDaily('2026-10-20', 1);
    const result = state().dailyChallengeProgress['2026-10-20'];
    setToday('2026-10-25');
    winArchive('2026-10-20', 3);
    expect(state().dailyChallengeProgress['2026-10-20']).toEqual(result);
  });

  it('cannot be won for today nor a future day, in any time zone', () => {
    setToday('2026-10-25', 0);
    winArchive('2026-10-25');
    winArchive('2026-10-26');
    setToday('2026-10-25', 23);
    winArchive('2026-10-25');
    expect(state().archiveProgress).toEqual({});
    expect(state().xp).toBe(0);
  });

  it('give the reduced XP of a replayed level, once per day', () => {
    setToday('2026-10-25');
    winArchive('2026-10-20');
    expect(state().xp).toBe(archiveWinXp(12, 3));
    expect(archiveWinXp(12, 3)).toBeLessThan(60);
    winArchive('2026-10-20');
    expect(state().xp).toBe(archiveWinXp(12, 3));
  });

  it('do not count for the daily achievements, only for their own', () => {
    setToday('2026-12-20');
    // Mondays included: monday_survivor stays locked
    for (let i = 1; i <= 10; i++) winArchive(addDays('2026-12-19', -i));
    const context = buildAchievementContext(state());
    expect(context.dailies).toBe(0);
    expect(context.mondayDailies).toBe(0);
    expect(state().achievements.filter(id => id.startsWith('daily_') || id === 'monday_survivor')).toEqual([]);
    expect(state().achievements).toContain('archives_10');
  });

  it('unlock the full month with the missed days made up', () => {
    for (let d = 1; d <= 30; d++) {
      if (d !== 7) winDaily(`2026-11-${String(d).padStart(2, '0')}`);
    }
    setToday('2026-12-05');
    expect(state().achievements).not.toContain('archives_month');
    winArchive('2026-11-07');
    expect(state().achievements).toContain('archives_month');
  });

  it('save their progress under their own key, apart from the daily', async () => {
    setToday('2026-10-25');
    const pending = resolveLevel({ levelId: 'archive', date: '2026-10-20' });
    await jest.runAllTimersAsync();
    const level = (await pending)!;
    expect(level.id).toBe(ARCHIVE_LEVEL_ID);

    state().loadLevel(level);
    const v = level.vehicles.find(x => !x.isTarget)!;
    state().moveVehicle(v.id, v.row, v.col);
    expect(Object.keys(state().savedStates)).toEqual(['archive-2026-10-20']);
    expect(state().maxUnlockedLevel).toBe(1);

    winArchive('2026-10-20');
    expect(state().savedStates).toEqual({});
  });
});

describe('opening an archive', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const open = async (date: string) => {
    const pending = resolveLevel({ levelId: 'archive', date });
    await jest.runAllTimersAsync();
    return pending;
  };

  it('is impossible for today or a future day', async () => {
    setToday('2026-10-25', 0);
    expect(await open('2026-10-25')).toBeNull();
    expect(await open('2026-10-26')).toBeNull();
    setToday('2026-10-25', 23);
    expect(await open('2026-10-25')).toBeNull();
  });

  it('gives the daily of that day, and keeps it once generated', async () => {
    setToday('2026-10-25');
    const level = (await open('2026-10-20'))!;
    const daily = (await (async () => {
      const pending = generateDailyLevel('2026-10-20');
      await jest.runAllTimersAsync();
      return pending;
    })())!;
    expect(level.vehicles).toEqual(daily.vehicles);
    expect(state().archiveLevels['2026-10-20']).toEqual(level);
    expect(state().archiveDate).toBe('2026-10-20');
  });

  it("replays yesterday's daily as it was cached", async () => {
    setToday('2026-10-25');
    const cached: Level = { id: DAILY_LEVEL_ID, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 1, updatedAt: 0,
      vehicles: [{ id: 'target', row: 2, col: 3, length: 2, orientation: 'horizontal', isTarget: true, color: '#f00' }] };
    useGameStore.setState({ currentDailyLevel: cached, dailyLevelDate: '2026-10-24' });
    const level = (await open('2026-10-24'))!;
    expect(level).toEqual({ ...cached, id: ARCHIVE_LEVEL_ID });
  });

  it("resumes yesterday's daily closed after midnight without a win, with the moves played after midnight", async () => {
    setToday('2026-10-20', 23);
    const pending = resolveLevel({ levelId: 'daily', date: '2026-10-20' });
    await jest.runAllTimersAsync();
    const daily = (await pending)!;
    state().loadLevel(daily);
    state().setOpenDailyDate('2026-10-20');
    /** Slides the first vehicle that can move one cell forward */
    const playMove = () => expect(state().vehicles.some(v => v.orientation === 'horizontal'
      ? state().moveVehicle(v.id, v.row, v.col + 1)
      : state().moveVehicle(v.id, v.row + 1, v.col))).toBe(true);
    playMove();
    // Still open at midnight, played on, then closed: the home records the app open each time
    setToday('2026-10-21', 0);
    state().recordAppOpen();
    playMove();
    state().setOpenDailyDate(null);
    state().recordAppOpen();

    const level = (await open('2026-10-20'))!;
    expect(level.vehicles).toEqual(daily.vehicles);
    state().loadLevel(level);
    expect(state().moveCount).toBe(2);

    state().completeArchiveChallenge('2026-10-20', 1200, 3, 30_000, { moves: 12, minMoves: 12 });
    expect(getArchiveDayStatus('2026-10-20', state().dailyChallengeProgress, state().archiveProgress)).toBe('archive');
    expect(state().savedStates).toEqual({});
  });

  it('drops the cached archives too old to be replayed', async () => {
    setToday('2026-10-25');
    const old = { id: ARCHIVE_LEVEL_ID } as Level;
    useGameStore.setState({ archiveLevels: { '2026-01-01': old } });
    await open('2026-10-20');
    expect(Object.keys(state().archiveLevels)).toEqual(['2026-10-20']);
  });
});
