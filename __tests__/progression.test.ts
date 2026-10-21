import type { TFunction } from 'i18next';
import {
  ACHIEVEMENT_XP, BASE_FREEZE_SLOTS, BOSS_WIN_XP, MISSIONS_XP, REPLAY_XP_FACTOR, dailyWinXp, getFreezeCapacity, getLevelInfo,
  getPlayerLevel, getPlayerTitle, levelWinXp, totalXpForLevel, weeklyWinXp, xpToNextLevel,
} from '../data/progression';
import {
  COSMETICS, DEFAULT_COSMETICS, SEASONAL_EVENTS, buildCosmeticContext, newlyUnlockedCosmetics, cosmeticKey, getLevelCosmetics, isCosmeticUnlocked,
  lockedEventCosmetics, sanitizeSelection, seasonalEventOf, type CosmeticSource, type SeasonalEventId,
} from '../data/cosmetics';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { ACHIEVEMENTS_BY_ID } from '../data/achievements';
import { describeUnlock, describeUnlockShort } from '../components/garage/describeUnlock';
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

describe('store: new achievements', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setToday('2026-10-14');
    resetStore();
  });
  afterEach(() => jest.useRealTimers());

  it('an achievement unlocked stays new until it is touched in the profile', () => {
    winMapLevel(sampleLevels[0], { stars: 3 });
    expect(state().achievements).toContain('first_win');
    expect(state().seenAchievements).not.toContain('first_win');
    state().markAchievementSeen('first_win');
    state().markAchievementSeen('first_win');
    expect(state().seenAchievements).toEqual(['first_win']);
  });

  it('a cosmetic touched in the garage is no longer new, the others stay new', () => {
    state().markCosmeticsSeen(['effect:greenlight']);
    expect(state().seenCosmetics).toEqual(['effect:greenlight']);
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

  it('a cosmetic of a secret achievement hides its name until unlocked', () => {
    const t = ((key: string) => key) as never;
    const locked = buildCosmeticContext(source());
    expect(describeUnlock(t, byKey('skin:mafia'), locked)).toBe('cosmetics.unlock.secret');
    expect(describeUnlock(t, byKey('board:fire'), locked)).toBe('cosmetics.unlock.achievement');
    expect(describeUnlock(t, byKey('skin:mafia'), buildCosmeticContext(source({ achievements: ['mafia'] })))).toBe('cosmetics.unlock.achievement');
    expect(describeUnlockShort(t, byKey('skin:mafia'), locked)).toBe('cosmetics.unlock.secret');
    expect(describeUnlockShort(t, byKey('skin:mafia'), buildCosmeticContext(source({ achievements: ['mafia'] })))).toBe('achievements.mafia');
  });

  it('the green light effect unlocks after 3 map levels won, custom levels and challenges aside', () => {
    const won = (levelId: number) => ({ levelId, completed: true, bestScore: 100, stars: 1 });
    const greenlight = byKey('effect:greenlight');
    expect(isCosmeticUnlocked(greenlight, buildCosmeticContext(source({ progress: [won(1), won(2), won(1760000000000), won(999999)] })))).toBe(false);
    expect(isCosmeticUnlocked(greenlight, buildCosmeticContext(source({ progress: [won(1), won(2), won(3)] })))).toBe(true);
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

describe('win screen: cosmetics unlocked by the win', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setToday('2026-10-14');
    resetStore();
  });
  afterEach(() => jest.useRealTimers());

  it('lists the green light on the 3rd level won, nothing on the 2nd', () => {
    winMapLevel(sampleLevels[0]);
    const beforeSecond = state();
    winMapLevel(sampleLevels[1]);
    expect(newlyUnlockedCosmetics(beforeSecond, state())).toEqual([]);
    const beforeThird = state();
    winMapLevel(sampleLevels[2]);
    expect(newlyUnlockedCosmetics(beforeThird, state())).toContain('effect:greenlight');
  });
});

describe('seasonal events', () => {
  const won = { completed: true, score: 300, stars: 3 };
  const context = (dailyChallengeProgress: CosmeticSource['dailyChallengeProgress']) => buildCosmeticContext({
    xp: 0, progress: [], dailyChallengeProgress, weeklyChallengeProgress: {}, achievements: [],
  });
  const unlocked = (keys: string[], dailies: CosmeticSource['dailyChallengeProgress']) => {
    const c = context(dailies);
    return keys.filter(key => isCosmeticUnlocked(COSMETICS.find(d => cosmeticKey(d) === key)!, c));
  };
  const HALLOWEEN = ['board:pumpkin', 'effect:bats'];
  const CHRISTMAS = ['board:christmas', 'effect:gifts'];

  it('Halloween from October 25 to 31, Christmas from December 19 to 25, every year', () => {
    expect(['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01'].map(seasonalEventOf)).toEqual([null, 'halloween', 'halloween', null]);
    expect(['2026-12-18', '2026-12-19', '2026-12-25', '2026-12-26'].map(seasonalEventOf)).toEqual([null, 'christmas', 'christmas', null]);
    expect(seasonalEventOf('2031-10-28')).toBe('halloween');
    expect(seasonalEventOf('2027-07-14')).toBeNull();
  });

  it('a daily won during the event unlocks its board and its win effect, for good', () => {
    expect(unlocked([...HALLOWEEN, ...CHRISTMAS], { '2026-10-28': won })).toEqual(HALLOWEEN);
    expect(unlocked([...HALLOWEEN, ...CHRISTMAS], { '2026-12-25': won, '2027-03-01': won })).toEqual(CHRISTMAS);
    expect(unlocked([...HALLOWEEN, ...CHRISTMAS], { '2026-10-24': won, '2026-11-01': won, '2026-12-26': won })).toEqual([]);
    // Started but not won
    expect(unlocked(HALLOWEEN, { '2026-10-28': { completed: false, score: 0, stars: 0 } })).toEqual([]);
  });

  it('a Christmas daily also unlocks the winter board', () => {
    expect(unlocked(['board:snow'], { '2026-12-24': won })).toEqual(['board:snow']);
  });

  it('the home screen counts what is left to unlock', () => {
    expect(lockedEventCosmetics('halloween', context({})).map(cosmeticKey)).toEqual(HALLOWEEN);
    expect(lockedEventCosmetics('halloween', context({ '2025-10-31': won }))).toEqual([]);
    expect(lockedEventCosmetics('christmas', context({ '2025-10-31': won })).map(cosmeticKey)).toEqual(CHRISTMAS);
  });

  it('each event has its texts and cosmetics, each cosmetic its name', () => {
    const lookup = (strings: unknown, key: string) => key.split('.').reduce<unknown>(
      (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), strings);
    for (const strings of [en, fr]) {
      for (const event of Object.keys(SEASONAL_EVENTS) as SeasonalEventId[]) {
        expect(COSMETICS.some(def => def.unlock.type === 'event' && def.unlock.event === event)).toBe(true);
        for (const key of [`cosmetics.unlock.event.${event}`, `cosmetics.unlock_short.event.${event}`, `home.daily_event.${event}_one`, `home.daily_event.${event}_other`]) {
          expect({ key, text: typeof lookup(strings, key) }).toEqual({ key, text: 'string' });
        }
      }
      for (const def of COSMETICS) {
        const key = `cosmetics.${def.kind}.${def.id}`;
        expect({ key, text: typeof lookup(strings, key) }).toEqual({ key, text: 'string' });
      }
    }
  });

  it('describes the unlock with the days of the event', () => {
    const t = ((key: string) => key) as never;
    const pumpkin = COSMETICS.find(d => cosmeticKey(d) === 'board:pumpkin')!;
    expect(describeUnlock(t, pumpkin, context({}))).toBe('cosmetics.unlock.event.halloween');
    expect(describeUnlockShort(t, pumpkin, context({}))).toBe('cosmetics.unlock_short.event.halloween');
  });

  describe('in the store', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      resetStore();
    });
    afterEach(() => jest.useRealTimers());

    it('the win screen lists them on the daily of the event', () => {
      winDaily('2026-10-27');
      const before = state();
      winDaily('2026-10-28');
      expect(newlyUnlockedCosmetics(before, state())).toEqual([]);
      resetStore();
      winDaily('2026-10-24');
      const beforeEvent = state();
      winDaily('2026-10-25');
      expect(newlyUnlockedCosmetics(beforeEvent, state())).toEqual(HALLOWEEN);
    });

    it('an archive of an event day, won later, unlocks nothing', () => {
      setToday('2026-11-03');
      state().completeArchiveChallenge('2026-10-28', 300, 3, 30_000, { moves: 12, minMoves: 12 });
      expect(state().archiveProgress['2026-10-28']?.completed).toBe(true);
      expect(unlocked(HALLOWEEN, state().dailyChallengeProgress)).toEqual([]);
    });
  });
});

describe('garage: short unlock conditions', () => {
  const t = ((key: string, options?: Record<string, unknown>) => `${key}${options ? JSON.stringify(options) : ''}`) as unknown as TFunction;
  const context = buildCosmeticContext({
    xp: 0, progress: [{ levelId: 1, completed: true, bestScore: 300, stars: 3 }],
    dailyChallengeProgress: {}, weeklyChallengeProgress: {}, achievements: [],
  });

  it('stay short, the progress capped at the target', () => {
    expect(describeUnlockShort(t, COSMETICS.find(c => c.id === 'confetti')!, context)).toBe('★ 3/100');
    expect(describeUnlockShort(t, COSMETICS.find(c => c.id === 'greenlight')!, context))
      .toBe('cosmetics.unlock_short.levels{"count":3,"current":1}');
    // An achievement comes with what it asks
    expect(describeUnlockShort(t, COSMETICS.find(c => c.id === 'tractor')!, context)).toBe('achievements.zone_perfect_1 : achievements.zone_perfect_1_desc');
  });
});
