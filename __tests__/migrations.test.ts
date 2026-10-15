import { useGameStore, Level } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { resetStore } from './helpers';

const options = useGameStore.persist.getOptions();
const migrate = (state: Record<string, unknown>, version: number) =>
  options.migrate!(structuredClone(state), version) as unknown as Record<string, unknown>;
const merge = (persisted: Record<string, unknown>) =>
  options.merge!(persisted, useGameStore.getInitialState());

describe('persisted state', () => {
  it('is at version 2', () => {
    expect(options.version).toBe(2);
  });

  it('keeps the player data and leaves the in-game state out', () => {
    resetStore();
    useGameStore.setState({ unlockQueue: ['first_win'], pendingMissionReward: { freezeGranted: true } });
    const saved = options.partialize!(useGameStore.getState()) as Record<string, unknown>;
    for (const key of ['progress', 'dailyChallengeProgress', 'stats', 'currentStreak', 'streakFreezes', 'frozenDates', 'dailyMissions', 'achievements', 'savedStates']) {
      expect(saved).toHaveProperty(key);
    }
    for (const key of ['unlockQueue', 'pendingMissionReward', 'currentLevel', 'vehicles', 'history']) {
      expect(saved).not.toHaveProperty(key);
    }
  });
});

describe('migrate', () => {
  it('v0: drops the hint token economy and the old weekly challenge', () => {
    const state = migrate({ hintTokens: 12, weeklyChallenge: { completed: true }, progress: [] }, 0);
    expect(state).not.toHaveProperty('hintTokens');
    expect(state).not.toHaveProperty('weeklyChallenge');
    expect(state.progress).toEqual([]);
  });

  it('v1: rebuilds the streaks broken west of UTC from the completed dailies (#20)', () => {
    const state = migrate({
      dailyChallengeProgress: {
        '2026-10-01': { completed: true, score: 300, stars: 3 },
        '2026-10-02': { completed: true, score: 300, stars: 3 },
        '2026-10-03': { completed: true, score: 300, stars: 3 },
        '2026-10-04': { completed: true, score: 300, stars: 3 },
        '2026-10-12': { completed: true, score: 300, stars: 3 },
        '2026-10-13': { completed: true, score: 300, stars: 3 },
        '2026-10-14': { completed: false, score: 0, stars: 0 },
      },
      currentStreak: 1,
      bestStreak: 1,
      lastStreakDate: '2026-10-13',
    }, 1);
    expect(state).toMatchObject({ currentStreak: 2, bestStreak: 4, lastStreakDate: '2026-10-13' });
  });

  it('v1: never lowers a saved best streak', () => {
    const state = migrate({
      dailyChallengeProgress: { '2026-10-13': { completed: true, score: 300, stars: 3 } },
      bestStreak: 40,
    }, 1);
    expect(state.bestStreak).toBe(40);
  });

  it('v1: leaves a player without daily untouched', () => {
    const state = migrate({ currentStreak: 0, bestStreak: 0, lastStreakDate: null, dailyChallengeProgress: {} }, 1);
    expect(state).toMatchObject({ currentStreak: 0, bestStreak: 0, lastStreakDate: null });
  });

  it('v2 is up to date: nothing changes', () => {
    const saved = { currentStreak: 3, bestStreak: 5, lastStreakDate: '2026-10-14', dailyChallengeProgress: {} };
    expect(migrate(saved, 2)).toEqual(saved);
  });
});

describe('merge', () => {
  it('gives their default to stats added after the save', () => {
    const merged = merge({ stats: { totalWins: 12, totalMoves: 400 } });
    expect(merged.stats.totalWins).toBe(12);
    expect(merged.stats.freezesUsed).toBe(0);
    expect(merged.stats.winsByGridSize).toEqual({});
    expect(merged.streakFreezes).toBe(0);
  });

  it('relocates generated levels when the official pack grew', () => {
    const oldPackSize = sampleLevels.length - 10;
    const generated: Level = { ...sampleLevels[0], id: oldPackSize + 1 };
    const merged = merge({
      generatedLevels: [generated],
      progress: [
        { levelId: 5, completed: true, bestScore: 300, stars: 3 },
        { levelId: oldPackSize + 1, completed: true, bestScore: 200, stars: 2 },
      ],
      savedStates: { [oldPackSize + 1]: { vehicles: [], moveCount: 3, history: [] }, 'daily-2026-10-14': { vehicles: [], moveCount: 1, history: [] } },
      lastPlayedLevelId: oldPackSize + 1,
      maxUnlockedLevel: oldPackSize + 2,
    });

    const newId = sampleLevels.length + 1;
    expect(merged.generatedLevels.map(l => l.id)).toEqual([newId]);
    expect(merged.progress.map(p => p.levelId)).toEqual([5, newId]);
    expect(Object.keys(merged.savedStates).sort()).toEqual([String(newId), 'daily-2026-10-14'].sort());
    expect(merged.lastPlayedLevelId).toBe(newId);
    expect(merged.maxUnlockedLevel).toBe(newId + 1);
  });

  it('does not move generated levels already after the pack', () => {
    const generated: Level = { ...sampleLevels[0], id: sampleLevels.length + 1 };
    const merged = merge({ generatedLevels: [generated], maxUnlockedLevel: 12 });
    expect(merged.generatedLevels[0].id).toBe(sampleLevels.length + 1);
    expect(merged.maxUnlockedLevel).toBe(12);
  });
});
