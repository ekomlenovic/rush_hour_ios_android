import { ARCHIVE_LEVEL_ID, useGameStore } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { STORE_VERSION } from '../store/migrations';
import { archiveWinXp, getFreezeCapacity, getPlayerLevel } from '../data/progression';
import { decodeSave, encodeSave, exportProgress, maxPlausibleXp, parseSave } from '../utils/saveTransfer';
import { calculateScore, getStars } from '../utils/scoring';
import type { Level } from '../store/types';
import { resetStore, setToday, winDaily } from './helpers';

const store = () => useGameStore.getState();
const persisted = () => {
  const saved = useGameStore.persist.getOptions().partialize!(store()) as Record<string, unknown>;
  for (const key of ['notificationsEnabled', 'reminderHour', 'notificationsPrompted', 'generationState', 'savedStates', 'lastOpenDate', 'stats']) {
    delete saved[key];
  }
  return saved;
};

/** A campaign level won in `moves` moves, scored as the game screen does */
function winLevel(level: Level, extraMoves: number) {
  const moves = level.minMoves + extraMoves;
  store().loadLevel(level);
  store().completeLevel(level.id, calculateScore(moves, level.minMoves), getStars(moves, level.minMoves), 20_000);
}

/** A player with some campaign levels, a 3-day streak and a level in progress */
function playSomeDays() {
  winDaily('2026-10-10');
  winDaily('2026-10-11');
  winDaily('2026-10-12', 2);
  winLevel(sampleLevels[0], 0);
  winLevel(sampleLevels[1], 2);
  // A missed day replayed from the archives (set by hand: these saves predate ARCHIVE_FIRST_DATE)
  useGameStore.setState({
    archiveProgress: { '2026-10-09': { completed: true, score: 1200, stars: 3, moves: 12, minMoves: 12 } },
    archiveLevels: { '2026-10-09': { ...sampleLevels[3], id: ARCHIVE_LEVEL_ID } },
    xp: store().xp + archiveWinXp(12, 3),
  });
  store().loadLevel(sampleLevels[2]);
  const v = sampleLevels[2].vehicles.find(x => !x.isTarget)!;
  store().moveVehicle(v.id, v.row, v.col);
}

/** The code of a save whose state is edited by `edit`, with a valid checksum (a cheater who read the code) */
function forge(edit: (state: Record<string, any>) => void): string {
  const save = decodeSave(exportProgress()) as Exclude<ReturnType<typeof decodeSave>, string>;
  edit(save.state);
  return encodeSave(save);
}

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  setToday('2026-10-12');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('export then import', () => {
  it('gives back the same progress on another phone', () => {
    playSomeDays();
    const before = persisted();
    const code = exportProgress();

    resetStore();
    setToday('2026-10-12');
    const result = parseSave(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    store().importProgress(result.state);

    expect(persisted()).toEqual(before);
    expect(store().currentStreak).toBe(3);
  });

  it('summarizes the save before replacing anything', () => {
    playSomeDays();
    const result = parseSave(exportProgress());
    expect(result.ok && result.summary).toEqual({
      exportedAt: '2026-10-12',
      playerLevel: getPlayerLevel(store().xp),
      completedLevels: 2,
      totalStars: 5,
      currentStreak: 3,
    });
  });

  it('keeps the level in progress but not its undo history nor its move log', () => {
    playSomeDays();
    const key = String(sampleLevels[2].id);
    const inProgress = store().savedStates[key];
    useGameStore.setState({ savedStates: { ...store().savedStates, [key]: { ...inProgress, moveLog: [{ vehicleId: 'v1', delta: 1, t: 800 }] } } });
    const result = parseSave(exportProgress());
    if (!result.ok) throw new Error(result.error);
    const saved = (result.state.savedStates as Record<string, { moveCount: number; history: unknown[]; undoSteps: unknown[]; moveLog: unknown[] }>)[sampleLevels[2].id];
    expect(saved.moveCount).toBe(1);
    expect(saved.history).toEqual([]);
    expect(saved.undoSteps).toEqual([]);
    expect(saved.moveLog).toEqual([]);
  });

  it('keeps the settings of the phone it is imported on', () => {
    playSomeDays();
    useGameStore.setState({ notificationsEnabled: false, reminderHour: 19 });
    const code = exportProgress();

    resetStore();
    useGameStore.setState({ notificationsEnabled: true, reminderHour: 8, notificationsPrompted: true });
    const result = parseSave(code);
    if (!result.ok) throw new Error(result.error);
    store().importProgress(result.state);

    expect(store()).toMatchObject({ notificationsEnabled: true, reminderHour: 8, notificationsPrompted: true });
  });

  it('applies the days missed since the export (streak lost without freezes)', () => {
    playSomeDays();
    const code = exportProgress();

    resetStore();
    setToday('2026-10-20');
    const result = parseSave(code);
    if (!result.ok) throw new Error(result.error);
    store().importProgress(result.state);

    expect(store().currentStreak).toBe(0);
    expect(store().bestStreak).toBe(3);
  });

  it('survives a code copied on several lines', () => {
    playSomeDays();
    const code = exportProgress();
    const wrapped = code.match(/.{1,60}/g)!.join('\n  ');
    expect(parseSave(wrapped).ok).toBe(true);
  });

  it('accepts a created level edited after it was won (its optimum changed)', () => {
    playSomeDays();
    const created = { ...sampleLevels[0], id: 900001, minMoves: 2, updatedAt: 0 };
    const code = forge(s => {
      s.createdLevels = [created];
      s.progress.push({ levelId: created.id, completed: true, bestScore: 1500, stars: 3 });
    });
    expect(parseSave(code).ok).toBe(true);
  });

  it('accepts a win with 2 stars far from the optimum (2 stars within half of the optimum)', () => {
    playSomeDays();
    const level = sampleLevels.find(l => l.minMoves >= 12)!;
    winLevel(level, 5);
    expect(store().progress.find(p => p.levelId === level.id)!.stars).toBe(2);
    const code = forge(s => {
      s.weeklyChallengeProgress = { '2026-W41': { completed: true, score: 20 * 100 - 8 * 15, stars: 2, moves: 28, minMoves: 20 } };
    });
    expect(parseSave(code).ok).toBe(true);
  });

  it('accepts a challenge won under the former rule (2 stars within 3 extra moves), kept without its moves', () => {
    playSomeDays();
    const code = forge(s => {
      s.archiveProgress['2026-10-08'] = { completed: true, score: 2 * 100 - 3 * 15, stars: 2, minMoves: 2 };
    });
    expect(parseSave(code).ok).toBe(true);
  });

  it('migrates a save made by an older version of the app', () => {
    // v2: no XP yet, it is credited from the progress
    const code = encodeSave({
      version: 2,
      exportedAt: '2026-10-01',
      state: { progress: [{ levelId: 1, completed: true, bestScore: sampleLevels[0].minMoves * 100, stars: 3 }] },
    });
    const result = parseSave(code);
    expect(result.ok && result.state.xp).toBeGreaterThan(0);
  });

  it('counts the achievements of a save made before the "new" badges as seen', () => {
    const code = encodeSave({
      version: 9,
      exportedAt: '2026-10-01',
      state: { progress: [{ levelId: 1, completed: true, bestScore: sampleLevels[0].minMoves * 100, stars: 3 }], achievements: ['first_win'] },
    });
    const result = parseSave(code);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.seenAchievements).toEqual(['first_win']);
  });

  it('imports a save made before the challenge results had their own entry, with its levels in progress', () => {
    const board = [{ id: 'X', row: 2, col: 1, length: 2, orientation: 'horizontal', isTarget: true, color: '#f00' }];
    const inProgress = { vehicles: board, moveCount: 4, history: [], moveLog: [], attempt: { hints: 0, undos: 0, resets: 0, elapsedMs: 3000 }, startedAt: 1760000000000 };
    const daily = { completed: true, score: 1200, stars: 3, moves: 12, minMoves: 12 };
    const code = encodeSave({
      version: 10,
      exportedAt: '2026-10-12',
      state: {
        progress: [{ levelId: 1, completed: true, bestScore: sampleLevels[0].minMoves * 100, stars: 3 }],
        maxUnlockedLevel: 3,
        dailyChallengeProgress: { '2026-10-11': daily },
        savedStates: { [sampleLevels[2].id]: inProgress },
      },
    });
    const result = parseSave(code);
    if (!result.ok) throw new Error(result.error);
    expect(result.state.dailyChallengeProgress).toEqual({ '2026-10-11': daily });
    expect((result.state.savedStates as Record<string, unknown>)[sampleLevels[2].id]).toEqual(inProgress);
  });
});

describe('import refuses', () => {
  it('a text that is not a save code', () => {
    expect(parseSave('hello')).toEqual({ ok: false, error: 'invalid' });
    expect(parseSave('https://example.com/level?data=abc')).toEqual({ ok: false, error: 'invalid' });
  });

  it('a code edited by hand or cut short', () => {
    playSomeDays();
    const code = exportProgress();
    const [prefix, checksum, payload] = code.split('.');
    const edited = `${prefix}.${checksum}.${payload.slice(0, 10)}A${payload.slice(11)}`;
    expect(parseSave(edited)).toEqual({ ok: false, error: 'corrupted' });
    expect(parseSave(code.slice(0, -20))).toEqual({ ok: false, error: 'corrupted' });
  });

  it('a save from a newer version of the app', () => {
    const code = encodeSave({ version: STORE_VERSION + 1, exportedAt: '2026-10-12', state: {} });
    expect(parseSave(code)).toEqual({ ok: false, error: 'too_new' });
  });

  it('accepts a save made a day ahead, on a phone in a time zone further east', () => {
    // Exported in Auckland on the 13th, imported in New York where it is still the 12th
    setToday('2026-10-13');
    playSomeDays();
    winDaily('2026-10-13');
    const code = exportProgress();
    resetStore();
    setToday('2026-10-12');
    const result = parseSave(code);
    expect(result.ok).toBe(true);
    // Two days ahead is not a trip any more
    setToday('2026-10-11');
    expect(parseSave(code)).toEqual({ ok: false, error: 'inconsistent' });
  });

  describe('a save with a valid checksum but impossible data', () => {
    beforeEach(playSomeDays);

    it.each([
      ['a better score than the optimal solution', (s: any) => { s.progress[0].bestScore = sampleLevels[0].minMoves * 100 + 1; }],
      ['more stars than the score allows', (s: any) => { s.progress[1].stars = 3; }],
      ['2 stars with a score of 1 star', (s: any) => { s.progress[1].bestScore = 0; }],
      ['4 stars', (s: any) => { s.progress[0].stars = 4; }],
      ['a daily won in the future', (s: any) => { s.dailyChallengeProgress['2026-10-14'] = { completed: true, score: 100, stars: 3 }; }],
      ['an archive of a day not over yet', (s: any) => { s.archiveProgress['2026-10-13'] = { completed: true, score: 100, stars: 3 }; }],
      ['a broken archive level', (s: any) => { s.archiveLevels = { '2026-10-09': 'level' }; }],
      ['a weekly won in the future', (s: any) => { s.weeklyChallengeProgress['2026-W45'] = { completed: true, score: 100, stars: 3 }; }],
      ['a streak longer than the dailies won', (s: any) => { s.currentStreak = 30; s.bestStreak = 30; }],
      ['a streak above the best streak', (s: any) => { s.bestStreak = 2; }],
      ['a negative XP', (s: any) => { s.xp = -5; }],
      ['a date in the future', (s: any) => { s.lastStreakDate = '2027-01-01'; }],
      ['a broken progress list', (s: any) => { s.progress = 'all'; }],
      ['a broken custom level', (s: any) => { s.createdLevels = [{ id: 'x' }]; }],
      ['a broken cosmetics selection', (s: any) => { s.cosmetics = 'gold'; }],
    ])('%s', (_, edit) => {
      expect(parseSave(forge(edit))).toEqual({ ok: false, error: 'inconsistent' });
    });
  });
});

describe('import recomputes rather than trusts', () => {
  beforeEach(playSomeDays);

  it('caps the XP to what the wins can have given', () => {
    const result = parseSave(forge(s => { s.xp = 10_000_000; }));
    if (!result.ok) throw new Error(result.error);
    expect(result.state.xp).toBe(maxPlausibleXp(result.state));
    expect(result.state.xp).toBeLessThan(10_000);
  });

  it('never lowers the XP actually earned', () => {
    const xp = store().xp;
    const result = parseSave(exportProgress());
    expect(result.ok && result.state.xp).toBe(xp);
  });

  it('keeps the extra XP of a boss won', () => {
    winLevel(sampleLevels[29], 0);
    const xp = store().xp;
    const result = parseSave(exportProgress());
    if (!result.ok) throw new Error(result.error);
    expect(result.state.xp).toBe(xp);
  });

  it('caps the freezes to the stock allowed at the player level', () => {
    const result = parseSave(forge(s => { s.streakFreezes = 50; }));
    if (!result.ok) throw new Error(result.error);
    expect(result.state.streakFreezes).toBe(getFreezeCapacity(getPlayerLevel(result.state.xp as number)));
  });

  it('only replaces what the app saves', () => {
    const result = parseSave(forge(s => { s.importProgress = 'broken'; s.currentLevel = 'broken'; }));
    if (!result.ok) throw new Error(result.error);
    expect(result.state).not.toHaveProperty('importProgress');
    expect(result.state).not.toHaveProperty('currentLevel');
  });

  it('drops unknown achievements', () => {
    const result = parseSave(forge(s => { s.achievements = [...s.achievements, 'god_mode', 'god_mode']; }));
    expect(result.ok && result.state.achievements).not.toContain('god_mode');
  });

  it('falls back to the default style for a cosmetic that is not unlocked', () => {
    const result = parseSave(forge(s => { s.cosmetics = { ...s.cosmetics, board: 'neon' }; }));
    if (!result.ok) throw new Error(result.error);
    store().importProgress(result.state);
    expect(store().cosmetics.board).not.toBe('neon');
  });
});

describe('import drops what it cannot read', () => {
  beforeEach(playSomeDays);

  it.each([
    ['no vehicles', { moveCount: 2, history: [] }],
    ['a broken vehicle', { vehicles: [{ id: 'v1', row: 'top' }], moveCount: 2, history: [] }],
    ['a negative move count', { vehicles: [], moveCount: -1, history: [] }],
    ['a broken undo history', { vehicles: [], moveCount: 2, history: 'none' }],
    ['a broken move log', { vehicles: [], moveCount: 2, history: [], moveLog: 'none' }],
    ['not a save at all', 'level'],
  ])('a level in progress with %s, keeping the rest of the save', (_, broken) => {
    const key = String(sampleLevels[4].id);
    const result = parseSave(forge(s => { s.savedStates[key] = broken; }));
    if (!result.ok) throw new Error(result.error);
    const savedStates = result.state.savedStates as Record<string, unknown>;
    expect(savedStates).not.toHaveProperty(key);
    expect(savedStates).toHaveProperty(String(sampleLevels[2].id));

    store().importProgress(result.state);
    expect(() => store().loadLevel(sampleLevels[4])).not.toThrow();
    expect(store().moveCount).toBe(0);
  });

  it('statistics that are not numbers, which take their default', () => {
    const result = parseSave(forge(s => {
      s.stats = { ...s.stats, totalMoves: 'many', totalUndos: null, totalResets: -3, nightWins: 2, winsByGridSize: { 6: 'x', 7: 4 }, fastestWinMs: null, cheat: 1 };
    }));
    if (!result.ok) throw new Error(result.error);
    store().importProgress(result.state);
    const { stats } = store();
    expect(stats).toMatchObject({ totalMoves: 0, totalUndos: 0, totalResets: 0, nightWins: 2, winsByGridSize: { 7: 4 }, fastestWinMs: null });
    expect(stats).not.toHaveProperty('cheat');
    expect(maxPlausibleXp(result.state)).not.toBeNaN();
  });
});

describe('a level in progress broken on the phone', () => {
  it('starts the level fresh rather than crashing', () => {
    const level = sampleLevels[4];
    useGameStore.setState({ savedStates: { [level.id]: { moveCount: 3 } as never } });
    expect(() => store().loadLevel(level)).not.toThrow();
    expect(store().moveCount).toBe(0);
    expect(store().savedStates).not.toHaveProperty(String(level.id));
  });
});
