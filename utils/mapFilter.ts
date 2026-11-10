/**
 * Search on the world map: the levels matching criteria chosen by the player ("the levels I do not
 * have 3 stars on", "the 7x7 bosses"...). The map stays the map: the matching levels are lit, the
 * others dimmed, and the player goes from one match to the next. Nothing is saved. Pure functions.
 */
import { isMapLevelUnlocked } from './mapFocus';

/** Optimal number of moves of a level, as a range: how long (and hard) the level is */
export const MOVE_RANGES = [
  { key: 'short', min: 0, max: 14 },
  { key: 'medium', min: 15, max: 24 },
  { key: 'long', min: 25, max: 39 },
  { key: 'epic', min: 40, max: Infinity },
] as const;
export type MoveRangeKey = typeof MOVE_RANGES[number]['key'];

export type MapFilterSource = 'all' | 'campaign' | 'generated';

export interface MapFilter {
  /** Best stars to keep, 0 being "not won yet"; empty: any */
  stars: number[];
  /** Grid sizes to keep; empty: any */
  gridSizes: number[];
  /** Ranges of optimal moves to keep; empty: any */
  moves: MoveRangeKey[];
  source: MapFilterSource;
  /** Only the bosses of the campaign */
  bossOnly: boolean;
  /** Only the levels that can be played now: the locked ones are left out */
  playableOnly: boolean;
}

/** The search as it opens: every level that can be played */
export const DEFAULT_MAP_FILTER: MapFilter = {
  stars: [],
  gridSizes: [],
  moves: [],
  source: 'all',
  bossOnly: false,
  playableOnly: true,
};

/** "Under 3 stars": not won yet, or won with 1 or 2 stars */
export const STARS_UNDER_THREE = [0, 1, 2];

/** What the filter needs to know about a level of the map */
export interface FilterableLevel {
  id: number;
  gridSize: number;
  minMoves: number;
}

export interface MapFilterContext {
  /** Best stars of the levels won */
  starsById: ReadonlyMap<number, number>;
  maxUnlockedLevel: number;
  /** Levels of the campaign: the ids after it are generated levels */
  campaignSize: number;
  isBoss: (levelId: number) => boolean;
}

export const moveRangeOf = (minMoves: number): MoveRangeKey =>
  (MOVE_RANGES.find(r => minMoves >= r.min && minMoves <= r.max) ?? MOVE_RANGES[0]).key;

export function matchesMapFilter(level: FilterableLevel, filter: MapFilter, ctx: MapFilterContext): boolean {
  const generated = level.id > ctx.campaignSize;
  if (filter.source === 'campaign' && generated) return false;
  if (filter.source === 'generated' && !generated) return false;
  if (filter.bossOnly && !ctx.isBoss(level.id)) return false;
  // A generated level is always playable, like on the map
  if (filter.playableOnly && !generated && !isMapLevelUnlocked(level.id, ctx.maxUnlockedLevel)) return false;
  if (filter.stars.length > 0 && !filter.stars.includes(Math.min(3, ctx.starsById.get(level.id) ?? 0))) return false;
  if (filter.gridSizes.length > 0 && !filter.gridSizes.includes(level.gridSize)) return false;
  if (filter.moves.length > 0 && !filter.moves.includes(moveRangeOf(level.minMoves))) return false;
  return true;
}

/** Ids of the matching levels, in the order of the map */
export function filterMapLevels(levels: readonly FilterableLevel[], filter: MapFilter, ctx: MapFilterContext): number[] {
  return levels.filter(l => matchesMapFilter(l, filter, ctx)).map(l => l.id).sort((a, b) => a - b);
}

/** The match closest to a level of the map (the lower one at equal distance), null without a match */
export function nearestMatch(matchIds: readonly number[], levelId: number): number | null {
  let best: number | null = null;
  for (const id of matchIds) {
    if (best === null || Math.abs(id - levelId) < Math.abs(best - levelId)) best = id;
  }
  return best;
}

/**
 * The match after (direction 1) or before (-1) a level, going round at the ends. The level it starts
 * from does not have to match any more: a level just won with 3 stars leaves "under 3 stars".
 */
export function stepMatch(matchIds: readonly number[], fromId: number, direction: 1 | -1): number | null {
  if (matchIds.length === 0) return null;
  if (direction === 1) return matchIds.find(id => id > fromId) ?? matchIds[0];
  for (let i = matchIds.length - 1; i >= 0; i--) if (matchIds[i] < fromId) return matchIds[i];
  return matchIds[matchIds.length - 1];
}

/** A value added to a multiple choice, or removed if it was in */
export function toggled<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter(v => v !== value) : [...values, value];
}
