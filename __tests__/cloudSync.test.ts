import { useGameStore } from '../store/gameStore';
import { useCloudSyncStore } from '../store/cloudSyncStore';
import { sampleLevels } from '../data/sampleLevels';
import { STORE_VERSION } from '../store/migrations';
import { decodeSave, encodeSave, exportProgress, parseSave, transferableState } from '../utils/saveTransfer';
import { hasNotPlayed, isSameSave, mergeSaves } from '../utils/cloudMerge';
import { SNAPSHOT_NAME, syncProgress } from '../utils/cloudSync';
import type { RushPlayGamesModule } from '../modules/rush-play-games';
import type { Level } from '../store/types';
import { calculateScore, getStars } from '../utils/scoring';
import { resetStore, setToday, winDaily } from './helpers';

const store = () => useGameStore.getState();

/** A campaign level won, scored as the game screen does: 3 stars at the optimum, fewer with extra moves */
function winMapLevel(level: Level, options: { stars?: number } = {}) {
  const extra = { 3: 0, 2: 1, 1: level.minMoves * 2 }[options.stars ?? 3] ?? 0;
  const moves = level.minMoves + extra;
  store().loadLevel(level);
  store().completeLevel(level.id, calculateScore(moves, level.minMoves), getStars(moves, level.minMoves), 20_000);
}

/** The progress of this phone as a sync reads it from the cloud (exported, then checked as an import) */
function cloudState(): Record<string, any> {
  const result = parseSave(exportProgress());
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** A map level of the infinite map, drawn differently on each phone */
const generated = (id: number, shift: number): Level => ({
  ...sampleLevels[5],
  id,
  vehicles: sampleLevels[5].vehicles.map((v, i) => (i === 1 ? { ...v, color: `#00000${shift}` } : v)),
  updatedAt: 0,
});

/** A Play Jeux in memory: the snapshot holds the codes written, `versions` the conflicting ones */
function fakePlayGames(initial: string[] = [], options: { signedIn?: boolean; tooBig?: boolean } = {}) {
  const fake: { versions: string[]; [key: string]: any } = {
    versions: [...initial],
    written: [] as string[],
    discarded: 0,
    isAvailable: () => true,
    isSignedIn: jest.fn(async () => options.signedIn ?? true),
    signIn: jest.fn(async () => true),
    open: jest.fn(async (name: string): Promise<{ handle: number; contents: string[] }> => {
      expect(name).toBe(SNAPSHOT_NAME);
      return { handle: 1, contents: [...fake.versions] };
    }),
    commit: jest.fn(async (_handle: number, data: string) => {
      if (options.tooBig) throw Object.assign(new Error('too big'), { code: 'too_big' });
      fake.versions = [data];
      fake.written.push(data);
      return true;
    }),
    discard: jest.fn(async () => { fake.discarded++; return true; }),
  };
  return fake as RushPlayGamesModule & { versions: string[]; written: string[]; discarded: number; open: jest.Mock; isSignedIn: jest.Mock };
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  setToday('2026-10-12');
  useCloudSyncStore.setState({ enabled: true, status: 'idle', lastSyncAt: null, restored: false });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('mergeSaves', () => {
  it('keeps the best of each level from both phones', () => {
    winMapLevel(sampleLevels[0], { stars: 2 });
    winMapLevel(sampleLevels[1], { stars: 3 });
    const remote = cloudState();
    resetStore();
    setToday('2026-10-12');
    winMapLevel(sampleLevels[0], { stars: 3 });
    winMapLevel(sampleLevels[2], { stars: 1 });

    const merged = mergeSaves(transferableState(), remote);
    const byId = new Map((merged.progress as any[]).map(p => [p.levelId, p]));
    expect(byId.get(sampleLevels[0].id)).toMatchObject({ completed: true, stars: 3 });
    expect(byId.get(sampleLevels[1].id)).toMatchObject({ completed: true, stars: 3 });
    expect(byId.get(sampleLevels[2].id)).toMatchObject({ completed: true, stars: 1 });
    expect(merged.xp).toBe(Math.max(store().xp, remote.xp));
  });

  it('keeps the highest lifetime counters, never their sum (a phone started from the other counts its wins)', () => {
    winMapLevel(sampleLevels[0]);
    winMapLevel(sampleLevels[1]);
    const remote = cloudState();
    // This phone started from the cloud save, then won once more
    winMapLevel(sampleLevels[2]);
    const merged = mergeSaves(transferableState(), remote);
    expect(merged.stats.totalWins).toBe(3);
  });

  it('keeps the won result of a one-try daily over a game not won, and this phone\'s result when won on both', () => {
    winDaily('2026-10-11', 2);
    const remote = cloudState();
    remote.dailyChallengeProgress['2026-10-12'] = { completed: true, score: 300, stars: 3 };
    resetStore();
    setToday('2026-10-12');
    winDaily('2026-10-11', 1);

    const merged = mergeSaves(transferableState(), remote);
    expect(merged.dailyChallengeProgress['2026-10-11'].stars).toBe(1);
    expect(merged.dailyChallengeProgress['2026-10-12']).toMatchObject({ completed: true, stars: 3 });
  });

  it('keeps the streak of the save that won a daily last and the best streak of both', () => {
    winDaily('2026-10-10');
    winDaily('2026-10-11');
    winDaily('2026-10-12');
    const remote = cloudState();
    resetStore();
    winDaily('2026-10-12');
    const merged = mergeSaves(transferableState(), remote);
    expect(merged).toMatchObject({ currentStreak: 3, bestStreak: 3, lastStreakDate: '2026-10-12' });
  });

  it('keeps this phone\'s board and result for a map level drawn differently on the other phone', () => {
    const id = sampleLevels.length + 1;
    useGameStore.setState({ generatedLevels: [generated(id, 1), generated(id + 1, 1)] });
    const remote = { ...transferableState(), generatedLevels: [generated(id, 2), generated(id + 1, 2), generated(id + 2, 2)],
      progress: [{ levelId: id, completed: true, bestScore: 100, stars: 1 }, { levelId: id + 2, completed: true, bestScore: 100, stars: 1 }] };
    const merged = mergeSaves(transferableState(), remote);
    expect(merged.generatedLevels.map((l: Level) => l.vehicles[1].color)).toEqual(['#000001', '#000001', '#000002']);
    // The win on the other board stays with it; the level only in the cloud comes with its result
    expect(merged.progress.map((p: any) => p.levelId)).toEqual([id + 2]);
  });

  it('never changes a game in progress on this phone, and adds the ones only in the cloud', () => {
    store().loadLevel(sampleLevels[3]);
    const v = sampleLevels[3].vehicles.find(x => !x.isTarget)!;
    store().moveVehicle(v.id, v.row, v.col);
    const here = store().savedStates[sampleLevels[3].id];
    const remote = { ...transferableState(), savedStates: {
      [sampleLevels[3].id]: { ...here, moveCount: 40 },
      [sampleLevels[4].id]: { ...here, moveCount: 2 },
    } };
    const merged = mergeSaves(transferableState(), remote);
    expect(merged.savedStates[sampleLevels[3].id]).toBe(here);
    expect(merged.savedStates[sampleLevels[4].id].moveCount).toBe(2);
  });

  it('keeps this phone\'s settings, except on a phone that has not played yet', () => {
    winMapLevel(sampleLevels[0]);
    useGameStore.setState({ themeMode: 'dark' });
    const remote = cloudState();
    resetStore();
    expect(hasNotPlayed(transferableState())).toBe(true);
    expect(mergeSaves(transferableState(), remote).themeMode).toBe('dark');
    winMapLevel(sampleLevels[1]);
    useGameStore.setState({ themeMode: 'light' });
    expect(mergeSaves(transferableState(), remote).themeMode).toBe('light');
  });

  it('gives back this phone\'s state when the cloud holds nothing more', () => {
    winDaily('2026-10-11');
    winMapLevel(sampleLevels[0], { stars: 2 });
    const local = transferableState();
    expect(isSameSave(local, mergeSaves(local, cloudState()))).toBe(true);
  });
});

describe('syncProgress', () => {
  it('brings the progress back on a new phone, and tells the player', async () => {
    winDaily('2026-10-11');
    winMapLevel(sampleLevels[0]);
    const code = exportProgress();
    const xp = store().xp;
    resetStore();
    setToday('2026-10-12');

    const playGames = fakePlayGames([code]);
    expect(await syncProgress('launch', playGames)).toBe('synced');
    expect(store().xp).toBe(xp);
    expect(store().progress.find(p => p.levelId === sampleLevels[0].id)?.completed).toBe(true);
    expect(store().dailyChallengeProgress['2026-10-11']?.completed).toBe(true);
    expect(useCloudSyncStore.getState()).toMatchObject({ status: 'synced', restored: true });
    expect(playGames.written).toHaveLength(1);
  });

  it('writes this phone\'s progress when the cloud is empty', async () => {
    winMapLevel(sampleLevels[0]);
    const playGames = fakePlayGames();
    expect(await syncProgress('background', playGames)).toBe('synced');
    const written = parseSave(playGames.written[0]);
    expect(written.ok && written.state.progress).toEqual(store().progress);
  });

  it('writes nothing from a phone that has not played and found nothing', async () => {
    const playGames = fakePlayGames();
    expect(await syncProgress('launch', playGames)).toBe('synced');
    expect(playGames.written).toHaveLength(0);
    expect(playGames.discarded).toBe(1);
  });

  it('merges every version of a conflict, from two phones', async () => {
    winMapLevel(sampleLevels[0]);
    const first = exportProgress();
    resetStore();
    setToday('2026-10-12');
    winMapLevel(sampleLevels[1]);
    const second = exportProgress();
    resetStore();
    setToday('2026-10-12');
    winMapLevel(sampleLevels[2]);

    const playGames = fakePlayGames([first, second]);
    await syncProgress('win', playGames);
    const won = store().progress.filter(p => p.completed).map(p => p.levelId).sort((a, b) => a - b);
    expect(won).toEqual([sampleLevels[0].id, sampleLevels[1].id, sampleLevels[2].id]);
    expect(store().stats.totalWins).toBe(1);
  });

  it('leaves a cloud save made by a newer version of the game as it is', async () => {
    winMapLevel(sampleLevels[0]);
    const save = decodeSave(exportProgress()) as Exclude<ReturnType<typeof decodeSave>, string>;
    const newer = encodeSave({ ...save, version: STORE_VERSION + 1 });
    const playGames = fakePlayGames([newer]);
    expect(await syncProgress('background', playGames)).toBe('remote_newer');
    expect(playGames.written).toHaveLength(0);
    expect(playGames.versions).toEqual([newer]);
    expect(playGames.discarded).toBe(1);
  });

  it('writes over a cloud save that no one can read', async () => {
    winMapLevel(sampleLevels[0]);
    const playGames = fakePlayGames(['RHSAVE1.broken.code']);
    expect(await syncProgress('background', playGames)).toBe('synced');
    expect(playGames.written).toHaveLength(1);
  });

  it('sends nothing when the player is not signed in to Play Jeux', async () => {
    winMapLevel(sampleLevels[0]);
    const playGames = fakePlayGames([], { signedIn: false });
    expect(await syncProgress('background', playGames)).toBe('signed_out');
    expect(playGames.open).not.toHaveBeenCalled();
  });

  it('does nothing when the player turned it off', async () => {
    winMapLevel(sampleLevels[0]);
    useCloudSyncStore.setState({ enabled: false });
    const playGames = fakePlayGames();
    await syncProgress('background', playGames);
    expect(playGames.isSignedIn).not.toHaveBeenCalled();
  });

  it('never syncs a save that could not be read back', async () => {
    useGameStore.setState({ saveLoadFailed: true });
    const playGames = fakePlayGames();
    await syncProgress('launch', playGames);
    expect(playGames.open).not.toHaveBeenCalled();
  });

  it('says when the progress is too big for Play Jeux, and closes the snapshot', async () => {
    winMapLevel(sampleLevels[0]);
    const playGames = fakePlayGames([], { tooBig: true });
    expect(await syncProgress('background', playGames)).toBe('too_big');
    expect(playGames.discarded).toBe(1);
  });
});
