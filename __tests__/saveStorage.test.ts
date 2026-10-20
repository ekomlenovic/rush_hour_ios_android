import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import type { useGameStore as UseGameStore } from '../store/gameStore';
import { MAX_SAVED_UNDOS, MAX_UNDO_STEPS, RECENT_SAVES_WITH_UNDOS, undoStackOf } from '../store/savedStates';
import { createGuardedStorage } from '../store/guardedStorage';

const KEY = 'rush-hour-storage';
const save = { state: { progress: [{ levelId: 1, completed: true, bestScore: 300, stars: 3 }], maxUnlockedLevel: 2, xp: 500 }, version: 6 };

/** A fresh store module, hydrating from the mocked device storage like at launch */
function launch(): typeof UseGameStore {
  let store!: typeof UseGameStore;
  jest.isolateModules(() => {
    store = require('../store/gameStore').useGameStore;
  });
  return store;
}

const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY))!);
const flush = () => new Promise(resolve => setImmediate(resolve));
/** The grouped writes reach the device */
const settle = async () => {
  jest.runOnlyPendingTimers();
  await flush();
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the save on the device', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(KEY, JSON.stringify(save));
    jest.clearAllMocks();
  });

  it('is never overwritten by an update made before it is loaded', async () => {
    const store = launch();
    // App open settled on the empty state of the first frames
    store.getState().recordAppOpen();
    expect(store.persist.hasHydrated()).toBe(false);
    expect((await stored()).state.progress).toEqual(save.state.progress);

    await flush();
    expect(store.persist.hasHydrated()).toBe(true);
    // Achievements already earned are unlocked on load (their XP on top)
    expect(store.getState().progress).toEqual(save.state.progress);
    expect(store.getState().xp).toBeGreaterThanOrEqual(500);
    await settle();
    expect((await stored()).state).toMatchObject({ progress: save.state.progress, maxUnlockedLevel: 2, xp: store.getState().xp });
  });

  it('keeps a level shared by a link that opened the app, imported once loaded (#118)', async () => {
    // The link is solved on a worklet runtime, whose mock runs on timers
    jest.useRealTimers();
    const { sampleLevels } = require('../data/sampleLevels');
    const { serializeLevel } = require('../utils/sharing');
    const imported = { ...sampleLevels[3], id: 111, name: 'Ancien' };
    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { ...save.state, importedLevels: [imported] }, version: 6 }));
    let store!: typeof UseGameStore;
    let importSharedLevel!: typeof import('../utils/levelResolver').importSharedLevel;
    jest.isolateModules(() => {
      store = require('../store/gameStore').useGameStore;
      importSharedLevel = require('../utils/levelResolver').importSharedLevel;
    });
    // The link is handled before the save is read back
    const id = await importSharedLevel(serializeLevel(sampleLevels[10]));
    expect(store.persist.hasHydrated()).toBe(true);
    const ids = store.getState().importedLevels.map(l => l.id);
    expect(ids).toEqual([111, id]);
    // The same link again opens the level already imported, a broken one imports nothing
    expect(await importSharedLevel(serializeLevel(sampleLevels[10]))).toBe(id);
    expect(await importSharedLevel('not-a-level')).toBeNull();
    expect(store.getState().importedLevels).toHaveLength(2);
  });

  it('is kept when it cannot be read back, nothing is written over it', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Row too big to fit into CursorWindow'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = launch();
    await flush();

    expect(store.getState().saveLoadFailed).toBe(true);
    expect(store.persist.hasHydrated()).toBe(false);
    store.getState().recordAppOpen();
    store.getState().hardReset();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect((await stored()).state).toEqual(save.state);
    warn.mockRestore();
  });

  it('writes the migrated save once loaded', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { savedStates: { 12: { vehicles: [], moveCount: 80, history: Array.from({ length: 80 }, () => []) } } }, version: 5 }));
    launch();
    await flush();
    await settle();
    const { state, version } = await stored();
    expect(version).toBe(11);
    expect(state.savedStates[12].history).toEqual([]);
    expect(state.savedStates[12].undoSteps).toHaveLength(MAX_SAVED_UNDOS);
  });
});

describe('the multiplayer accounts on the device', () => {
  const MULTI_KEY = 'rush-hours-multi';
  const account = { url: 'https://rush.example', name: 'Amis', playerId: 4, pseudo: 'Léa', token: 't0k', recoveryCode: 'ABCD-EFGH', joinedAt: 1 };
  const multiSave = { state: { accounts: [account], activeUrl: account.url, introSeen: true, games: {}, blocked: {} }, version: 1 };

  function launchMulti(): typeof import('../store/multiStore').useMultiStore {
    let store!: typeof import('../store/multiStore').useMultiStore;
    jest.isolateModules(() => {
      store = require('../store/multiStore').useMultiStore;
    });
    return store;
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(MULTI_KEY, JSON.stringify(multiSave));
    jest.clearAllMocks();
  });

  it('are never overwritten by an update made before they are loaded', async () => {
    const store = launchMulti();
    store.getState().setIntroSeen();
    expect(JSON.parse((await AsyncStorage.getItem(MULTI_KEY))!).state.accounts).toEqual([account]);
    await flush();
    expect(store.getState().accounts).toEqual([account]);
    // Once loaded, written back without the secrets (they moved to the secure storage)
    const { token: _token, recoveryCode: _code, ...rest } = account;
    expect(JSON.parse((await AsyncStorage.getItem(MULTI_KEY))!).state.accounts).toEqual([rest]);
  });

  it('are kept when they cannot be read back', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Row too big to fit into CursorWindow'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = launchMulti();
    await flush();
    expect(store.getState().loadFailed).toBe(true);
    store.getState().removeAccount(account.url);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(MULTI_KEY))!)).toEqual(multiSave);
    warn.mockRestore();
  });
});

describe('a level in progress', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps its whole undo stack in game, the last steps only in the save, in a compact form', async () => {
    const store = launch();
    await flush();
    const { sampleLevels } = require('../data/sampleLevels');
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    for (let i = 0; i < MAX_UNDO_STEPS + 10; i++) store.getState().moveVehicle(v.id, v.row, v.col);

    const history = store.getState().history;
    expect(history).toHaveLength(MAX_UNDO_STEPS + 10);
    const saved = store.getState().savedStates[level.id];
    expect(saved.history).toEqual([]);
    expect(saved.undoSteps).toHaveLength(MAX_UNDO_STEPS);
    expect(saved.moveCount).toBe(MAX_UNDO_STEPS + 10);
    expect(undoStackOf(saved)).toEqual(history.slice(-MAX_UNDO_STEPS));

    // Resumed with the same undo stack
    store.getState().loadLevel(level);
    expect(store.getState().history).toEqual(history.slice(-MAX_UNDO_STEPS));
  });

  it('keeps its undo stack among the 10 played last, none once older', async () => {
    const store = launch();
    await flush();
    const { sampleLevels } = require('../data/sampleLevels');
    const levels = sampleLevels.slice(20, 20 + RECENT_SAVES_WITH_UNDOS + 1);
    // Played one after the other, left unfinished; the first one is played again last
    for (const [i, level] of [...levels, levels[0]].entries()) {
      jest.setSystemTime(new Date(2026, 9, 1, 12, i));
      const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
      store.getState().loadLevel(level);
      for (let j = 0; j < 20; j++) store.getState().moveVehicle(v.id, v.row, v.col);
    }
    const before = store.getState().savedStates[levels[1].id];
    store.getState().recordAppOpen();

    const saved = store.getState().savedStates;
    expect(saved[levels[0].id].undoSteps).toHaveLength(40);
    expect(saved[levels[1].id].undoSteps).toEqual([]);
    for (const level of levels.slice(2)) expect(saved[level.id].undoSteps).toHaveLength(20);
    // The game itself is kept, and resumes without undo
    expect(saved[levels[1].id]).toEqual({ ...before, undoSteps: [] });
    store.getState().loadLevel(levels[1]);
    expect(store.getState().moveCount).toBe(20);
    expect(store.getState().history).toEqual([]);
  });
});

describe('the writes of the save', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(KEY, JSON.stringify(save));
    jest.clearAllMocks();
  });

  it('are grouped: a burst of moves is written once, with all of them', async () => {
    const store = launch();
    await flush();
    await settle();

    const { sampleLevels } = require('../data/sampleLevels');
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    await flush();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    for (let i = 0; i < 10; i++) store.getState().moveVehicle(v.id, v.row, v.col);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await settle();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const { state } = await stored();
    expect(state.savedStates[level.id].moveCount).toBe(10);
    expect(state.stats.totalMoves).toBe(store.getState().stats.totalMoves);
    expect(state.dailyMissions.counters.moves).toBe(10);
  });

  it('a win is written right away, with the moves before it', async () => {
    const store = launch();
    await flush();
    const { sampleLevels } = require('../data/sampleLevels');
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    for (let i = 0; i < 3; i++) store.getState().moveVehicle(v.id, v.row, v.col);
    store.getState().completeLevel(level.id, 300, 3, 30_000);
    // No timer run: nothing waits
    await flush();
    const { state } = await stored();
    expect(state.progress.find((p: { levelId: number }) => p.levelId === level.id)).toMatchObject({ completed: true, stars: 3 });
    expect(state.stats.totalMoves).toBe(store.getState().stats.totalMoves);
  });

  it('a move updates the store once, with its mission counters', async () => {
    const store = launch();
    await flush();
    const { sampleLevels } = require('../data/sampleLevels');
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    const updates = jest.fn();
    const unsubscribe = store.subscribe(updates);
    store.getState().moveVehicle(v.id, v.row, v.col);
    unsubscribe();
    expect(updates).toHaveBeenCalledTimes(1);
    expect(store.getState().dailyMissions?.counters.moves).toBe(1);
  });
});

describe('the grouped device storage', () => {
  const value = (moves: number) => ({ state: { moves }, version: 1 });
  /** The app changing state, as the system tells the listener of the storage */
  const appGoes = (state: AppStateStatus) => {
    const listeners = (AppState.addEventListener as jest.Mock).mock.calls.filter(([event]) => event === 'change');
    listeners[listeners.length - 1][1](state);
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  /** A grouped write, as the store makes for a move */
  const deferred = (guarded: ReturnType<typeof createGuardedStorage<{ moves: number }>>, moves: number) => {
    guarded.deferNextWrite();
    guarded.storage.setItem('k', value(moves));
  };

  it('writes what is pending as soon as the app leaves the foreground, then writes at once until it is back', async () => {
    const guarded = createGuardedStorage<{ moves: number }>({ delayMs: 1000 });
    guarded.allowWrites();
    deferred(guarded, 1);
    deferred(guarded, 2);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    // Killed in the background right after: nothing is lost
    appGoes('background');
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(2));

    // Play time recorded on the way out
    deferred(guarded, 3);
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(3));

    appGoes('active');
    deferred(guarded, 4);
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(4));
  });

  it('writes at once what is not grouped, with what was pending', async () => {
    const guarded = createGuardedStorage<{ moves: number }>({ delayMs: 1000 });
    guarded.allowWrites();
    deferred(guarded, 1);
    // A win: written right away, the move before it with it
    guarded.storage.setItem('k', value(2));
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(2));
    await settle();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('holds every write until the save is loaded', async () => {
    const guarded = createGuardedStorage<{ moves: number }>({ delayMs: 1000 });
    deferred(guarded, 1);
    guarded.storage.setItem('k', value(2));
    appGoes('background');
    await settle();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('the map, the archive days and the challenge results, in their own entries', () => {
  const GENERATED_KEY = `${KEY}:generatedLevels`;
  const ARCHIVES_KEY = `${KEY}:archiveLevels`;
  const RESULTS_KEYS = ['dailyChallengeProgress', 'weeklyChallengeProgress', 'archiveProgress'].map(field => `${KEY}:${field}`);
  const [DAILIES_KEY, , ARCHIVE_RESULTS_KEY] = RESULTS_KEYS;
  const { sampleLevels } = require('../data/sampleLevels');
  const generatedLevels = [0, 1].map(i => ({ ...sampleLevels[30 + i], id: sampleLevels.length + 1 + i }));
  const archiveLevels = { '2026-10-09': { ...sampleLevels[3], id: 900003 } };
  // Written by 2.0.2 and before: everything in one entry
  const oneEntry = {
    state: {
      progress: [{ levelId: 1, completed: true, bestScore: 300, stars: 3 }],
      maxUnlockedLevel: sampleLevels.length + 2,
      xp: 500,
      generatedLevels,
      archiveLevels,
      archiveProgress: { '2026-10-09': { completed: true, score: 1200, stars: 3, moves: 12, minMoves: 12 } },
      dailyChallengeProgress: { '2026-10-08': { completed: true, score: 1100, stars: 3, moves: 11, minMoves: 11 } },
      weeklyChallengeProgress: {},
    },
    version: 6,
  };
  const entry = async (key: string) => JSON.parse((await AsyncStorage.getItem(key))!);
  const writtenKeys = () => (AsyncStorage.multiSet as jest.Mock).mock.calls.map(([pairs]) => pairs.map(([key]: [string]) => key));
  async function launched() {
    const store = launch();
    await flush();
    await settle();
    return store;
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(KEY, JSON.stringify(oneEntry));
    jest.clearAllMocks();
  });

  it('a save in one entry loads whole, then is split, and loads the same', async () => {
    let store = await launched();
    expect(store.getState().generatedLevels).toEqual(generatedLevels);
    expect(store.getState().archiveLevels).toEqual(archiveLevels);
    expect(store.getState().maxUnlockedLevel).toBe(sampleLevels.length + 2);

    const main = await entry(KEY);
    expect(main.state).not.toHaveProperty('generatedLevels');
    expect(main.state).not.toHaveProperty('archiveLevels');
    for (const field of ['dailyChallengeProgress', 'weeklyChallengeProgress', 'archiveProgress']) expect(main.state).not.toHaveProperty(field);
    expect(main.state.progress).toEqual(oneEntry.state.progress);
    expect(await entry(GENERATED_KEY)).toEqual(generatedLevels);
    expect(await entry(ARCHIVES_KEY)).toEqual(archiveLevels);
    expect(await entry(DAILIES_KEY)).toEqual(oneEntry.state.dailyChallengeProgress);
    expect(await entry(ARCHIVE_RESULTS_KEY)).toEqual(oneEntry.state.archiveProgress);

    store = await launched();
    expect(store.getState().generatedLevels).toEqual(generatedLevels);
    expect(store.getState().archiveLevels).toEqual(archiveLevels);
    expect(store.getState().dailyChallengeProgress).toEqual(oneEntry.state.dailyChallengeProgress);
    expect(store.getState().archiveProgress).toEqual(oneEntry.state.archiveProgress);
    expect(store.getState().progress).toEqual(oneEntry.state.progress);
    expect(store.getState().xp).toBeGreaterThanOrEqual(500);
  });

  it('a challenge won writes its results entry, a move does not', async () => {
    const store = await launched();
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    jest.setSystemTime(new Date(2026, 9, 20, 12));
    store.getState().completeDailyChallenge('2026-10-20', 900, 3, 40000, { moves: 9, minMoves: 9 });
    await settle();
    expect(writtenKeys()[0]).toEqual([DAILIES_KEY, KEY]);
    expect(Object.keys(await entry(DAILIES_KEY)).sort()).toEqual(['2026-10-08', '2026-10-20']);

    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    await settle();
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    for (let i = 0; i < 5; i++) store.getState().moveVehicle(v.id, v.row, v.col);
    await settle();
    expect(writtenKeys()).toEqual([[KEY]]);
  });

  it('an older version installed back, which saw no challenge results, never makes them lost', async () => {
    await launched();
    // It wrote everything in one entry, with only the daily it won meanwhile
    const won = { completed: true, score: 1300, stars: 3, moves: 13, minMoves: 13 };
    const older = { ...oneEntry, state: { ...oneEntry.state, dailyChallengeProgress: { '2026-10-12': won }, archiveProgress: {} } };
    await AsyncStorage.setItem(KEY, JSON.stringify(older));

    const store = await launched();
    const dailies = { ...oneEntry.state.dailyChallengeProgress, '2026-10-12': won };
    expect(store.getState().dailyChallengeProgress).toEqual(dailies);
    expect(store.getState().archiveProgress).toEqual(oneEntry.state.archiveProgress);
    expect(await entry(DAILIES_KEY)).toEqual(dailies);
    expect((await entry(KEY)).state).not.toHaveProperty('dailyChallengeProgress');
  });

  it('are not written again by moves', async () => {
    await launched();
    const store = await launched();
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    await flush();
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    for (let i = 0; i < 5; i++) store.getState().moveVehicle(v.id, v.row, v.col);
    await settle();
    expect(writtenKeys()).toEqual([[KEY]]);
  });

  it('a new map level is written with the rest, in the same call, before it', async () => {
    const store = await launched();
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    const level = { ...sampleLevels[32], id: sampleLevels.length + 3 };
    store.getState().addGeneratedLevel(level);
    await settle();
    expect(writtenKeys()).toEqual([[GENERATED_KEY, KEY]]);
    expect(await entry(GENERATED_KEY)).toEqual([...generatedLevels, level]);

    const relaunched = await launched();
    expect(relaunched.getState().generatedLevels).toEqual([...generatedLevels, level]);
  });

  it('an older version installed back, which saw no map, never makes it lost', async () => {
    await launched();
    // It wrote everything in one entry: an empty map, the archive day it played, and the rest
    const otherDay = { '2026-10-10': { ...sampleLevels[4], id: 900003 } };
    const older = { ...oneEntry, state: { ...oneEntry.state, xp: 650, generatedLevels: [], archiveLevels: otherDay } };
    await AsyncStorage.setItem(KEY, JSON.stringify(older));

    const store = await launched();
    expect(store.getState().generatedLevels).toEqual(generatedLevels);
    expect(store.getState().archiveLevels).toEqual({ ...archiveLevels, ...otherDay });
    expect(store.getState().xp).toBeGreaterThanOrEqual(650);
    expect(await entry(GENERATED_KEY)).toEqual(generatedLevels);
    expect(await entry(ARCHIVES_KEY)).toEqual({ ...archiveLevels, ...otherDay });
    expect((await entry(KEY)).state).not.toHaveProperty('generatedLevels');
  });

  it('an older version installed back, which extended the map, keeps the longer map', async () => {
    await launched();
    const longer = [...generatedLevels, { ...sampleLevels[32], id: sampleLevels.length + 3 }];
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...oneEntry, state: { ...oneEntry.state, generatedLevels: longer } }));
    const store = await launched();
    expect(store.getState().generatedLevels).toEqual(longer);
    expect(await entry(GENERATED_KEY)).toEqual(longer);
  });

  it('are emptied by a reset, and still in the export', async () => {
    let store!: typeof UseGameStore;
    let exportProgress!: typeof import('../utils/saveTransfer').exportProgress;
    let decodeSave!: typeof import('../utils/saveTransfer').decodeSave;
    jest.isolateModules(() => {
      store = require('../store/gameStore').useGameStore;
      ({ exportProgress, decodeSave } = require('../utils/saveTransfer'));
    });
    await flush();
    await settle();
    const exported = decodeSave(exportProgress()) as { state: Record<string, unknown> };
    expect(exported.state.generatedLevels).toEqual(generatedLevels);
    expect(exported.state.archiveLevels).toEqual(archiveLevels);
    expect(exported.state.dailyChallengeProgress).toEqual(oneEntry.state.dailyChallengeProgress);

    store.getState().hardReset();
    await settle();
    expect(await entry(GENERATED_KEY)).toEqual([]);
    expect(await entry(ARCHIVES_KEY)).toEqual({});
    for (const key of RESULTS_KEYS) expect(await entry(key)).toEqual({});
  });
});
