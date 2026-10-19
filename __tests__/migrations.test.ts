import { useGameStore, Level } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { resetStore, setToday } from './helpers';
import { calculateScore } from '../utils/scoring';
import { MAX_SAVED_UNDOS } from '../store/savedStates';
import { ACHIEVEMENT_XP, MISSIONS_XP, dailyWinXp, levelWinXp, weeklyWinXp } from '../data/progression';

const options = useGameStore.persist.getOptions();
const migrate = (state: Record<string, unknown>, version: number) =>
  options.migrate!(structuredClone(state), version) as unknown as Record<string, unknown>;
/** Id a level of the pack had before the 5 levels inserted after level 5 in v5 */
const idBeforeV5 = (id: number) => (id > 10 ? id - 5 : id);
const merge = (persisted: Record<string, unknown>) =>
  options.merge!(persisted, useGameStore.getInitialState());

describe('persisted state', () => {
  it('is at version 6', () => {
    expect(options.version).toBe(6);
  });

  it('keeps the player data and leaves the in-game state out', () => {
    resetStore();
    useGameStore.setState({ unlockQueue: ['first_win'], pendingMissionReward: { freezeGranted: true, xp: 100 } });
    const saved = options.partialize!(useGameStore.getState()) as Record<string, unknown>;
    for (const key of ['progress', 'dailyChallengeProgress', 'stats', 'currentStreak', 'streakFreezes', 'frozenDates', 'dailyMissions', 'achievements', 'savedStates', 'xp', 'cosmetics', 'seenCosmetics']) {
      expect(saved).toHaveProperty(key);
    }
    for (const key of ['unlockQueue', 'pendingMissionReward', 'currentLevel', 'vehicles', 'history', 'levelUpQueue', 'lastXpGain']) {
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

  it('v2: credits the XP of the progress made before XP existed (#14)', () => {
    const level = sampleLevels[0];
    const state = migrate({
      progress: [{ levelId: level.id, completed: true, bestScore: 300, stars: 3 }],
      dailyChallengeProgress: { '2026-10-13': { completed: true, score: 300, stars: 3 } },
      weeklyChallengeProgress: { '2026-W41': { completed: true, score: 200, stars: 2 } },
      achievements: ['first_win', 'daily_winner'],
      stats: { missionDaysCompleted: 2 },
    }, 2);
    expect(state.xp).toBe(levelWinXp(level.minMoves, 3, true) + dailyWinXp(3) + weeklyWinXp(2) + 2 * MISSIONS_XP + 2 * ACHIEVEMENT_XP);
  });

  it('v2: a new player starts at 0 XP', () => {
    expect(migrate({}, 2).xp).toBe(0);
  });

  it('v3 is up to date: nothing changes', () => {
    const saved = { currentStreak: 3, bestStreak: 5, lastStreakDate: '2026-10-14', dailyChallengeProgress: {}, xp: 1234 };
    expect(migrate(saved, 3)).toEqual(saved);
  });
});

describe('migrate v3 → v4', () => {
  it('recounts the stars of past wins with the proportional rule', () => {
    const hard = sampleLevels.find(l => l.minMoves === 40)!;
    const easy = sampleLevels.find(l => l.minMoves === 12)!;
    const state = migrate({
      progress: [
        { levelId: idBeforeV5(hard.id), completed: true, bestScore: calculateScore(58, 40), stars: 1 },
        { levelId: idBeforeV5(easy.id), completed: true, bestScore: calculateScore(19, 12), stars: 1 },
        { levelId: 999999, completed: true, bestScore: 100, stars: 2 },
      ],
      dailyChallengeProgress: {
        '2026-10-13': { completed: true, score: calculateScore(29, 20), stars: 1, moves: 29, minMoves: 20 },
        '2026-10-12': { completed: true, score: 1000, stars: 1 },
      },
      xp: 1234,
    }, 3);
    expect((state.progress as { stars: number }[]).map(p => p.stars)).toEqual([2, 1, 2]);
    expect(state.dailyChallengeProgress).toMatchObject({ '2026-10-13': { stars: 2 }, '2026-10-12': { stars: 1 } });
    expect(state.xp).toBe(1234);
  });
});

describe('migrate v4 → v5', () => {
  it('inserts levels of 7 to 11 moves between level 5 and the old level 6 (12 moves)', () => {
    expect(sampleLevels.slice(4, 11).map(l => l.minMoves)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('moves the progress and saves of the levels from the old level 6 on', () => {
    // The daily in progress is today's: v6 leaves it where it is
    jest.useFakeTimers();
    setToday('2026-10-14');
    const lastOld = sampleLevels.length - 5;
    const generated: Level = { ...sampleLevels[0], id: lastOld + 1 };
    const state = migrate({
      progress: [
        { levelId: 5, completed: true, bestScore: 300, stars: 3 },
        { levelId: 6, completed: true, bestScore: 1200, stars: 3 },
        { levelId: lastOld + 1, completed: true, bestScore: 200, stars: 2 },
        { levelId: 999999, completed: true, bestScore: 100, stars: 2 },
      ],
      generatedLevels: [generated],
      savedStates: { 6: { vehicles: [], moveCount: 3, history: [] }, 'daily-2026-10-14': { vehicles: [], moveCount: 1, history: [] } },
      lastPlayedLevelId: 6,
      maxUnlockedLevel: 7,
    }, 4);

    expect((state.progress as { levelId: number }[]).map(p => p.levelId)).toEqual([5, 11, sampleLevels.length + 1, 999999]);
    expect((state.generatedLevels as Level[]).map(l => l.id)).toEqual([sampleLevels.length + 1]);
    expect(Object.keys(state.savedStates as object).sort()).toEqual(['11', 'daily-2026-10-14']);
    expect(state.lastPlayedLevelId).toBe(11);
    expect(state.maxUnlockedLevel).toBe(12);
    // The merge then has nothing left to relocate
    expect(merge(state).generatedLevels.map(l => l.id)).toEqual([sampleLevels.length + 1]);
    jest.useRealTimers();
  });

  it('sends a player stuck on the old level 6 to the new levels', () => {
    expect(migrate({ maxUnlockedLevel: 6 }, 4).maxUnlockedLevel).toBe(6);
    expect(migrate({ maxUnlockedLevel: 3 }, 4).maxUnlockedLevel).toBe(3);
  });
});

describe('migrate v5 → v6', () => {
  const board = (col: number) => [{ id: 'X', row: 2, col, length: 2, orientation: 'horizontal' as const, isTarget: true, color: '#f00' }];
  const save = (moves: number) => ({ vehicles: board(moves % 4), moveCount: moves, history: Array.from({ length: moves }, (_, i) => board(i % 4)), attempt: { hints: 1, undos: 0, resets: 0, timeMs: 5000 } });

  beforeEach(() => {
    jest.useFakeTimers();
    setToday('2026-11-20');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('caps the undo stacks of the levels in progress, keeping the latest steps', () => {
    const v5 = { progress: [{ levelId: 3, completed: true, bestScore: 300, stars: 3 }], xp: 1200, savedStates: { 12: save(300), 40: save(10) } };
    const state = migrate(v5, 5);
    const saved = state.savedStates as Record<string, ReturnType<typeof save>>;
    expect(saved[12].history).toHaveLength(MAX_SAVED_UNDOS);
    expect(saved[12].history).toEqual(save(300).history.slice(-MAX_SAVED_UNDOS));
    // The game itself carries on where it was
    expect(saved[12]).toMatchObject({ vehicles: save(300).vehicles, moveCount: 300, attempt: save(300).attempt });
    expect(saved[40]).toEqual(save(10));
    expect(state.progress).toEqual(v5.progress);
    expect(state.xp).toBe(1200);
  });

  it('keeps the challenges of today and this week, without undo stack', () => {
    const state = migrate({ savedStates: { 'daily-2026-11-20': save(30), 'weekly-2026-W47': save(80) } }, 5);
    const saved = state.savedStates as Record<string, ReturnType<typeof save>>;
    expect(saved['daily-2026-11-20']).toEqual({ ...save(30), history: [] });
    expect(saved['weekly-2026-W47']).toEqual({ ...save(80), history: [] });
  });

  it('moves a past daily in progress to the archive of that day', () => {
    const state = migrate({ savedStates: { 'daily-2026-11-15': save(20), 'daily-2026-11-10': save(5), 'archive-2026-11-10': save(7) } }, 5);
    const saved = state.savedStates as Record<string, ReturnType<typeof save>>;
    expect(Object.keys(saved).sort()).toEqual(['archive-2026-11-10', 'archive-2026-11-15']);
    expect(saved['archive-2026-11-15']).toEqual(save(20));
    // An archive already started keeps its own game
    expect(saved['archive-2026-11-10']).toEqual(save(7));
  });

  it('drops the saves that can never be opened again', () => {
    const state = migrate({ savedStates: { 'weekly-2026-W40': save(10), 'daily-2026-10-01': save(3), 'archive-2026-10-02': save(3), 5: save(2) } }, 5);
    expect(Object.keys(state.savedStates as object)).toEqual(['5']);
  });

  it('a save of the previous version still loads in the store', () => {
    const merged = merge(migrate({ maxUnlockedLevel: 14, savedStates: { 12: save(120) } }, 5));
    expect(merged.maxUnlockedLevel).toBe(14);
    expect(merged.savedStates[12].history).toHaveLength(MAX_SAVED_UNDOS);
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

describe('multiplayer accounts v2: secrets in the secure storage (#84)', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  const SecureStore = require('expo-secure-store');
  const { secretKey } = require('../store/secureAccounts');
  const KEY = 'rush-hours-multi';
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY))!);

  // A save written by the app before v2: the secrets in clear in AsyncStorage
  const v1Save = {
    version: 1,
    state: {
      accounts: [
        { url: 'https://rush.example', name: 'Amis', playerId: 4, pseudo: 'Léa', token: 't0k', recoveryCode: 'ABCD-EFGH', joinedAt: 1 },
        { url: 'https://other.example:8443', name: 'Club', playerId: 9, pseudo: 'Léa', token: 't1k', recoveryCode: 'IJKL-MNOP', joinedAt: 2, isAdmin: true },
      ],
      activeUrl: 'https://rush.example',
      introSeen: true,
      games: {},
      blocked: { 'https://rush.example': [{ playerId: 7, pseudo: 'Bob' }] },
    },
  };

  function launchMulti(): typeof import('../store/multiStore').useMultiStore {
    let store!: typeof import('../store/multiStore').useMultiStore;
    jest.isolateModules(() => {
      store = require('../store/multiStore').useMultiStore;
    });
    return store;
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
    SecureStore.items.clear();
    await AsyncStorage.setItem(KEY, JSON.stringify(v1Save));
  });

  it('is at version 2', () => {
    expect(launchMulti().persist.getOptions().version).toBe(2);
  });

  it('moves the secrets out of AsyncStorage, the player stays signed in', async () => {
    const store = launchMulti();
    await flush();
    expect(store.getState().accounts).toEqual(v1Save.state.accounts);
    expect(store.getState().blocked).toEqual(v1Save.state.blocked);

    const { state, version } = await stored();
    expect(version).toBe(2);
    expect(JSON.stringify(state)).not.toMatch(/t0k|t1k|ABCD-EFGH|IJKL-MNOP/);
    expect(state.accounts).toEqual(v1Save.state.accounts.map(({ token: _t, recoveryCode: _r, ...rest }) => rest));
    expect(JSON.parse(SecureStore.items.get(secretKey('https://other.example:8443')))).toEqual({ token: 't1k', recoveryCode: 'IJKL-MNOP' });

    // Next launch: read back from the secure storage
    const next = launchMulti();
    await flush();
    expect(next.getState().accounts).toEqual(v1Save.state.accounts);
  });

  it('forgets the secrets of a server left', async () => {
    const store = launchMulti();
    await flush();
    store.getState().removeAccount('https://rush.example');
    await flush();
    expect(SecureStore.items.has(secretKey('https://rush.example'))).toBe(false);
    expect(SecureStore.items.has(secretKey('https://other.example:8443'))).toBe(true);
  });

  it('writes a new recovery code to the secure storage', async () => {
    const store = launchMulti();
    await flush();
    store.getState().updateAccount('https://rush.example', { recoveryCode: 'QRST-UVWX' });
    await flush();
    expect(JSON.parse(SecureStore.items.get(secretKey('https://rush.example')))).toEqual({ token: 't0k', recoveryCode: 'QRST-UVWX' });
    expect(JSON.stringify(await stored())).not.toContain('QRST-UVWX');
  });

  it('keeps the secrets in the save when the secure storage fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    SecureStore.setItemAsync.mockRejectedValue(new Error('Keystore unavailable'));
    const store = launchMulti();
    await flush();
    expect((await stored()).state.accounts).toEqual(v1Save.state.accounts);

    SecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { SecureStore.items.set(key, value); });
    const next = launchMulti();
    await flush();
    expect(next.getState().accounts).toEqual(v1Save.state.accounts);
    expect(store.getState().accounts).toEqual(v1Save.state.accounts);
    warn.mockRestore();
  });

  it('keeps an account whose secrets were lost, signed out', async () => {
    const store = launchMulti();
    await flush();
    SecureStore.items.clear();
    const next = launchMulti();
    await flush();
    expect(next.getState().accounts[0]).toMatchObject({ url: 'https://rush.example', pseudo: 'Léa', token: '', recoveryCode: '' });
    expect(store.getState().accounts).toHaveLength(2);
  });

  it('escapes the server address into a valid secure storage key', () => {
    expect(secretKey('https://a.example:8443/x_y')).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(secretKey('https://a.example/a_b')).not.toBe(secretKey('https://a.example/a/b'));
  });
});
