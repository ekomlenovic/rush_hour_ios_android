import { MISSIONS, MISSIONS_BY_ID, MISSIONS_PER_DAY, getMissionsForDay, pickMissions, countMissionsDone } from '../data/missions';
import { useGameStore, MAX_STREAK_FREEZES } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { addDays } from '../utils/date';
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
      expect(state().consumeMissionReward()).toEqual({ freezeGranted: true });
      expect(state().consumeMissionReward()).toBeNull();

      winMapLevel();
      expect(state().streakFreezes).toBe(1);
      expect(state().stats.missionDaysCompleted).toBe(1);
      expect(state().consumeMissionReward()).toBeNull();
    });

    it('gives nothing when the freeze stock is full', () => {
      useGameStore.setState({ streakFreezes: MAX_STREAK_FREEZES });
      state().completeDailyChallenge(TODAY, 300, 3);
      expect(state().streakFreezes).toBe(MAX_STREAK_FREEZES);
      expect(state().consumeMissionReward()).toEqual({ freezeGranted: false });
      expect(state().stats.missionDaysCompleted).toBe(1);
    });
  });
});
