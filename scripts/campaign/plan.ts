// Difficulty curve of the campaign: the generator parameters of each level id
import { ZONE_SIZE } from '../../components/map/zones';

export type ExitSide = 'right' | 'left' | 'bottom' | 'top';

export interface LevelPlan {
  id: number;
  role: 'breather' | 'regular' | 'boss';
  grid: 6 | 7 | 8;
  minMoves: number;
  maxMoves: number;
  minVehicles: number;
  maxVehicles: number;
  exit: ExitSide;
  /** Distinct vehicles the optimal solution must move (rejects levels where only a few cars shuffle) */
  minMovers: number;
  /** Components bigger than this are dropped by the generator (rust --max-bfs-states) */
  maxBfsStates: number;
}

/** Last level of the campaign */
export const CAMPAIGN_SIZE = 1000;
/** First zone generated with this plan (levels 301-320, the end of the hand-merged pack is at ~45 moves) */
const FIRST_ZONE = 16;
const LAST_ZONE = CAMPAIGN_SIZE / ZONE_SIZE;

const EXITS: ExitSide[] = ['right', 'left', 'bottom', 'top'];

/** Typical number of moves of a zone: rises steadily from zone 16 to the last one */
function zoneBase(zone: number): number {
  const t = (zone - FIRST_ZONE) / (LAST_ZONE - FIRST_ZONE);
  return Math.round(38 + 20 * t);
}

/** Stable 32-bit hash of a string (FNV-1a) */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Seeded random numbers in [0, 1) (mulberry32): neighbouring seeds give unrelated draws */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, weighted: [T, number][]): T {
  let r = random() * weighted.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of weighted) {
    if ((r -= w) < 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

/**
 * In each zone of 20 levels: two easier "breathers" to start, a ramp around the zone base,
 * and a "boss" well above it as the last level.
 */
export function planLevel(id: number): LevelPlan {
  const zone = Math.ceil(id / ZONE_SIZE);
  const position = id - (zone - 1) * ZONE_SIZE; // 1..20
  const base = zoneBase(zone);
  const random = seededRandom(hash32(`campaign-plan-${id}`));

  let role: LevelPlan['role'];
  let minMoves: number;
  let width: number;
  if (position <= 2) {
    role = 'breather';
    minMoves = Math.max(24, base - 14 + 2 * position);
    width = 3;
  } else if (position === ZONE_SIZE) {
    role = 'boss';
    minMoves = base + 12;
    width = 6;
  } else {
    role = 'regular';
    minMoves = base - 4 + Math.round(((position - 3) * 8) / (ZONE_SIZE - 4));
    width = 3;
  }

  // Bigger grids for harder levels; 6x6 cannot go much beyond 40 moves
  const grid = pick<LevelPlan['grid']>(random,
    role === 'boss' ? [[7, 1], [8, 2]]
      : minMoves <= 34 ? [[6, 5], [7, 4], [8, 1]]
      : minMoves <= 42 ? [[6, 2], [7, 5], [8, 3]]
      : [[7, 11], [8, 9]]);
  const [minVehicles, maxVehicles] = { 6: [10, 14], 7: [12, 16], 8: [14, 18] }[grid];

  return {
    id,
    role,
    grid,
    minMoves,
    maxMoves: minMoves + width,
    minVehicles,
    maxVehicles,
    exit: EXITS[Math.floor(random() * EXITS.length)],
    minMovers: Math.min(4 + Math.floor(minMoves / 10), 9),
    maxBfsStates: minMoves >= 60 ? 1_200_000 : 300_000,
  };
}
