import type { ChallengeResult, Level, LevelProgress } from '../store/types';

/**
 * Player level and XP: see docs/GAME_DESIGN.md (Niveau joueur et XP).
 * Every win gives XP, the curve is steep: the first levels come in a few days. The daily missions
 * done day after day are the fast lane: level 10 in about three weeks, level 20 in about three months.
 */

/** XP needed to go from `level` to `level + 1` */
export function xpToNextLevel(level: number): number {
  return Math.round(150 * Math.pow(level, 1.6));
}

/** Total XP needed to reach `level` (level 1 = 0 XP) */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpToNextLevel(n);
  return total;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level */
  xpInLevel: number;
  /** XP needed to reach the next level */
  xpForNext: number;
  /** 0 to 1 */
  ratio: number;
}

export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level++;
  }
  const xpForNext = xpToNextLevel(level);
  return { level, xpInLevel: remaining, xpForNext, ratio: remaining / xpForNext };
}

export const getPlayerLevel = (xp: number): number => getLevelInfo(xp).level;

/** Title by tier, i18n key progression.titles.<id> */
export const PLAYER_TITLES: { minLevel: number; id: string }[] = [
  { minLevel: 1, id: 'apprentice' },
  { minLevel: 5, id: 'driver' },
  { minLevel: 10, id: 'pilot' },
  { minLevel: 15, id: 'navigator' },
  { minLevel: 20, id: 'road_expert' },
  { minLevel: 30, id: 'traffic_master' },
  { minLevel: 40, id: 'legend' },
];

export function getPlayerTitle(level: number): string {
  let title = PLAYER_TITLES[0].id;
  for (const tier of PLAYER_TITLES) if (level >= tier.minLevel) title = tier.id;
  return title;
}

// ─── XP rewards ───────────────────────────────────────────────────────────────

const STAR_FACTOR: Record<number, number> = { 1: 0.5, 2: 0.75, 3: 1 };
/** A level already won gives this share of its XP: replaying still progresses, without farming */
export const REPLAY_XP_FACTOR = 0.25;

/** XP of a map or custom level win: harder levels and more stars give more */
export function levelWinXp(minMoves: number, stars: number, firstWin: boolean): number {
  const base = 10 + 2 * Math.min(Math.max(minMoves, 1), 60);
  const xp = base * (STAR_FACTOR[stars] ?? STAR_FACTOR[1]) * (firstWin ? 1 : REPLAY_XP_FACTOR);
  return Math.max(1, Math.round(xp));
}

/** Extra XP for the first win of a boss level of the map (data/bosses.ts) */
export const BOSS_WIN_XP = 50;

/** A multiplier reached at a number of days in a row */
export interface BonusTier {
  days: number;
  multiplier: number;
}

/** Days shown as milestones of a bonus: the end of the first week, then the two big steps */
export const BONUS_MILESTONE_DAYS = [7, 30, 60];

/** The first week of a bonus grows by `step` a day from ×1, then a big step at 30 days and another at 60 */
const bonusTiers = (step: number, at30: number, at60: number): BonusTier[] => [
  ...Array.from({ length: 7 }, (_, i) => ({ days: i + 1, multiplier: Math.round((1 + step * i) * 100) / 100 })),
  { days: 30, multiplier: at30 },
  { days: 60, multiplier: at60 },
];

/** Daily challenge XP by streak: ×1,6 after a week, ×2 at 30 days, ×3 at 60 */
export const DAILY_STREAK_TIERS = bonusTiers(0.1, 2, 3);
/** Missions XP by mission streak: ×2,5 after a week, ×4 at 30 days, ×5 at 60 */
export const MISSION_STREAK_TIERS = bonusTiers(0.25, 4, 5);

/** Multiplier of the last tier reached (×1 before the first) */
export function bonusMultiplier(tiers: BonusTier[], days: number): number {
  let multiplier = 1;
  for (const tier of tiers) if ((days || 0) >= tier.days) multiplier = tier.multiplier;
  return multiplier;
}

/** The next tier that raises the multiplier, if any is left */
export const nextBonusTier = (tiers: BonusTier[], days: number): BonusTier | null => tiers.find(tier => tier.days > (days || 0)) ?? null;

/** Highest multiplier of the daily challenge XP */
export const STREAK_MAX_MULTIPLIER = DAILY_STREAK_TIERS[DAILY_STREAK_TIERS.length - 1].multiplier;

/** Multiplier of the daily challenge XP at this streak (the day just won included) */
export const streakMultiplier = (streak: number): number => bonusMultiplier(DAILY_STREAK_TIERS, streak);

/** XP of the daily challenge, multiplied by the streak it was won at (none for the saves from before the bonus) */
export const dailyWinXp = (stars: number, streak = 0): number => Math.round((60 + 20 * stars) * streakMultiplier(streak));
export const weeklyWinXp = (stars: number): number => 150 + 50 * stars;
/** A past daily replayed from the archives: XP of a replayed level, so years of archives can't be farmed */
export const archiveWinXp = (minMoves: number, stars: number): number => levelWinXp(minMoves, stars, false);
/** All 3 missions of the day done, on the first day of a mission streak */
export const MISSIONS_XP = 200;
/** What the 3 missions gave before the mission streak (store v14): the XP credited by the older migrations */
export const LEGACY_MISSIONS_XP = 100;
/** Highest multiplier of the missions XP */
export const MISSIONS_MAX_MULTIPLIER = MISSION_STREAK_TIERS[MISSION_STREAK_TIERS.length - 1].multiplier;
/** Extra XP for the 3 missions when the freeze stock is full: the freeze that can't be given */
export const MISSIONS_FULL_STOCK_XP = 50;

/** Multiplier of the missions XP on the `streakDays`-th day in a row (1 = first day) */
export const missionsMultiplier = (streakDays: number): number => bonusMultiplier(MISSION_STREAK_TIERS, streakDays);

/**
 * XP of the 3 missions of the day: multiplied by the mission streak (this day included),
 * plus a fixed bonus when their freeze could not be given
 */
export const missionsXp = (freezeGranted: boolean, streakDays = 1): number =>
  Math.round(MISSIONS_XP * missionsMultiplier(streakDays)) + (freezeGranted ? 0 : MISSIONS_FULL_STOCK_XP);
/** Most XP a day of missions can give */
export const MAX_MISSIONS_XP = MISSIONS_XP * MISSIONS_MAX_MULTIPLIER + MISSIONS_FULL_STOCK_XP;
export const ACHIEVEMENT_XP = 50;

// ─── Level-up rewards ─────────────────────────────────────────────────────────

/** Freeze slots before any level reward */
export const BASE_FREEZE_SLOTS = 2;
/** Each of these player levels adds one freeze slot */
export const FREEZE_SLOT_LEVELS = [5, 10, 20, 30];

/** How many streak freezes can be kept in stock at this player level */
export function getFreezeCapacity(level: number): number {
  return BASE_FREEZE_SLOTS + FREEZE_SLOT_LEVELS.filter(l => level >= l).length;
}

export interface LevelUpReward {
  level: number;
  /** A freeze slot is added at this level */
  freezeSlot: boolean;
}

export function getLevelUpReward(level: number): LevelUpReward {
  return { level, freezeSlot: FREEZE_SLOT_LEVELS.includes(level) };
}

// ─── Retroactive XP (store migration) ─────────────────────────────────────────

export interface XpSource {
  progress?: LevelProgress[];
  dailyChallengeProgress?: Record<string, ChallengeResult>;
  weeklyChallengeProgress?: Record<string, ChallengeResult>;
  achievements?: string[];
  stats?: { missionDaysCompleted?: number };
}

/** XP of the progress made before XP existed: each won level, challenge, mission day and achievement once */
export function computeRetroactiveXp(state: XpSource, levels: Pick<Level, 'id' | 'minMoves'>[]): number {
  const minMovesById = new Map(levels.map(l => [l.id, l.minMoves]));
  let xp = 0;
  for (const p of state.progress ?? []) {
    if (!p.completed) continue;
    xp += levelWinXp(minMovesById.get(p.levelId) ?? 10, p.stars || 1, true);
  }
  for (const r of Object.values(state.dailyChallengeProgress ?? {})) {
    if (r?.completed) xp += dailyWinXp(r.stars || 1);
  }
  for (const r of Object.values(state.weeklyChallengeProgress ?? {})) {
    if (r?.completed) xp += weeklyWinXp(r.stars || 1);
  }
  xp += (state.stats?.missionDaysCompleted ?? 0) * LEGACY_MISSIONS_XP;
  xp += (state.achievements?.length ?? 0) * ACHIEVEMENT_XP;
  return xp;
}
