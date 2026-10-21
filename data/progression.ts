import type { ChallengeResult, Level, LevelProgress } from '../store/types';

/**
 * Player level and XP: see docs/GAME_DESIGN.md (Niveau joueur et XP).
 * Every win gives XP, the curve is steep: the first levels come in a few days,
 * level 10 takes about a month and a half of daily play, level 20 about a year.
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

export const dailyWinXp = (stars: number): number => 60 + 20 * stars;
export const weeklyWinXp = (stars: number): number => 150 + 50 * stars;
/** A past daily replayed from the archives: XP of a replayed level, so years of archives can't be farmed */
export const archiveWinXp = (minMoves: number, stars: number): number => levelWinXp(minMoves, stars, false);
/** All 3 missions of the day done */
export const MISSIONS_XP = 100;
/** Extra XP for the 3 missions when the freeze stock is full: the freeze that can't be given */
export const MISSIONS_FULL_STOCK_XP = 50;
/** XP of the 3 missions of the day, depending on whether their freeze could be given */
export const missionsXp = (freezeGranted: boolean): number => MISSIONS_XP + (freezeGranted ? 0 : MISSIONS_FULL_STOCK_XP);
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
  xp += (state.stats?.missionDaysCompleted ?? 0) * MISSIONS_XP;
  xp += (state.achievements?.length ?? 0) * ACHIEVEMENT_XP;
  return xp;
}
