import {
  FAST_WIN_MS, MISSIONS, MISSIONS_BY_ID, MISSIONS_PER_DAY, activeMissionStreak, advanceMissionStreak, currentXpBonus, getMissionsForDay, pickMissions, countMissionsDone,
} from '../data/missions';
import { useGameStore, MAX_STREAK_FREEZES } from '../store/gameStore';
import { MISSIONS_FULL_STOCK_XP, MISSIONS_XP, levelWinXp } from '../data/progression';
import { sampleLevels } from '../data/sampleLevels';
import { addDays } from '../utils/date';
import { ACHIEVEMENTS } from '../data/achievements';
import { resetStore, setToday, winMapLevel } from './helpers';

// Level-up rewards also give freezes: tested in progression.test.ts, kept out of the streak rules here
jest.mock('../data/progression', () => ({ ...jest.requireActual('../data/progression'), getPlayerLevel: () => 1 }));

const state = () => useGameStore.getState();
const TODAY = '2026-10-14';

describe('pickMissions (rules in docs/GAME_DESIGN.md)', () => {
  const days = Array.from({ length: 366 }, (_, i) => addDays('2026-01-01', i));

  it('is deterministic: the same missions for everyone on a given date', () => {
    expect(pickMissions(TODAY)).toEqual(pickMissions(TODAY));
  });

  it(`always picks ${MISSIONS_PER_DAY} existing missions on distinct counters`, () => {
    for (const day of days) {
      const ids = pickMissions(day);
      expect(ids).toHaveLength(MISSIONS_PER_DAY);
      expect(ids.every(id => MISSIONS_BY_ID[id])).toBe(true);
      const counters = ids.map(id => MISSIONS_BY_ID[id].counter);
      expect(new Set(counters).size).toBe(MISSIONS_PER_DAY);
    }
  });

  it('changes from day to day and uses the whole pool over a year', () => {
    const sets = days.map(d => pickMissions(d).join());
    expect(new Set(sets).size).toBeGreaterThan(20);
    expect(new Set(days.flatMap(pickMissions))).toEqual(new Set(MISSIONS.map(m => m.id)));
  });

  it('has unique mission ids', () => {
    expect(new Set(MISSIONS.map(m => m.id)).size).toBe(MISSIONS.length);
  });
});

describe('getMissionsForDay', () => {
  it("keeps today's saved missions and renews them on a new day", () => {
    const saved = { date: TODAY, ids: ['win_3', 'daily', 'moves_100'], counters: { moves: 12 }, rewarded: false };
    expect(getMissionsForDay(saved, TODAY)).toBe(saved);

    const next = getMissionsForDay(saved, '2026-10-15');
    expect(next).toEqual({ date: '2026-10-15', ids: pickMissions('2026-10-15'), counters: {}, rewarded: false });
  });

  it('counts the missions done', () => {
    expect(countMissionsDone({ date: TODAY, ids: ['win_3', 'daily', 'moves_100'], counters: { levelWins: 5, moves: 99 }, rewarded: false })).toBe(1);
  });
});

describe('mission counters in the store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
    setToday(TODAY);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const counters = () => state().dailyMissions?.counters ?? {};

  it('count map level wins with their quality', () => {
    winMapLevel(sampleLevels[0], { stars: 3 });
    winMapLevel(sampleLevels[1], { stars: 2, hints: 1 });
    winMapLevel(sampleLevels[2], { stars: 3, undos: 1 });
    expect(counters()).toMatchObject({ levelWins: 3, perfectWins: 2, noHintWins: 2, cleanWins: 1 });
    expect(counters().bigGridWins).toBe(sampleLevels.slice(0, 3).filter(l => l.gridSize >= 7).length);
  });

  it('count first wins and wins under a minute', () => {
    winMapLevel(sampleLevels[0]);
    winMapLevel(sampleLevels[0]);
    state().loadLevel(sampleLevels[1]);
    state().completeLevel(sampleLevels[1].id, 300, 3, FAST_WIN_MS);
    expect(counters()).toMatchObject({ levelWins: 3, newLevelWins: 2, fastWins: 2 });
  });

  it('count moves and play time', () => {
    const level = sampleLevels[0];
    state().loadLevel(level);
    const v = level.vehicles[1];
    state().moveVehicle(v.id, v.row, v.col);
    state().moveVehicle(v.id, v.row, v.col);
    state().addPlayTime(5_000);
    expect(counters()).toMatchObject({ moves: 2, playMs: 5_000 });
  });

  it('never count the challenges as levels: only the "daily" mission', () => {
    state().completeDailyChallenge(TODAY, 300, 3);
    state().completeWeeklyChallenge('2026-W42', 300, 3);
    expect(counters()).toEqual({ dailyDone: 1 });
  });

  it("ignore a daily from another day", () => {
    state().completeDailyChallenge('2026-10-13', 300, 3);
    expect(counters().dailyDone).toBeUndefined();
  });

  it('are renewed at midnight', () => {
    winMapLevel();
    setToday('2026-10-15', 0);
    winMapLevel(sampleLevels[1]);
    expect(state().dailyMissions?.date).toBe('2026-10-15');
    expect(counters().levelWins).toBe(1);
  });

  describe('each mission completed is announced', () => {
    const start = (counters: Record<string, number> = {}) => useGameStore.setState({
      dailyMissions: { date: TODAY, ids: ['win_3', 'perfect_2', 'moves_100'], counters, rewarded: false },
    });

    it('once, when its target is reached, not before and not again after', () => {
      start({ levelWins: 1 });
      winMapLevel(sampleLevels[0], { stars: 2 });
      expect(state().consumeMissionsDone()).toEqual([]);
      winMapLevel(sampleLevels[1], { stars: 2 });
      expect(state().consumeMissionsDone()).toEqual(['win_3']);
      expect(state().consumeMissionsDone()).toEqual([]);
      winMapLevel(sampleLevels[2], { stars: 2 });
      expect(state().consumeMissionsDone()).toEqual([]);
    });

    it('two missions completed by the same win are announced together', () => {
      start({ levelWins: 2, perfectWins: 1 });
      winMapLevel(sampleLevels[0], { stars: 3 });
      expect(state().consumeMissionsDone()).toEqual(['win_3', 'perfect_2']);
      expect(state().consumeMissionReward()).toBeNull();
    });

    it('a mission completed while playing (moves) is announced too', () => {
      start({ moves: 99 });
      const level = sampleLevels[0];
      state().loadLevel(level);
      const v = level.vehicles[1];
      state().moveVehicle(v.id, v.row, v.col);
      expect(state().missionDoneQueue).toEqual(['moves_100']);
    });

    it('the last mission of the day is announced by the reward only, never twice', () => {
      start({ levelWins: 2, perfectWins: 2, moves: 100 });
      winMapLevel(sampleLevels[0], { stars: 2 });
      expect(state().consumeMissionReward()).not.toBeNull();
      expect(state().consumeMissionsDone()).toEqual([]);

      // A mission waiting for its toast when the last one is completed: the reward says it all
      resetStore();
      start({ levelWins: 2, perfectWins: 2, moves: 99 });
      const level = sampleLevels[0];
      state().loadLevel(level);
      const v = level.vehicles[1];
      state().moveVehicle(v.id, v.row, v.col);
      state().completeLevel(level.id, 200, 2, 20_000);
      expect(state().consumeMissionReward()).not.toBeNull();
      expect(state().consumeMissionsDone()).toEqual([]);
    });

    it('is not saved: nothing to announce again at the next launch', () => {
      start({ levelWins: 2 });
      winMapLevel(sampleLevels[0], { stars: 2 });
      const saved = useGameStore.persist.getOptions().partialize!(state()) as Record<string, unknown>;
      expect(saved).not.toHaveProperty('missionDoneQueue');
    });
  });

  describe('reward', () => {
    beforeEach(() => {
      // All missions but the daily one already done
      useGameStore.setState({
        dailyMissions: { date: TODAY, ids: ['win_3', 'daily', 'moves_100'], counters: { levelWins: 3, moves: 100 }, rewarded: false },
      });
    });

    it('completing the 3 missions gives a streak freeze, once a day', () => {
      state().completeDailyChallenge(TODAY, 300, 3);
      expect(state().dailyMissions?.rewarded).toBe(true);
      expect(state().streakFreezes).toBe(1);
      expect(state().stats.missionDaysCompleted).toBe(1);
      expect(state().consumeMissionReward()).toEqual({ freezeGranted: true, xp: MISSIONS_XP });
      expect(state().missionStreak).toEqual({ count: 1, lastDate: TODAY });
      expect(state().consumeMissionReward()).toBeNull();

      winMapLevel();
      expect(state().streakFreezes).toBe(1);
      expect(state().stats.missionDaysCompleted).toBe(1);
      expect(state().consumeMissionReward()).toBeNull();
    });

    it('gives the missions XP plus a bonus instead of the freeze when the stock is full', () => {
      useGameStore.setState({ streakFreezes: MAX_STREAK_FREEZES });
      state().completeDailyChallenge(TODAY, 300, 3);
      const xpFullStock = state().xp;
      expect(state().streakFreezes).toBe(MAX_STREAK_FREEZES);
      expect(state().consumeMissionReward()).toEqual({ freezeGranted: false, xp: MISSIONS_XP + MISSIONS_FULL_STOCK_XP });

      // Same day with room in the stock: only the bonus differs
      resetStore();
      useGameStore.setState({
        dailyMissions: { date: TODAY, ids: ['win_3', 'daily', 'moves_100'], counters: { levelWins: 3, moves: 100 }, rewarded: false },
      });
      state().completeDailyChallenge(TODAY, 300, 3);
      expect(xpFullStock - state().xp).toBe(MISSIONS_FULL_STOCK_XP);
      expect(state().stats.missionDaysCompleted).toBe(1);
    });
  });

    describe('mission streak', () => {
      /** All of the day's missions done, playing on that day; returns the XP they gave */
      const finishMissions = (day: string) => {
        setToday(day);
        // Room for the freeze, so that only the streak changes the XP
        useGameStore.setState({
          streakFreezes: 0,
          dailyMissions: { date: day, ids: ['win_3', 'moves_100', 'play_10min'], counters: { levelWins: 3, moves: 100 }, rewarded: false },
        });
        state().addPlayTime(10 * 60 * 1000);
        // What the missions gave, without the achievements they may have unlocked
        return state().consumeMissionReward()?.xp;
      };

      it('each day in a row adds 5 % to the XP the first week, then a big step at 30 and 60 days', () => {
        const gains = Array.from({ length: 61 }, (_, i) => finishMissions(addDays(TODAY, i)));
        expect(gains.slice(0, 9)).toEqual([200, 210, 220, 230, 240, 250, 260, 260, 260]);
        expect(gains.slice(28, 31)).toEqual([260, 320, 320]);
        expect(gains.slice(58)).toEqual([320, 400, 400]);
        expect(state().missionStreak).toEqual({ count: 61, lastDate: addDays(TODAY, 60) });
      });

      it('raises all the XP earned, not only the missions', () => {
        const level = sampleLevels[4];
        const base = levelWinXp(level.minMoves, 3, true);
        for (let i = 0; i < 7; i++) finishMissions(addDays(TODAY, i));
        // The day after a week of missions: +30 % on a level, before today's missions are even done
        setToday(addDays(TODAY, 7));
        // Every achievement already unlocked: only the level gives XP
        useGameStore.setState({ achievements: ACHIEVEMENTS.map(a => a.id) });
        const before = state().xp;
        state().loadLevel(level);
        state().completeLevel(level.id, 300, 3, 5 * 60_000);
        expect(state().xp - before).toBe(Math.round(base * 1.3));
      });

      it('adds up with the bonus of the daily streak', () => {
        for (let i = 0; i < 7; i++) finishMissions(addDays(TODAY, i));
        // 30 days of daily streak: +60 %, with the +30 % of a week of missions
        useGameStore.setState({ currentStreak: 30, bestStreak: 30, lastStreakDate: addDays(TODAY, 6) });
        expect(finishMissions(addDays(TODAY, 7))).toBe(Math.round(200 * 1.9));
      });

      it('a day without the 3 missions starts the streak again', () => {
        finishMissions(TODAY);
        finishMissions(addDays(TODAY, 1));
        expect(finishMissions(addDays(TODAY, 3))).toBe(200);
        expect(state().missionStreak).toEqual({ count: 1, lastDate: addDays(TODAY, 3) });
      });

      it('missions left unfinished do not count for the streak', () => {
        finishMissions(TODAY);
        finishMissions(addDays(TODAY, 1));
        setToday(addDays(TODAY, 2));
        winMapLevel();
        expect(state().missionStreak).toEqual({ count: 2, lastDate: addDays(TODAY, 1) });
        expect(finishMissions(addDays(TODAY, 3))).toBe(200);
      });

      it('a local date that went back neither adds a day nor loses the streak', () => {
        finishMissions(TODAY);
        finishMissions(addDays(TODAY, 1));
        expect(finishMissions(TODAY)).toBe(210);
        expect(state().missionStreak).toEqual({ count: 2, lastDate: addDays(TODAY, 1) });
      });

      it('is lost once a whole day went by, kept until then', () => {
        const streak = { count: 4, lastDate: TODAY };
        expect(activeMissionStreak(streak, TODAY)).toBe(4);
        expect(activeMissionStreak(streak, addDays(TODAY, 1))).toBe(4);
        expect(activeMissionStreak(streak, addDays(TODAY, 2))).toBe(0);
        expect(activeMissionStreak(null, TODAY)).toBe(0);
        expect(advanceMissionStreak(streak, addDays(TODAY, 1))).toEqual({ count: 5, lastDate: addDays(TODAY, 1) });
        expect(advanceMissionStreak(streak, TODAY)).toEqual(streak);
        expect(advanceMissionStreak(undefined, TODAY)).toEqual({ count: 1, lastDate: TODAY });
        expect(currentXpBonus({ missionStreak: streak, currentStreak: 30 }, TODAY)).toEqual({ missionDays: 4, missions: 15, streak: 60, total: 75 });
        expect(currentXpBonus({ missionStreak: streak, currentStreak: 0 }, addDays(TODAY, 2)).total).toBe(0);
      });
    });
});
