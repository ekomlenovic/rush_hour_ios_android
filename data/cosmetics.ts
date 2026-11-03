import type { BoardThemeId, CarSkinId, VehiclePaletteId } from '../theme/board';
import type { ChallengeResult, LevelProgress } from '../store/types';
import { getPlayerLevel } from './progression';

/**
 * Cosmetics: board themes, target car skins, vehicle palettes and win effects (#7).
 * Unlocked by playing only, never bought (see docs/GAME_DESIGN.md, Cosmétiques).
 * Ids are persisted in the selection: never rename one, only add.
 */

export type CosmeticKind = 'board' | 'skin' | 'palette' | 'effect';
export type WinEffectId = 'none' | 'confetti' | 'fireworks' | 'speed' | 'bubbles' | 'greenlight' | 'tommy' | 'broadside' | 'bats' | 'gifts' | 'champagne' | 'hearts' | 'clovers'
  | 'paperfish' | 'eggs' | 'notes';

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
  | { type: 'winter' }
  /** A daily challenge won during a seasonal event (SEASONAL_EVENTS) */
  | { type: 'event'; event: SeasonalEventId };

/** Seasonal events, persisted nowhere: computed from the dates of the daily challenges won */
export type SeasonalEventId = FixedEventId | MovableEventId;
/** Events on the same days every year */
export type FixedEventId = 'halloween' | 'christmas' | 'newyear' | 'valentine' | 'stpatrick' | 'aprilfools' | 'musicday';
/** Events whose days change every year, computed (Easter) */
export type MovableEventId = 'easter';

/**
 * Days of each fixed event, MM-DD, both included, every year. A `to` before its `from` goes over the new year
 * (December 31st to January 3rd). Events may share days: a daily won on such a day counts for each of them
 */
export const SEASONAL_EVENTS: Record<FixedEventId, { from: string; to: string }> = {
  halloween: { from: '10-25', to: '10-31' },
  christmas: { from: '12-19', to: '12-25' },
  newyear: { from: '12-31', to: '01-03' },
  valentine: { from: '02-10', to: '02-14' },
  stpatrick: { from: '03-15', to: '03-17' },
  aprilfools: { from: '03-29', to: '04-02' },
  musicday: { from: '06-18', to: '06-24' },
};

/** Every event, fixed then movable: the order of the home screen when a day has several */
export const SEASONAL_EVENT_IDS: SeasonalEventId[] = [...(Object.keys(SEASONAL_EVENTS) as FixedEventId[]), 'easter'];

/** Whether the day MM-DD is one of these days of an event (`to` before `from`: over the new year) */
export function isInEventDays({ from, to }: { from: string; to: string }, day: string): boolean {
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The day MM-DD `offset` days after month/day of a year (computed in UTC: no time zone, no daylight saving) */
function shiftDay(year: number, month: number, day: number, offset: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Easter Sunday of a year in the Gregorian calendar (Catholic and Protestant), [month, day] */
export function westernEaster(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return [month, ((h + l - 7 * m + 114) % 31) + 1];
}

/** Orthodox Easter Sunday of a year (Julian computus), in the Gregorian calendar, [month, day] */
export function orthodoxEaster(year: number): [number, number] {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // From the Julian to the Gregorian calendar: 13 days from 1900 to 2099, one more each century not a leap one
  const gap = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  const shifted = shiftDay(year, month, day, gap);
  return [Number(shifted.slice(0, 2)), Number(shifted.slice(3, 5))];
}

/**
 * Days of the movable events in a year, MM-DD: Easter from Holy Thursday to Easter Monday, the Catholic one and the
 * Orthodox one (Serbia), often the same week
 */
export function movableEventDays(event: MovableEventId, year: number): { from: string; to: string }[] {
  switch (event) {
    case 'easter':
      return [westernEaster(year), orthodoxEaster(year)].map(([month, day]) => ({ from: shiftDay(year, month, day, -3), to: shiftDay(year, month, day, 1) }));
  }
}

/** Every event of a local date key YYYY-MM-DD, in the order of SEASONAL_EVENT_IDS (read from the key, never with new Date()) */
export function seasonalEventsOf(dateKey: string): SeasonalEventId[] {
  const year = Number(dateKey.slice(0, 4));
  const day = dateKey.slice(5, 10);
  return SEASONAL_EVENT_IDS.filter(id => (Object.hasOwn(SEASONAL_EVENTS, id)
    ? isInEventDays(SEASONAL_EVENTS[id as FixedEventId], day)
    : movableEventDays(id as MovableEventId, year).some(days => isInEventDays(days, day))));
}

/** The first event of a local date key YYYY-MM-DD, if any */
export function seasonalEventOf(dateKey: string): SeasonalEventId | null {
  return seasonalEventsOf(dateKey)[0] ?? null;
}

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
  { kind: 'board', id: 'pumpkin', icon: '🎃', unlock: { type: 'event', event: 'halloween' } },
  { kind: 'board', id: 'christmas', icon: '🎄', unlock: { type: 'event', event: 'christmas' } },
  { kind: 'board', id: 'newyear', icon: '🎆', unlock: { type: 'event', event: 'newyear' } },
  { kind: 'board', id: 'valentine', icon: '💝', unlock: { type: 'event', event: 'valentine' } },
  { kind: 'board', id: 'shamrock', icon: '☘️', unlock: { type: 'event', event: 'stpatrick' } },
  { kind: 'board', id: 'aprilfish', icon: '🐠', unlock: { type: 'event', event: 'aprilfools' } },
  { kind: 'board', id: 'easter', icon: '🌷', unlock: { type: 'event', event: 'easter' } },
  { kind: 'board', id: 'music', icon: '🎼', unlock: { type: 'event', event: 'musicday' } },
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
  { kind: 'skin', id: 'coach', icon: '🧙', unlock: { type: 'event', event: 'halloween' } },
  { kind: 'skin', id: 'sleigh', icon: '🛷', unlock: { type: 'event', event: 'christmas' } },
  { kind: 'skin', id: 'limo', icon: '🍾', unlock: { type: 'event', event: 'newyear' } },
  { kind: 'skin', id: 'wedding', icon: '💍', unlock: { type: 'event', event: 'valentine' } },
  { kind: 'skin', id: 'leprechaun', icon: '🍀', unlock: { type: 'event', event: 'stpatrick' } },
  { kind: 'skin', id: 'goldfish', icon: '🐟', unlock: { type: 'event', event: 'aprilfools' } },
  { kind: 'skin', id: 'bunny', icon: '🐰', unlock: { type: 'event', event: 'easter' } },
  { kind: 'skin', id: 'guitar', icon: '🎸', unlock: { type: 'event', event: 'musicday' } },

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
  { kind: 'palette', id: 'haunted', icon: '👻', unlock: { type: 'event', event: 'halloween' } },
  { kind: 'palette', id: 'festive', icon: '🎄', unlock: { type: 'event', event: 'christmas' } },
  { kind: 'palette', id: 'party', icon: '🪩', unlock: { type: 'event', event: 'newyear' } },
  { kind: 'palette', id: 'lovers', icon: '🌹', unlock: { type: 'event', event: 'valentine' } },
  { kind: 'palette', id: 'emerald', icon: '🎩', unlock: { type: 'event', event: 'stpatrick' } },
  { kind: 'palette', id: 'prank', icon: '🎣', unlock: { type: 'event', event: 'aprilfools' } },
  { kind: 'palette', id: 'eggs', icon: '🥚', unlock: { type: 'event', event: 'easter' } },
  { kind: 'palette', id: 'concert', icon: '🔊', unlock: { type: 'event', event: 'musicday' } },

  // Win effects
  { kind: 'effect', id: 'none', icon: '⏹️', unlock: { type: 'default' } },
  { kind: 'effect', id: 'greenlight', icon: '🚦', unlock: { type: 'levels', count: 3 } },
  { kind: 'effect', id: 'confetti', icon: '🎊', unlock: { type: 'stars', count: 100 } },
  { kind: 'effect', id: 'fireworks', icon: '🎆', unlock: { type: 'level', level: 20 } },
  { kind: 'effect', id: 'speed', icon: '💨', unlock: { type: 'weeklies', count: 10 } },
  { kind: 'effect', id: 'bubbles', icon: '💧', unlock: { type: 'achievement', id: 'perfect_250' } },
  { kind: 'effect', id: 'tommy', icon: '💥', unlock: { type: 'achievement', id: 'mafia' } },
  { kind: 'effect', id: 'broadside', icon: '⚓', unlock: { type: 'weeklies', count: 30 } },
  { kind: 'effect', id: 'bats', icon: '🦇', unlock: { type: 'event', event: 'halloween' } },
  { kind: 'effect', id: 'gifts', icon: '🎁', unlock: { type: 'event', event: 'christmas' } },
  { kind: 'effect', id: 'champagne', icon: '🥂', unlock: { type: 'event', event: 'newyear' } },
  { kind: 'effect', id: 'hearts', icon: '💖', unlock: { type: 'event', event: 'valentine' } },
  { kind: 'effect', id: 'clovers', icon: '🪙', unlock: { type: 'event', event: 'stpatrick' } },
  { kind: 'effect', id: 'paperfish', icon: '🎏', unlock: { type: 'event', event: 'aprilfools' } },
  { kind: 'effect', id: 'eggs', icon: '🔔', unlock: { type: 'event', event: 'easter' } },
  { kind: 'effect', id: 'notes', icon: '🎵', unlock: { type: 'event', event: 'musicday' } },
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
  /** Events during which a daily challenge was won */
  events: Set<SeasonalEventId>;
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
    // Only the daily of the day itself: an archive won later is kept apart (archiveProgress)
    events: new Set(dailyKeys.flatMap(seasonalEventsOf)),
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
    case 'event': return c.events.has(rule.event);
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

/** Cosmetics of an event still to unlock (the home screen calls for the daily challenge during the event) */
export function lockedEventCosmetics(event: SeasonalEventId, c: CosmeticContext): CosmeticDef[] {
  return COSMETICS.filter(def => def.unlock.type === 'event' && def.unlock.event === event && !isCosmeticUnlocked(def, c));
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
