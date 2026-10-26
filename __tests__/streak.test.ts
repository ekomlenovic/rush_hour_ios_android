import { useGameStore, MAX_STREAK_FREEZES } from '../store/gameStore';
import { addDays } from '../utils/date';
import { resetStore, setToday, winDaily } from './helpers';

// Level-up rewards also give freezes: tested in progression.test.ts, kept out of the streak rules here
jest.mock('../data/progression', () => ({ ...jest.requireActual('../data/progression'), getPlayerLevel: () => 1 }));

const state = () => useGameStore.getState();

/** Wins the daily on `count` consecutive days from `start` */
function winDays(start: string, count: number) {
  for (let i = 0; i < count; i++) winDaily(addDays(start, i));
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('streak (rules in docs/GAME_DESIGN.md)', () => {
  it('grows on consecutive days, in every time zone (#20)', () => {
    winDays('2026-10-12', 3);
    expect(state().currentStreak).toBe(3);
    expect(state().bestStreak).toBe(3);
    expect(state().lastStreakDate).toBe('2026-10-14');
  });

  it('counts a day only once', () => {
    winDaily('2026-10-14');
    state().completeDailyChallenge('2026-10-14', 300, 3);
    expect(state().currentStreak).toBe(1);
  });

  it('continues across a month and a year end', () => {
    winDays('2026-12-30', 4);
    expect(state().currentStreak).toBe(4);
  });

  it('restarts at 1 after a missed day without freeze, the best streak is kept', () => {
    winDays('2026-10-01', 3);
    winDaily('2026-10-05');
    expect(state().currentStreak).toBe(1);
    expect(state().bestStreak).toBe(3);
  });

  it('is shown as lost on the app open after a missed day', () => {
    winDays('2026-10-01', 3);
    setToday('2026-10-05');
    const info = state().recordAppOpen();
    expect(info.lostStreak).toBe(3);
    expect(info.frozenDays).toBe(0);
    expect(state().currentStreak).toBe(0);
  });

  it('is kept when the app is opened the next day, before playing', () => {
    winDaily('2026-10-14');
    setToday('2026-10-15');
    const info = state().recordAppOpen();
    expect(info.lostStreak).toBe(0);
    expect(state().currentStreak).toBe(1);
  });
});

describe('streak freezes', () => {
  it('a freeze covers a missed day and the streak continues', () => {
    winDays('2026-10-01', 3);
    useGameStore.setState({ streakFreezes: 1 });

    setToday('2026-10-05');
    const info = state().recordAppOpen();
    expect(info).toMatchObject({ frozenDays: 1, lostStreak: 0 });
    expect(state().streakFreezes).toBe(0);
    expect(state().frozenDates).toEqual(['2026-10-04']);
    expect(state().stats.freezesUsed).toBe(1);

    state().completeDailyChallenge('2026-10-05', 300, 3);
    // The frozen day does not count in the total
    expect(state().currentStreak).toBe(4);
  });

  it('two freezes cover two missed days', () => {
    winDays('2026-10-01', 3);
    useGameStore.setState({ streakFreezes: 2 });
    winDaily('2026-10-06');
    expect(state().currentStreak).toBe(4);
    expect(state().frozenDates).toEqual(['2026-10-04', '2026-10-05']);
    expect(state().streakFreezes).toBe(0);
  });

  it('are used even when the daily is opened directly (no app open settled)', () => {
    winDays('2026-10-01', 3);
    useGameStore.setState({ streakFreezes: 1 });
    setToday('2026-10-05');
    state().completeDailyChallenge('2026-10-05', 300, 3);
    expect(state().currentStreak).toBe(4);
    expect(state().streakFreezes).toBe(0);
  });

  it('with more missed days than freezes, the streak is lost and the freezes are kept', () => {
    winDays('2026-10-01', 3);
    useGameStore.setState({ streakFreezes: 2 });
    setToday('2026-10-07');
    const info = state().recordAppOpen();
    expect(info).toMatchObject({ frozenDays: 0, lostStreak: 3 });
    expect(state().currentStreak).toBe(0);
    expect(state().streakFreezes).toBe(2);
    expect(state().frozenDates).toEqual([]);
  });

  it('are not used when there is no streak to protect', () => {
    useGameStore.setState({ streakFreezes: 2 });
    setToday('2026-10-14');
    state().recordAppOpen();
    expect(state().streakFreezes).toBe(2);
  });

  it('one is earned every 7 days of streak', () => {
    winDays('2026-10-01', 6);
    expect(state().streakFreezes).toBe(0);
    winDaily('2026-10-07');
    expect(state().streakFreezes).toBe(1);
    expect(state().stats.freezesEarned).toBe(1);
    winDays('2026-10-08', 7);
    expect(state().streakFreezes).toBe(2);
  });

  it(`the stock is capped at ${MAX_STREAK_FREEZES}`, () => {
    winDays('2026-10-01', 21);
    expect(state().currentStreak).toBe(21);
    expect(state().streakFreezes).toBe(MAX_STREAK_FREEZES);
    expect(state().stats.freezesEarned).toBe(MAX_STREAK_FREEZES);
    expect(state().addStreakFreeze()).toBe(false);
  });
});

describe('a daily left open past midnight', () => {
  /** Streak of 5 up to 10-19, then the daily of 10-20 opened on the game screen, still there at midnight */
  function openPastMidnight(freezes: number) {
    winDays('2026-10-15', 5);
    useGameStore.setState({ streakFreezes: freezes });
    setToday('2026-10-20', 23);
    state().recordAppOpen();
    state().setOpenDailyDate('2026-10-20');
    // The home screen under the game records the new day
    setToday('2026-10-21', 0);
    return state().recordAppOpen();
  }

  it('can still be won: its day is not missed, the streak continues', () => {
    expect(openPastMidnight(0)).toMatchObject({ frozenDays: 0, lostStreak: 0 });
    expect(state().currentStreak).toBe(5);

    state().completeDailyChallenge('2026-10-20', 300, 3);
    expect(state().currentStreak).toBe(6);
    expect(state().lastStreakDate).toBe('2026-10-20');
  });

  it('uses no freeze for its day', () => {
    expect(openPastMidnight(1)).toMatchObject({ frozenDays: 0, lostStreak: 0 });
    state().completeDailyChallenge('2026-10-20', 300, 3);
    expect(state().currentStreak).toBe(6);
    expect(state().streakFreezes).toBe(1);
    expect(state().frozenDates).toEqual([]);
  });

  it('closed without a win, its day is missed (the home records the app open again)', () => {
    openPastMidnight(0);
    state().setOpenDailyDate(null);
    expect(state().recordAppOpen()).toMatchObject({ lostStreak: 5 });
    expect(state().currentStreak).toBe(0);
  });

  it("won past midnight, today's daily then continues the streak", () => {
    openPastMidnight(0);
    state().completeDailyChallenge('2026-10-20', 300, 3);
    // Won, the game screen lets it go: the home records the app open again, nothing to tell
    state().setOpenDailyDate(null);
    expect(state().recordAppOpen()).toMatchObject({ frozenDays: 0, lostStreak: 0 });

    state().completeDailyChallenge('2026-10-21', 300, 3);
    expect(state().currentStreak).toBe(7);
    expect(state().bestStreak).toBe(7);
    expect(state().lastStreakDate).toBe('2026-10-21');
    expect(state().frozenDates).toEqual([]);
    // 7 days in a row: a freeze earned
    expect(state().streakFreezes).toBe(1);
  });

  describe('still open at the next midnight', () => {
    /** Same, and the home records 10-22 too: 10-21 is really missed */
    function openPastTwoMidnights(freezes: number) {
      openPastMidnight(freezes);
      setToday('2026-10-22', 0);
      return state().recordAppOpen();
    }

    it('can still be won, then the day after it uses a freeze once closed', () => {
      expect(openPastTwoMidnights(1)).toMatchObject({ frozenDays: 0, lostStreak: 0 });
      state().completeDailyChallenge('2026-10-20', 300, 3);
      expect(state().currentStreak).toBe(6);

      state().setOpenDailyDate(null);
      expect(state().recordAppOpen()).toMatchObject({ frozenDays: 1, lostStreak: 0 });
      expect(state().frozenDates).toEqual(['2026-10-21']);
      state().completeDailyChallenge('2026-10-22', 300, 3);
      expect(state().currentStreak).toBe(7);
    });

    it('without a freeze, the streak it won is lost once closed', () => {
      openPastTwoMidnights(0);
      state().completeDailyChallenge('2026-10-20', 300, 3);
      state().setOpenDailyDate(null);
      expect(state().recordAppOpen()).toMatchObject({ lostStreak: 6 });

      state().completeDailyChallenge('2026-10-22', 300, 3);
      expect(state().currentStreak).toBe(1);
      expect(state().bestStreak).toBe(6);
    });

    it('once won, it no longer holds back the day after it, even before the game screen lets it go', () => {
      openPastTwoMidnights(1);
      state().completeDailyChallenge('2026-10-20', 300, 3);
      // Still marked open, but won: 10-21 is settled
      expect(state().recordAppOpen()).toMatchObject({ frozenDays: 1, lostStreak: 0 });
      expect(state().frozenDates).toEqual(['2026-10-21']);
    });
  });
});

describe('around Auckland’s daylight saving changes (#153)', () => {
  it.each([
    ['falls back', '2027-04-01'],
    ['springs forward', '2027-09-23'],
  ])('continues when it %s, without using a freeze', (_, start) => {
    winDays(start, 4);
    useGameStore.setState({ streakFreezes: 2 });
    const next = addDays(start, 4);
    setToday(next);
    expect(state().recordAppOpen()).toMatchObject({ frozenDays: 0, lostStreak: 0 });
    state().completeDailyChallenge(next, 300, 3);
    expect(state().currentStreak).toBe(5);
    expect(state().streakFreezes).toBe(2);
    expect(state().frozenDates).toEqual([]);
  });
});

describe('a daily left open past midnight, around a daylight saving change', () => {
  // The same dates in every zone of the CI (npm run test:tz): a change in one zone, a plain day in the others
  const changes = [
    '2026-09-27', // Auckland springs forward
    '2026-10-25', // Paris falls back
    '2026-11-01', // New York falls back
    '2027-03-14', // New York springs forward
    '2027-03-28', // Paris springs forward
    '2027-04-04', // Auckland falls back
  ];
  // The home records the new day at midnight, a minute later, or back from the background in the morning
  const homeTimes = ['00:00', '00:01', '08:00'];
  const cases = [
    // Open the night before the change: midnight, then the change
    ...changes.map(change => [addDays(change, -1), change]),
    // Open on the day of the change itself (23 h or 25 h long)
    ...changes.map(change => [change, addDays(change, 1)]),
  ].flatMap(([open, next]) => homeTimes.map(time => ({ open, next, time })));

  /** Freezes the clock at a local time ('HH:MM') of a YYYY-MM-DD day */
  function at(dateKey: string, time: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    jest.setSystemTime(new Date(year, month - 1, day, hour, minute));
  }

  it.each(cases)('the daily of $open open at 23:59, the home on $next at $time', ({ open, next, time }) => {
    winDays(addDays(open, -5), 5);
    useGameStore.setState({ streakFreezes: 1 });
    at(open, '23:59');
    state().recordAppOpen();
    state().setOpenDailyDate(open);
    useGameStore.setState({ savedStates: { [`daily-${open}`]: { vehicles: [], moveCount: 3, history: [] } } });

    // Its day is not missed, no freeze used, its game is still a daily
    at(next, time);
    expect(state().recordAppOpen()).toMatchObject({ frozenDays: 0, lostStreak: 0 });
    expect(state().currentStreak).toBe(5);
    expect(Object.keys(state().savedStates)).toEqual([`daily-${open}`]);

    // Won, then closed: the home settles again, no game left in the archives
    state().completeDailyChallenge(open, 300, 3);
    state().setOpenDailyDate(null);
    expect(state().recordAppOpen()).toMatchObject({ frozenDays: 0, lostStreak: 0 });
    expect(state()).toMatchObject({ currentStreak: 6, lastStreakDate: open, streakFreezes: 1, frozenDates: [] });
    expect(state().savedStates).toEqual({});

    // Today's daily still counts
    state().completeDailyChallenge(next, 300, 3);
    expect(state()).toMatchObject({ currentStreak: 7, lastStreakDate: next });
  });
});

describe('app open', () => {
  it('detects a comeback after 3 days or more', () => {
    setToday('2026-10-01');
    expect(state().recordAppOpen().isComeback).toBe(false);
    setToday('2026-10-03');
    expect(state().recordAppOpen()).toMatchObject({ isComeback: false, missedDays: 2 });
    setToday('2026-10-06');
    expect(state().recordAppOpen()).toMatchObject({ isComeback: true, missedDays: 3 });
    expect(state().stats.longestAbsenceDays).toBe(3);
  });
});
