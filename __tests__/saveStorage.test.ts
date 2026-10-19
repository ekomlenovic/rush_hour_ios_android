import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import type { useGameStore as UseGameStore } from '../store/gameStore';
import { MAX_SAVED_UNDOS } from '../store/savedStates';
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
    expect(version).toBe(6);
    expect(state.savedStates[12].history).toHaveLength(MAX_SAVED_UNDOS);
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
    expect(JSON.parse((await AsyncStorage.getItem(MULTI_KEY))!).state.accounts).toEqual([account]);
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
  it('keeps its whole undo stack in game, the last steps only in the save', async () => {
    const store = launch();
    await flush();
    const { sampleLevels } = require('../data/sampleLevels');
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    for (let i = 0; i < MAX_SAVED_UNDOS + 10; i++) store.getState().moveVehicle(v.id, v.row, v.col);

    expect(store.getState().history).toHaveLength(MAX_SAVED_UNDOS + 10);
    expect(store.getState().savedStates[level.id].history).toHaveLength(MAX_SAVED_UNDOS);
    expect(store.getState().savedStates[level.id].moveCount).toBe(MAX_SAVED_UNDOS + 10);
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
    (AsyncStorage.setItem as jest.Mock).mockClear();

    const { sampleLevels } = require('../data/sampleLevels');
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
    for (let i = 0; i < 10; i++) store.getState().moveVehicle(v.id, v.row, v.col);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await settle();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const { state } = await stored();
    expect(state.savedStates[level.id].moveCount).toBe(10);
    expect(state.stats.totalMoves).toBe(store.getState().stats.totalMoves);
    expect(state.dailyMissions.counters.moves).toBe(10);
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

  it('writes what is pending as soon as the app leaves the foreground, then writes at once until it is back', async () => {
    const { storage, allowWrites } = createGuardedStorage<{ moves: number }>({ delayMs: 1000 });
    allowWrites();
    storage.setItem('k', value(1));
    storage.setItem('k', value(2));
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    // Killed in the background right after: nothing is lost
    appGoes('background');
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(2));

    // Play time recorded on the way out
    storage.setItem('k', value(3));
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(3));

    appGoes('active');
    storage.setItem('k', value(4));
    await flush();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('k'))!)).toEqual(value(4));
  });

  it('holds every write until the save is loaded', async () => {
    const { storage } = createGuardedStorage<{ moves: number }>({ delayMs: 1000 });
    storage.setItem('k', value(1));
    appGoes('background');
    await settle();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('the map and the archive days, in their own entries', () => {
  const GENERATED_KEY = `${KEY}:generatedLevels`;
  const ARCHIVES_KEY = `${KEY}:archiveLevels`;
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
    expect(main.state.progress).toEqual(oneEntry.state.progress);
    expect(await entry(GENERATED_KEY)).toEqual(generatedLevels);
    expect(await entry(ARCHIVES_KEY)).toEqual(archiveLevels);

    store = await launched();
    expect(store.getState().generatedLevels).toEqual(generatedLevels);
    expect(store.getState().archiveLevels).toEqual(archiveLevels);
    expect(store.getState().progress).toEqual(oneEntry.state.progress);
    expect(store.getState().xp).toBeGreaterThanOrEqual(500);
  });

  it('are not written again by moves', async () => {
    await launched();
    const store = await launched();
    (AsyncStorage.multiSet as jest.Mock).mockClear();
    const level = sampleLevels[20];
    const v = level.vehicles.find((x: { isTarget: boolean }) => !x.isTarget);
    store.getState().loadLevel(level);
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

  it('the main entry wins when it still has them (written by an older version since)', async () => {
    await launched();
    // An older version, installed back, wrote everything in one entry, with one more map level
    const older = { ...oneEntry, state: { ...oneEntry.state, generatedLevels: [...generatedLevels, { ...sampleLevels[32], id: sampleLevels.length + 3 }] } };
    await AsyncStorage.setItem(KEY, JSON.stringify(older));
    const store = await launched();
    expect(store.getState().generatedLevels).toEqual(older.state.generatedLevels);
    expect(await entry(GENERATED_KEY)).toEqual(older.state.generatedLevels);
    expect((await entry(KEY)).state).not.toHaveProperty('generatedLevels');
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

    store.getState().hardReset();
    await settle();
    expect(await entry(GENERATED_KEY)).toEqual([]);
    expect(await entry(ARCHIVES_KEY)).toEqual({});
  });
});
