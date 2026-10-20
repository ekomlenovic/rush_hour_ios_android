import AsyncStorage from '@react-native-async-storage/async-storage';
import type { useGameStore as UseGameStore } from '../store/gameStore';
import { MAX_SAVED_UNDOS, undoStackOf } from '../store/savedStates';
import { sampleLevels } from '../data/sampleLevels';
import { setToday } from './helpers';
// Written on the device by 2.0.0 (store v5): 8 levels won, 3 dailies in a row, level 9 left after 60 moves, today's daily started
import save200 from './fixtures/save-2.0.0.json';

const KEY = 'rush-hour-storage';
const old = save200.state;

/** The app launched: a fresh store module, hydrating from the device storage */
async function launch(): Promise<typeof UseGameStore> {
  let store!: typeof UseGameStore;
  jest.isolateModules(() => {
    store = require('../store/gameStore').useGameStore;
  });
  // Opening the home screen, as useAppOpenAlert does
  const opened = new Promise<void>(resolve => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      store.getState().recordAppOpen();
      resolve();
    });
  });
  await opened;
  return store;
}

const onDevice = async () => JSON.parse((await AsyncStorage.getItem(KEY))!);
/** The grouped writes reach the device */
const settle = async () => {
  jest.runOnlyPendingTimers();
  await new Promise(r => setImmediate(r));
};

describe('updating from 2.0.0', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    setToday('2026-11-20');
    await AsyncStorage.clear();
    await AsyncStorage.setItem(KEY, JSON.stringify(save200));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the whole progress', async () => {
    const store = await launch();
    const state = store.getState();
    expect(state.progress).toEqual(old.progress);
    expect(state.maxUnlockedLevel).toBe(old.maxUnlockedLevel);
    expect(state.xp).toBe(old.xp);
    expect(state.dailyChallengeProgress).toEqual(old.dailyChallengeProgress);
    expect(state.currentStreak).toBe(3);
    expect(state.bestStreak).toBe(old.bestStreak);
    expect(state.streakFreezes).toBe(old.streakFreezes);
    expect(state.achievements).toEqual(old.achievements);
    expect(state.stats).toEqual(old.stats);
    expect(state.dailyMissions).toEqual(old.dailyMissions);

    // And it is written back as the current version, nothing lost on the device either
    await settle();
    const { state: written, version } = await onDevice();
    expect(version).toBe(11);
    expect(written.progress).toEqual(old.progress);
    expect(written.xp).toBe(old.xp);
  });

  it('resumes the level in progress where it was, with its last undo steps', async () => {
    const store = await launch();
    const saved = store.getState().savedStates[9];
    expect(saved.vehicles).toEqual(old.savedStates[9].vehicles);
    expect(saved.moveCount).toBe(60);
    expect(saved.attempt).toEqual(old.savedStates[9].attempt);
    expect(saved.moveLog).toEqual(old.savedStates[9].moveLog);
    expect(undoStackOf(saved)).toEqual(old.savedStates[9].history.slice(-MAX_SAVED_UNDOS));

    store.getState().loadLevel(sampleLevels[8]);
    expect(store.getState().moveCount).toBe(60);
    expect(store.getState().vehicles).toEqual(old.savedStates[9].vehicles);
    store.getState().undo();
    expect(store.getState().history).toHaveLength(MAX_SAVED_UNDOS - 1);
  });

  it("keeps today's daily, and carries it on in the archive the next day", async () => {
    let store = await launch();
    expect(store.getState().savedStates['daily-2026-11-20'].moveCount).toBe(1);

    setToday('2026-11-21');
    store = await launch();
    expect(store.getState().savedStates['daily-2026-11-20']).toBeUndefined();
    expect(store.getState().savedStates['archive-2026-11-20']).toMatchObject({ moveCount: 1, vehicles: old.savedStates['daily-2026-11-20'].vehicles });
  });

  it('keeps what is played after the update across launches', async () => {
    let store = await launch();
    const level = sampleLevels[8];
    store.getState().loadLevel(level);
    store.getState().completeLevel(level.id, 300, 3, 30_000);
    const xp = store.getState().xp;
    expect(xp).toBeGreaterThan(old.xp);
    await settle();

    store = await launch();
    expect(store.getState().progress.find(p => p.levelId === level.id)).toMatchObject({ completed: true, stars: 3 });
    expect(store.getState().progress).toHaveLength(old.progress.length + 1);
    expect(store.getState().xp).toBe(xp);
    expect(store.getState().savedStates[9]).toBeUndefined();
  });

  it('a failed read keeps the save, the next launch gets it all back', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Row too big to fit into CursorWindow'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let failed!: typeof UseGameStore;
    jest.isolateModules(() => {
      failed = require('../store/gameStore').useGameStore;
    });
    await new Promise(r => setImmediate(r));
    expect(failed.getState().saveLoadFailed).toBe(true);
    // Played on the empty state: nothing reaches the device
    failed.getState().recordAppOpen();
    failed.getState().loadLevel(sampleLevels[0]);
    failed.getState().completeLevel(sampleLevels[0].id, 100, 1, 10_000);
    await new Promise(r => setImmediate(r));
    expect(await onDevice()).toEqual(save200);
    warn.mockRestore();

    const store = await launch();
    expect(store.getState().saveLoadFailed).toBe(false);
    expect(store.getState().progress).toEqual(old.progress);
    expect(store.getState().xp).toBe(old.xp);
  });
});
