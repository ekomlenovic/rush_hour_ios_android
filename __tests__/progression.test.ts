import type { TFunction } from 'i18next';
import {
  ACHIEVEMENT_XP, BASE_FREEZE_SLOTS, BOSS_WIN_XP, MAX_XP_MULTIPLIER, MISSIONS_FULL_STOCK_XP, MISSIONS_XP, REPLAY_XP_FACTOR, XP_BONUS_TIERS,
  bonusPercent, dailyWinXp, missionsXp, nextBonusTier, xpMultiplier, getFreezeCapacity, getLevelInfo,
  getPlayerLevel, getPlayerTitle, levelWinXp, totalXpForLevel, weeklyWinXp, xpToNextLevel,
} from '../data/progression';
import {
  COSMETICS, DEFAULT_COSMETICS, SEASONAL_EVENTS, isInEventDays, buildCosmeticContext, newlyUnlockedCosmetics, cosmeticKey, getLevelCosmetics, isCosmeticUnlocked,
  lockedEventCosmetics, sanitizeSelection, seasonalEventOf, seasonalEventsOf, type CosmeticSource, SEASONAL_EVENT_IDS, westernEaster, orthodoxEaster, movableEventDays,
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

  /** Days to reach a player level: 5 new 3-star levels of 15 moves a day, and maybe the daily (3 stars) and the 3 missions */
  const daysToLevel = (level: number, everyDay: boolean) => {
    let xp = 0;
    let day = 0;
    while (xp < totalXpForLevel(level)) {
      day++;
      const levels = 5 * levelWinXp(15, 3, true);
      // Both streaks are as long as the days played: they multiply all the XP of the day
      xp += everyDay ? Math.round((levels + dailyWinXp(3) + missionsXp(true)) * xpMultiplier(day, day)) : levels;
    }
    return day;
  };

  it('is not easy: without the daily and the missions, level 20 is nearly two years of levels', () => {
    expect(daysToLevel(20, false)).toBeGreaterThan(600);
    expect(daysToLevel(5, false)).toBeLessThan(20);
  });

  it('rewards coming back every day: about three weeks for level 10, three to four months for level 20', () => {
    expect(daysToLevel(10, true)).toBeGreaterThan(15);
    expect(daysToLevel(10, true)).toBeLessThan(35);
    expect(daysToLevel(20, true)).toBeGreaterThan(80);
    expect(daysToLevel(20, true)).toBeLessThan(130);
    // The last tiers stay a long way: over a year of days in a row for level 40
    expect(daysToLevel(40, true)).toBeGreaterThan(365);
  });

  it('each bonus adds 5 % a day in a row the first week, then +60 % at 30 days and +100 % at 60', () => {
    expect([0, 1, 2, 3, 6, 7, 8, 29, 30, 59, 60, 400].map(bonusPercent)).toEqual([0, 0, 5, 10, 25, 30, 30, 30, 60, 60, 100, 100]);
    for (let i = 1; i < XP_BONUS_TIERS.length; i++) expect(XP_BONUS_TIERS[i].percent).toBeGreaterThan(XP_BONUS_TIERS[i - 1].percent);
  });

  it('the two bonuses add up into what all the XP is multiplied by', () => {
    expect(xpMultiplier(0, 0)).toBe(1);
    expect(xpMultiplier(7, 0)).toBe(1.3);
    expect(xpMultiplier(7, 30)).toBe(1.9);
    expect(xpMultiplier(60, 60)).toBe(3);
    expect(MAX_XP_MULTIPLIER).toBe(xpMultiplier(5000, 5000));
  });

  it('tells the next tier of a bonus, none once at the top', () => {
    expect(nextBonusTier(0)).toEqual({ days: 2, percent: 5 });
    expect(nextBonusTier(3)).toEqual({ days: 4, percent: 15 });
    expect(nextBonusTier(7)).toEqual({ days: 30, percent: 60 });
    expect(nextBonusTier(45)).toEqual({ days: 60, percent: 100 });
    expect(nextBonusTier(60)).toBeNull();
  });

  it('the 3 missions give 200 XP, 50 more when their freeze cannot be given', () => {
    expect(missionsXp(true)).toBe(MISSIONS_XP);
    expect(missionsXp(false)).toBe(MISSIONS_XP + MISSIONS_FULL_STOCK_XP);
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
  const HALLOWEEN = ['board:pumpkin', 'skin:coach', 'palette:haunted', 'effect:bats'];
  const CHRISTMAS = ['board:christmas', 'skin:sleigh', 'palette:festive', 'effect:gifts'];

  it('Halloween from October 25 to 31, Christmas from December 19 to 25, every year', () => {
    expect(['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01'].map(seasonalEventOf)).toEqual([null, 'halloween', 'halloween', null]);
    expect(['2026-12-18', '2026-12-19', '2026-12-25', '2026-12-26'].map(seasonalEventOf)).toEqual([null, 'christmas', 'christmas', null]);
    expect(seasonalEventOf('2031-10-28')).toBe('halloween');
    expect(seasonalEventOf('2027-05-20')).toBeNull();
  });

  it('New Year from December 31 to January 3, Valentine from February 10 to 14, Saint Patrick from March 15 to 17', () => {
    expect(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-03', '2027-01-04'].map(seasonalEventOf)).toEqual([null, 'newyear', 'newyear', 'newyear', null]);
    expect(['2027-02-09', '2027-02-10', '2027-02-14', '2027-02-15'].map(seasonalEventOf)).toEqual([null, 'valentine', 'valentine', null]);
    expect(['2027-03-14', '2027-03-15', '2027-03-17', '2027-03-18'].map(seasonalEventOf)).toEqual([null, 'stpatrick', 'stpatrick', null]);
  });

  it('a New Year, Valentine or Saint Patrick daily unlocks the four styles of its event', () => {
    const NEW_YEAR = ['board:newyear', 'skin:limo', 'palette:party', 'effect:champagne'];
    const VALENTINE = ['board:valentine', 'skin:wedding', 'palette:lovers', 'effect:hearts'];
    const ST_PATRICK = ['board:shamrock', 'skin:leprechaun', 'palette:emerald', 'effect:clovers'];
    const all = [...NEW_YEAR, ...VALENTINE, ...ST_PATRICK];
    expect(unlocked(all, { '2027-01-02': won })).toEqual(NEW_YEAR);
    expect(unlocked(all, { '2027-02-14': won })).toEqual(VALENTINE);
    expect(unlocked(all, { '2027-03-17': won })).toEqual(ST_PATRICK);
    expect(lockedEventCosmetics('newyear', context({})).map(cosmeticKey)).toEqual(NEW_YEAR);
    // New Year's Eve is in winter too
    expect(unlocked(['board:snow'], { '2026-12-31': won })).toEqual(['board:snow']);
  });

  it("April Fools' Day from March 29 to April 2, Fête de la musique from June 18 to 24", () => {
    expect(['2027-03-28', '2027-03-29', '2027-04-01', '2027-04-02', '2027-04-03'].map(d => seasonalEventsOf(d).includes('aprilfools'))).toEqual([false, true, true, true, false]);
    expect(['2027-06-17', '2027-06-18', '2027-06-21', '2027-06-24', '2027-06-25'].map(seasonalEventOf)).toEqual([null, 'musicday', 'musicday', 'musicday', null]);
  });

  it('Easter moves every year: from Holy Thursday to Easter Monday, Catholic and Orthodox', () => {
    // Known dates of Easter Sunday, Western then Orthodox
    expect(westernEaster(2024)).toEqual([3, 31]);
    expect(westernEaster(2025)).toEqual([4, 20]);
    expect(westernEaster(2026)).toEqual([4, 5]);
    expect(westernEaster(2027)).toEqual([3, 28]);
    expect(westernEaster(2038)).toEqual([4, 25]);
    expect(westernEaster(2285)).toEqual([3, 22]);
    expect(orthodoxEaster(2024)).toEqual([5, 5]);
    expect(orthodoxEaster(2025)).toEqual([4, 20]);
    expect(orthodoxEaster(2026)).toEqual([4, 12]);
    expect(orthodoxEaster(2027)).toEqual([5, 2]);
    expect(movableEventDays('easter', 2026)).toEqual([{ from: '04-02', to: '04-06' }, { from: '04-09', to: '04-13' }]);
    // 2026: Catholic Easter on April 5, Orthodox Easter on April 12
    expect(['2026-04-01', '2026-04-02', '2026-04-06', '2026-04-07', '2026-04-09', '2026-04-13', '2026-04-14'].map(d => seasonalEventsOf(d).includes('easter')))
      .toEqual([false, true, true, false, true, true, false]);
    // Easter Monday 2027 is March 29: April Fools' Day too, a daily that day counts for both
    expect(seasonalEventsOf('2027-03-29')).toEqual(['aprilfools', 'easter']);
    expect(seasonalEventsOf('2027-03-25')).toEqual(['easter']);
  });

  it("an April Fools', Easter or Fête de la musique daily unlocks the four styles of its event", () => {
    const APRIL = ['board:aprilfish', 'skin:goldfish', 'palette:prank', 'effect:paperfish'];
    const EASTER = ['board:easter', 'skin:bunny', 'palette:eggs', 'effect:eggs'];
    const MUSIC = ['board:music', 'skin:guitar', 'palette:concert', 'effect:notes'];
    const all = [...APRIL, ...EASTER, ...MUSIC];
    expect(unlocked(all, { '2027-04-01': won })).toEqual(APRIL);
    expect(unlocked(all, { '2027-05-01': won })).toEqual(EASTER);
    expect(unlocked(all, { '2027-06-21': won })).toEqual(MUSIC);
    expect(unlocked(all, { '2027-03-29': won })).toEqual([...APRIL, ...EASTER]);
  });

  it('Bastille Day from July 10 to 14, the summer getaway from August 1 to 15, back to school from September 1 to 7', () => {
    expect(['2027-07-09', '2027-07-10', '2027-07-14', '2027-07-15'].map(seasonalEventOf)).toEqual([null, 'bastille', 'bastille', null]);
    expect(['2027-07-31', '2027-08-01', '2027-08-15', '2027-08-16'].map(seasonalEventOf)).toEqual([null, 'summer', 'summer', null]);
    expect(['2027-08-31', '2027-09-01', '2027-09-07', '2027-09-08'].map(seasonalEventOf)).toEqual([null, 'backtoschool', 'backtoschool', null]);
  });

  it('a Bastille Day, summer getaway or back to school daily unlocks the four styles of its event', () => {
    const BASTILLE = ['board:bastille', 'skin:firetruck', 'palette:tricolor', 'effect:jets'];
    const SUMMER = ['board:holiday', 'skin:camper', 'palette:roadtrip', 'effect:flipflops'];
    const SCHOOL = ['board:notebook', 'skin:pencil', 'palette:school', 'effect:planes'];
    const all = [...BASTILLE, ...SUMMER, ...SCHOOL];
    expect(unlocked(all, { '2027-07-14': won })).toEqual(BASTILLE);
    expect(unlocked(all, { '2027-08-08': won })).toEqual(SUMMER);
    expect(unlocked(all, { '2027-09-02': won })).toEqual(SCHOOL);
  });

  it('gives every event of a day', () => {
    expect(seasonalEventsOf('2026-10-31')).toEqual(['halloween']);
    expect(seasonalEventsOf('2026-12-20')).toEqual(['christmas']);
    expect(seasonalEventsOf('2026-03-03')).toEqual([]);
  });

  it('an event can go over the new year', () => {
    const newYear = { from: '12-31', to: '01-03' };
    expect(['12-30', '12-31', '01-01', '01-03', '01-04'].map(day => isInEventDays(newYear, day))).toEqual([false, true, true, true, false]);
    expect(['10-24', '10-25', '10-31', '11-01'].map(day => isInEventDays(SEASONAL_EVENTS.halloween, day))).toEqual([false, true, true, false]);
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
      for (const event of SEASONAL_EVENT_IDS) {
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
