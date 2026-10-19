import {
  ACHIEVEMENT_XP, BASE_FREEZE_SLOTS, BOSS_WIN_XP, MISSIONS_XP, REPLAY_XP_FACTOR, dailyWinXp, getFreezeCapacity, getLevelInfo,
  getPlayerLevel, getPlayerTitle, levelWinXp, totalXpForLevel, weeklyWinXp, xpToNextLevel,
} from '../data/progression';
import {
  COSMETICS, DEFAULT_COSMETICS, buildCosmeticContext, cosmeticKey, getLevelCosmetics, isCosmeticUnlocked, sanitizeSelection,
  type CosmeticSource,
} from '../data/cosmetics';
import { ACHIEVEMENTS_BY_ID } from '../data/achievements';
import { BOARD_THEMES, CAR_SKINS, VEHICLE_PALETTES, applyPalette } from '../theme/board';
import { useGameStore, MAX_STREAK_FREEZES } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { resetStore, setToday, winDaily, winMapLevel } from './helpers';

const state = () => useGameStore.getState();

describe('level curve (rules in docs/GAME_DESIGN.md)', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(getLevelInfo(0)).toEqual({ level: 1, xpInLevel: 0, xpForNext: xpToNextLevel(1), ratio: 0 });
  });

  it('places the XP inside the current level', () => {
    const xp = totalXpForLevel(4) + 10;
    expect(getLevelInfo(xp)).toMatchObject({ level: 4, xpInLevel: 10, xpForNext: xpToNextLevel(4) });
    expect(getPlayerLevel(totalXpForLevel(4) - 1)).toBe(3);
  });

  it('gets steeper at each level', () => {
    for (let n = 1; n < 50; n++) expect(xpToNextLevel(n + 1)).toBeGreaterThan(xpToNextLevel(n));
  });

  it('is not easy: about a month and a half of daily play for level 10, a year for level 20', () => {
    // A very active day: 5 new 3-star levels of 15 moves, the daily (3 stars) and the 3 missions
    const day = 5 * levelWinXp(15, 3, true) + dailyWinXp(3) + MISSIONS_XP;
    expect(totalXpForLevel(10) / day).toBeGreaterThan(40);
    expect(totalXpForLevel(20) / day).toBeGreaterThan(250);
    expect(totalXpForLevel(5) / day).toBeLessThan(10);
  });

  it('gives a title by tier', () => {
    expect(getPlayerTitle(1)).toBe('apprentice');
    expect(getPlayerTitle(9)).toBe('driver');
    expect(getPlayerTitle(10)).toBe('pilot');
    expect(getPlayerTitle(99)).toBe('legend');
  });
});

describe('XP rewards', () => {
  it('gives more for harder levels and more stars', () => {
    expect(levelWinXp(30, 3, true)).toBeGreaterThan(levelWinXp(10, 3, true));
    expect(levelWinXp(15, 3, true)).toBeGreaterThan(levelWinXp(15, 2, true));
    expect(levelWinXp(15, 2, true)).toBeGreaterThan(levelWinXp(15, 1, true));
  });

  it('gives a share of it for a level already won (no farming)', () => {
    expect(levelWinXp(20, 3, false)).toBe(Math.round(levelWinXp(20, 3, true) * REPLAY_XP_FACTOR));
    expect(levelWinXp(1, 1, false)).toBeGreaterThanOrEqual(1);
  });

  it('values the challenges', () => {
    expect(weeklyWinXp(1)).toBeGreaterThan(dailyWinXp(3));
  });
});

describe('freeze slots', () => {
  it(`start at ${BASE_FREEZE_SLOTS} and grow with the player level`, () => {
    expect(MAX_STREAK_FREEZES).toBe(BASE_FREEZE_SLOTS);
    expect(getFreezeCapacity(1)).toBe(2);
    expect(getFreezeCapacity(5)).toBe(3);
    expect(getFreezeCapacity(10)).toBe(4);
    expect(getFreezeCapacity(20)).toBe(5);
    expect(getFreezeCapacity(30)).toBe(6);
    expect(getFreezeCapacity(80)).toBe(6);
  });
});

describe('store: XP', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setToday('2026-10-14');
    resetStore();
  });
  afterEach(() => jest.useRealTimers());

  it('a won level gives XP, recorded for the win screen', () => {
    const level = sampleLevels[0];
    winMapLevel(level, { stars: 3 });
    expect(state().xp).toBeGreaterThanOrEqual(levelWinXp(level.minMoves, 3, true));
    expect(state().lastXpGain).toEqual({ from: 0, to: state().xp });
  });

  it('replaying a level gives less', () => {
    const level = sampleLevels[0];
    winMapLevel(level, { stars: 3 });
    const before = state().xp;
    winMapLevel(level, { stars: 3 });
    expect(state().xp - before).toBe(levelWinXp(level.minMoves, 3, false));
  });

  it('the daily gives its XP once', () => {
    winDaily('2026-10-14', 3);
    const after = state().xp;
    expect(after).toBeGreaterThanOrEqual(dailyWinXp(3));
    useGameStore.getState().completeDailyChallenge('2026-10-14', 300, 3);
    expect(state().xp).toBe(after);
  });

  it('unlocked achievements give XP', () => {
    winMapLevel(sampleLevels[0], { stars: 3 });
    expect(state().achievements).toContain('first_win');
    expect(state().xp).toBe(levelWinXp(sampleLevels[0].minMoves, 3, true) + state().achievements.length * ACHIEVEMENT_XP);
  });

  it('the first win of a boss gives extra XP, not a replay', () => {
    const boss = sampleLevels[29];
    winMapLevel(boss, { stars: 3 });
    expect(state().xp).toBe(levelWinXp(boss.minMoves, 3, true) + BOSS_WIN_XP + state().achievements.length * ACHIEVEMENT_XP);
    const before = state().xp;
    winMapLevel(boss, { stars: 3 });
    expect(state().xp - before).toBe(levelWinXp(boss.minMoves, 3, false));
  });

  it('reaching a level gives a freeze and is queued for display', () => {
    useGameStore.setState({ xp: totalXpForLevel(2) - 1 });
    winMapLevel(sampleLevels[0], { stars: 1 });
    expect(getPlayerLevel(state().xp)).toBe(2);
    expect(state().streakFreezes).toBe(1);
    expect(state().stats.freezesEarned).toBe(1);
    expect(state().consumeLevelUps()).toEqual([2]);
    expect(state().levelUpQueue).toEqual([]);
  });

  it('a higher level raises the freeze stock limit', () => {
    useGameStore.setState({ xp: totalXpForLevel(5), streakFreezes: 2 });
    expect(state().addStreakFreeze()).toBe(true);
    expect(state().streakFreezes).toBe(3);
    expect(state().addStreakFreeze()).toBe(false);
  });

  it('a level up with a full stock gives no freeze', () => {
    useGameStore.setState({ xp: totalXpForLevel(2) - 1, streakFreezes: 2 });
    winMapLevel(sampleLevels[0], { stars: 1 });
    expect(state().streakFreezes).toBe(2);
  });

  it('a hard reset clears the XP and the cosmetics', () => {
    useGameStore.setState({ xp: 5000, cosmetics: { ...DEFAULT_COSMETICS, skin: 'taxi' }, seenCosmetics: ['skin:taxi'] });
    state().hardReset();
    expect(state()).toMatchObject({ xp: 0, cosmetics: DEFAULT_COSMETICS, seenCosmetics: [] });
  });
});

describe('cosmetics', () => {
  const source = (over: Partial<CosmeticSource> = {}): CosmeticSource => ({
    xp: 0, progress: [], dailyChallengeProgress: {}, weeklyChallengeProgress: {}, achievements: [], ...over,
  });
  const byKey = (key: string) => COSMETICS.find(c => cosmeticKey(c) === key)!;

  it('has unique ids, a translation key per kind and an existing look for each', () => {
    expect(new Set(COSMETICS.map(cosmeticKey)).size).toBe(COSMETICS.length);
    for (const def of COSMETICS) {
      if (def.kind === 'board') expect(BOARD_THEMES).toHaveProperty(def.id);
      if (def.kind === 'skin') expect(CAR_SKINS).toHaveProperty(def.id);
      if (def.kind === 'palette') expect(VEHICLE_PALETTES).toHaveProperty(def.id);
      if (def.unlock.type === 'achievement') expect(ACHIEVEMENTS_BY_ID).toHaveProperty(def.unlock.id);
    }
  });

  it('only the defaults are unlocked at first', () => {
    const c = buildCosmeticContext(source());
    const unlocked = COSMETICS.filter(def => isCosmeticUnlocked(def, c));
    expect(unlocked.every(def => def.unlock.type === 'default')).toBe(true);
    expect(unlocked.map(d => d.kind).sort()).toEqual(['board', 'effect', 'palette', 'skin']);
  });

  it('unlocks with the player level, the stars, the weeklies, an achievement and winter', () => {
    const c = buildCosmeticContext(source({
      xp: totalXpForLevel(10),
      progress: Array.from({ length: 50 }, (_, i) => ({ levelId: i + 1, completed: true, bestScore: 300, stars: 3 })),
      weeklyChallengeProgress: { '2026-W41': { completed: true, score: 300, stars: 3 } },
      achievements: ['streak_30'],
      dailyChallengeProgress: { '2026-01-15': { completed: true, score: 300, stars: 3 } },
    }));
    for (const key of ['board:neon', 'skin:taxi', 'board:paper', 'board:wood', 'skin:bus', 'board:fire', 'board:snow']) {
      expect({ key, unlocked: isCosmeticUnlocked(byKey(key), c) }).toEqual({ key, unlocked: true });
    }
    for (const key of ['skin:rocket', 'board:pixel', 'skin:police']) {
      expect({ key, unlocked: isCosmeticUnlocked(byKey(key), c) }).toEqual({ key, unlocked: false });
    }
  });

  it('a summer daily does not unlock the snow board', () => {
    const c = buildCosmeticContext(source({ dailyChallengeProgress: { '2026-07-15': { completed: true, score: 300, stars: 3 } } }));
    expect(isCosmeticUnlocked(byKey('board:snow'), c)).toBe(false);
  });

  it('gives a cosmetic every 5 player levels up to 35', () => {
    for (const level of [5, 10, 15, 20, 25, 30, 35]) expect(getLevelCosmetics(level).length).toBeGreaterThan(0);
  });

  it('falls back to the default for a locked selection', () => {
    const c = buildCosmeticContext(source());
    expect(sanitizeSelection({ board: 'neon', skin: 'taxi', palette: 'classic', effect: 'confetti' }, c)).toEqual(DEFAULT_COSMETICS);
    expect(sanitizeSelection(undefined, c)).toEqual(DEFAULT_COSMETICS);
  });

  it('the store refuses a locked cosmetic and keeps an unlocked one', () => {
    resetStore();
    expect(state().selectCosmetic('skin', 'taxi')).toBe(false);
    expect(state().cosmetics.skin).toBe('classic');
    useGameStore.setState({ xp: totalXpForLevel(5) });
    expect(state().selectCosmetic('skin', 'taxi')).toBe(true);
    expect(state().cosmetics.skin).toBe('taxi');
  });

  it('a palette recolors the other vehicles in level order, never the target car', () => {
    const vehicles = sampleLevels[0].vehicles;
    expect([...applyPalette(vehicles, 'classic').values()]).toEqual(vehicles.filter(v => !v.isTarget).map(v => v.color));
    const ocean = applyPalette(vehicles, 'ocean');
    const target = vehicles.find(v => v.isTarget)!;
    expect(ocean.has(target.id)).toBe(false);
    expect([...ocean.values()][0]).toBe(VEHICLE_PALETTES.ocean![0]);
  });
});
