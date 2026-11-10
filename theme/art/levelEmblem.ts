import { PLAYER_TITLES } from '../../data/progression';

/**
 * The emblem of a player level: see docs/GAME_DESIGN.md (Niveau joueur et XP).
 * One road sign per title tier (its shape and its metal), the level written on it, and
 * inside a tier one more bolt on its rim at each step. Drawn in a 48 × 48 box.
 */

export const EMBLEM_BOX = 48;
/** The face of a sign is its outline at this scale: the rest is its rim */
export const EMBLEM_FACE_SCALE = 0.8;

export interface EmblemTier {
  /** The title of the tier (PLAYER_TITLES) */
  id: string;
  minLevel: number;
  /** Outline of the sign, an SVG path */
  shape: string;
  /** Where its bolts go on the rim: top, left, right, bottom */
  bolts: [number, number][];
  /** Rim, from the bottom left to the top right */
  rim: [string, string];
  /** Face, from the top to the bottom (three colors: from corner to corner) */
  fill: string[];
  /** The level written on the face */
  ink: string;
}

/** A bolt of the rim, and its outline */
export const EMBLEM_BOLT = { fill: '#FFFFFF', stroke: 'rgba(0,0,0,0.55)' };
/** Behind a light level, to read it on any face */
export const EMBLEM_INK_SHADOW = 'rgba(0,0,0,0.45)';
const LIGHT_INK = '#FFFFFF';
export const hasLightInk = (tier: EmblemTier): boolean => tier.ink === LIGHT_INK;

/** An 8-point star: the sign of the last tier */
function starPath(): string {
  const points: string[] = [];
  for (let i = 0; i < 16; i++) {
    const radius = i % 2 ? 18.2 : 23;
    const angle = (Math.PI * 2 * i) / 16 - Math.PI / 2;
    points.push(`${(24 + radius * Math.cos(angle)).toFixed(1)} ${(24 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${points.join('L')}Z`;
}

const CARDINAL = (d: number): [number, number][] => [[24, 24 - d], [24 - d, 24], [24 + d, 24], [24, 24 + d]];

/** In the order of PLAYER_TITLES: one sign per title */
export const EMBLEM_TIERS: EmblemTier[] = [
  {
    id: 'apprentice', minLevel: 1, ink: '#FFFFFF',
    shape: 'M24 2.5a21.5 21.5 0 1 0 0 43a21.5 21.5 0 1 0 0-43Z',
    bolts: CARDINAL(19.3), rim: ['#5B6474', '#A4ADBB'], fill: ['#8D97A7', '#6C7686'],
  },
  {
    id: 'driver', minLevel: 5, ink: '#FFFFFF',
    shape: 'M21.2 4.9Q24 2.1 26.8 4.9L43.1 21.2Q45.9 24 43.1 26.8L26.8 43.1Q24 45.9 21.2 43.1L4.9 26.8Q2.1 24 4.9 21.2Z',
    bolts: CARDINAL(18.4), rim: ['#6E3B1A', '#D09562'], fill: ['#C98146', '#96531F'],
  },
  {
    id: 'pilot', minLevel: 10, ink: '#FFFFFF',
    shape: 'M24 2.5L42 8.5V24C42 35 34 42 24 46C14 42 6 35 6 24V8.5Z',
    bolts: [[24, 5.2], [8.6, 11], [39.4, 11], [24, 43]], rim: ['#234E78', '#8FC3EC'], fill: ['#5FA2DA', '#2F6DA6'],
  },
  {
    id: 'navigator', minLevel: 15, ink: '#3A2800',
    shape: 'M24 2L43.5 13V35L24 46L4.5 35V13Z',
    bolts: [[24, 4.6], [6.8, 14], [41.2, 14], [24, 43.4]], rim: ['#7A5400', '#FFDD6B'], fill: ['#FFD24A', '#D69400'],
  },
  {
    id: 'road_expert', minLevel: 20, ink: '#FFFFFF',
    shape: 'M15 2.5H33L45.5 15V33L33 45.5H15L2.5 33V15Z',
    bolts: CARDINAL(19.2), rim: ['#074D38', '#52DDAA'], fill: ['#2CC48F', '#0B7A57'],
  },
  {
    id: 'traffic_master', minLevel: 30, ink: '#FFFFFF',
    shape: 'M5.5 6L15 11.5L24 2.5L33 11.5L42.5 6V25C42.5 35 34.5 42 24 46C13.5 42 5.5 35 5.5 25Z',
    bolts: [[24, 6], [8, 10], [40, 10], [24, 43]], rim: ['#2A2080', '#A7A2FF'], fill: ['#8279FF', '#4A3FD0'],
  },
  {
    id: 'legend', minLevel: 40, ink: '#FFFFFF',
    shape: starPath(),
    bolts: CARDINAL(20), rim: ['#8A6100', '#FFE889'], fill: ['#FF4F93', '#6E56FF', '#1FC4E8'],
  },
];

/** Steps inside a tier: the bolts of a sign */
export const EMBLEM_STEPS = 4;
/** Which bolts (indexes of `bolts`) are on at each step: they come on symmetrically */
export const EMBLEM_BOLTS: number[][] = [[], [0], [1, 2], [0, 1, 2], [0, 1, 2, 3]];
/** Levels the last tier is spread over: it has no next tier */
const LAST_TIER_SPAN = 25;

const clean = (level: number) => Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));

function tierIndex(level: number): number {
  let index = 0;
  EMBLEM_TIERS.forEach((tier, i) => { if (clean(level) >= tier.minLevel) index = i; });
  return index;
}

export const getEmblemTier = (level: number): EmblemTier => EMBLEM_TIERS[tierIndex(level)];

/**
 * How far a level is inside its tier, 0 to EMBLEM_STEPS: one step per level in the tiers
 * of 5 levels, one every 2 levels in those of 10, one every 5 levels in the last.
 */
export function getEmblemStep(level: number): number {
  const index = tierIndex(level);
  const tier = EMBLEM_TIERS[index];
  const span = index < EMBLEM_TIERS.length - 1 ? EMBLEM_TIERS[index + 1].minLevel - tier.minLevel : LAST_TIER_SPAN;
  const perStep = Math.max(1, span / (EMBLEM_STEPS + 1));
  return Math.min(EMBLEM_STEPS, Math.floor((clean(level) - tier.minLevel) / perStep));
}

/** The level as written on the emblem */
export const emblemLabel = (level: number): string => String(Math.min(clean(level), 999));

/** Checked by the tests: the tiers are those of the titles */
export const emblemTiersMatchTitles = (): boolean =>
  EMBLEM_TIERS.length === PLAYER_TITLES.length && EMBLEM_TIERS.every((tier, i) => tier.id === PLAYER_TITLES[i].id && tier.minLevel === PLAYER_TITLES[i].minLevel);
