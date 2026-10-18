import AsyncStorage from '@react-native-async-storage/async-storage';
import type { useGameStore as UseGameStore } from '../store/gameStore';
import { MAX_SAVED_UNDOS } from '../store/savedStates';

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
