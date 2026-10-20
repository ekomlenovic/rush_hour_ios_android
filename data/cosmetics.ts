import type { BoardThemeId, CarSkinId, VehiclePaletteId } from '../theme/board';
import type { ChallengeResult, LevelProgress } from '../store/types';
import { getPlayerLevel } from './progression';

/**
 * Cosmetics: board themes, target car skins, vehicle palettes and win effects (#7).
 * Unlocked by playing only, never bought (see docs/GAME_DESIGN.md, Cosmétiques).
 * Ids are persisted in the selection: never rename one, only add.
 */

export type CosmeticKind = 'board' | 'skin' | 'palette' | 'effect';
export type WinEffectId = 'none' | 'confetti' | 'fireworks' | 'speed' | 'bubbles' | 'greenlight' | 'tommy' | 'broadside';

export interface CosmeticSelection {
  board: BoardThemeId;
  skin: CarSkinId;
  palette: VehiclePaletteId;
  effect: WinEffectId;
}

export const DEFAULT_COSMETICS: CosmeticSelection = {
  board: 'classic',
  skin: 'classic',
  palette: 'classic',
  effect: 'none',
};

export type UnlockRule =
  | { type: 'default' }
  | { type: 'level'; level: number }
  | { type: 'stars'; count: number }
  /** Levels of the map won (campaign and generated) */
  | { type: 'levels'; count: number }
  | { type: 'weeklies'; count: number }
  | { type: 'achievement'; id: string }
  /** A daily challenge won in December, January or February */
  | { type: 'winter' };

export interface CosmeticDef {
  kind: CosmeticKind;
  /** Id inside its kind; i18n key cosmetics.<kind>.<id> */
  id: string;
  icon: string;
  unlock: UnlockRule;
}

export const COSMETICS: CosmeticDef[] = [
  // Board themes
  { kind: 'board', id: 'classic', icon: '🛣️', unlock: { type: 'default' } },
  { kind: 'board', id: 'paper', icon: '📝', unlock: { type: 'stars', count: 50 } },
  { kind: 'board', id: 'wood', icon: '🪵', unlock: { type: 'stars', count: 150 } },
  { kind: 'board', id: 'neon', icon: '🌃', unlock: { type: 'level', level: 10 } },
  { kind: 'board', id: 'pixel', icon: '👾', unlock: { type: 'stars', count: 500 } },
  { kind: 'board', id: 'snow', icon: '❄️', unlock: { type: 'winter' } },
  { kind: 'board', id: 'fire', icon: '🔥', unlock: { type: 'achievement', id: 'streak_30' } },
  { kind: 'board', id: 'beach', icon: '🏖️', unlock: { type: 'stars', count: 1200 } },
  { kind: 'board', id: 'space', icon: '🌌', unlock: { type: 'achievement', id: 'zone_perfect_10' } },

  // Target car skins
  { kind: 'skin', id: 'classic', icon: '🚗', unlock: { type: 'default' } },
  { kind: 'skin', id: 'taxi', icon: '🚕', unlock: { type: 'level', level: 5 } },
  { kind: 'skin', id: 'bus', icon: '🚌', unlock: { type: 'weeklies', count: 1 } },
  { kind: 'skin', id: 'police', icon: '🚓', unlock: { type: 'weeklies', count: 20 } },
  { kind: 'skin', id: 'rocket', icon: '🚀', unlock: { type: 'level', level: 25 } },
  { kind: 'skin', id: 'sport', icon: '🏎️', unlock: { type: 'level', level: 35 } },
  { kind: 'skin', id: 'gold', icon: '👑', unlock: { type: 'stars', count: 800 } },
  { kind: 'skin', id: 'tractor', icon: '🚜', unlock: { type: 'achievement', id: 'zone_perfect_1' } },
  { kind: 'skin', id: 'ufo', icon: '🛸', unlock: { type: 'stars', count: 2000 } },
  { kind: 'skin', id: 'mafia', icon: '🎩', unlock: { type: 'achievement', id: 'mafia' } },
  { kind: 'skin', id: 'flagship', icon: '⛵', unlock: { type: 'weeklies', count: 30 } },

  // Vehicle palettes
  { kind: 'palette', id: 'classic', icon: '🎨', unlock: { type: 'default' } },
  { kind: 'palette', id: 'ocean', icon: '🌊', unlock: { type: 'level', level: 15 } },
  { kind: 'palette', id: 'pastel', icon: '🧁', unlock: { type: 'stars', count: 300 } },
  { kind: 'palette', id: 'earth', icon: '🍂', unlock: { type: 'weeklies', count: 5 } },
  { kind: 'palette', id: 'neon', icon: '💡', unlock: { type: 'level', level: 30 } },
  { kind: 'palette', id: 'candy', icon: '🍬', unlock: { type: 'achievement', id: 'daily_100' } },
  { kind: 'palette', id: 'lava', icon: '🌋', unlock: { type: 'achievement', id: 'optimal_hard_50' } },
  { kind: 'palette', id: 'jungle', icon: '🌴', unlock: { type: 'stars', count: 1600 } },
  { kind: 'palette', id: 'mafia', icon: '🎩', unlock: { type: 'achievement', id: 'mafia' } },
  { kind: 'palette', id: 'fleet', icon: '🚢', unlock: { type: 'weeklies', count: 30 } },

  // Win effects
  { kind: 'effect', id: 'none', icon: '⏹️', unlock: { type: 'default' } },
  { kind: 'effect', id: 'greenlight', icon: '🚦', unlock: { type: 'levels', count: 3 } },
  { kind: 'effect', id: 'confetti', icon: '🎊', unlock: { type: 'stars', count: 100 } },
  { kind: 'effect', id: 'fireworks', icon: '🎆', unlock: { type: 'level', level: 20 } },
  { kind: 'effect', id: 'speed', icon: '💨', unlock: { type: 'weeklies', count: 10 } },
  { kind: 'effect', id: 'bubbles', icon: '💧', unlock: { type: 'achievement', id: 'perfect_250' } },
  { kind: 'effect', id: 'tommy', icon: '💥', unlock: { type: 'achievement', id: 'mafia' } },
  { kind: 'effect', id: 'broadside', icon: '⚓', unlock: { type: 'weeklies', count: 30 } },
];

export const cosmeticKey = (def: Pick<CosmeticDef, 'kind' | 'id'>): string => `${def.kind}:${def.id}`;

export const COSMETICS_BY_KEY: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map(c => [cosmeticKey(c), c]));

/** Store fields the unlocks are computed from */
export interface CosmeticSource {
  xp: number;
  progress: LevelProgress[];
  dailyChallengeProgress: Record<string, ChallengeResult>;
  weeklyChallengeProgress: Record<string, ChallengeResult>;
  achievements: string[];
}

export interface CosmeticContext {
  playerLevel: number;
  totalStars: number;
  levelsWon: number;
  weeklies: number;
  achievements: Set<string>;
  winterDaily: boolean;
}

const WINTER_MONTHS = ['12', '01', '02'];
/** Ids from this one up are challenges or custom levels (timestamps), not levels of the map */
const MAP_ID_END = 900000;

export function buildCosmeticContext(s: CosmeticSource): CosmeticContext {
  const dailyKeys = Object.entries(s.dailyChallengeProgress).filter(([, r]) => r?.completed).map(([k]) => k);
  return {
    playerLevel: getPlayerLevel(s.xp),
    totalStars: s.progress.reduce((sum, p) => sum + (p.completed ? p.stars || 0 : 0), 0),
    levelsWon: s.progress.filter(p => p.completed && p.levelId < MAP_ID_END).length,
    weeklies: Object.values(s.weeklyChallengeProgress).filter(r => r?.completed).length,
    achievements: new Set(s.achievements),
    // Date keys are local YYYY-MM-DD: the month is read from the key, never with new Date()
    winterDaily: dailyKeys.some(k => WINTER_MONTHS.includes(k.slice(5, 7))),
  };
}

export function isCosmeticUnlocked(def: CosmeticDef, c: CosmeticContext): boolean {
  const rule = def.unlock;
  switch (rule.type) {
    case 'default': return true;
    case 'level': return c.playerLevel >= rule.level;
    case 'stars': return c.totalStars >= rule.count;
    case 'levels': return c.levelsWon >= rule.count;
    case 'weeklies': return c.weeklies >= rule.count;
    case 'achievement': return c.achievements.has(rule.id);
    case 'winter': return c.winterDaily;
  }
}

/** Progress toward an unlock, 0 to 1 (for the garage) */
export function unlockProgress(def: CosmeticDef, c: CosmeticContext): number {
  const rule = def.unlock;
  switch (rule.type) {
    case 'level': return Math.min(1, c.playerLevel / rule.level);
    case 'stars': return Math.min(1, c.totalStars / rule.count);
    case 'levels': return Math.min(1, c.levelsWon / rule.count);
    case 'weeklies': return Math.min(1, c.weeklies / rule.count);
    default: return isCosmeticUnlocked(def, c) ? 1 : 0;
  }
}

export function getUnlockedCosmetics(c: CosmeticContext): string[] {
  return COSMETICS.filter(def => isCosmeticUnlocked(def, c)).map(cosmeticKey);
}

/** Cosmetics unlocked between two states of the progress, e.g. by a win ('kind:id', in garage order) */
export function newlyUnlockedCosmetics(before: CosmeticSource, after: CosmeticSource): string[] {
  const known = new Set(getUnlockedCosmetics(buildCosmeticContext(before)));
  return getUnlockedCosmetics(buildCosmeticContext(after)).filter(key => !known.has(key));
}

/** Cosmetics given as the reward of reaching a player level */
export function getLevelCosmetics(level: number): CosmeticDef[] {
  return COSMETICS.filter(def => def.unlock.type === 'level' && def.unlock.level === level);
}

/** The selection with every locked item replaced by its default (e.g. after a hard reset) */
export function sanitizeSelection(selection: Partial<CosmeticSelection> | undefined, c: CosmeticContext): CosmeticSelection {
  const result = { ...DEFAULT_COSMETICS };
  for (const kind of Object.keys(DEFAULT_COSMETICS) as CosmeticKind[]) {
    const id = selection?.[kind];
    const def = id ? COSMETICS_BY_KEY[`${kind}:${id}`] : undefined;
    if (def && isCosmeticUnlocked(def, c)) (result as Record<CosmeticKind, string>)[kind] = def.id;
  }
  return result;
}
