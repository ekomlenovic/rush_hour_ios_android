import { Vehicle, Level, DAILY_LEVEL_ID, WEEKLY_LEVEL_ID } from '../store/gameStore';
import { exploreComponent, initialPositions, toCompactBoard } from './solver';
import { sampleLevels } from '../data/sampleLevels';
import { parseLocalDateString } from './date';
import { GENERATOR_VEHICLE_COLORS, TARGET_CAR_COLOR } from '../theme/board';

export interface DifficultyConfig {
  gridSize: number;
  /** Vehicles on the board, the target car included */
  minVehicles: number;
  maxVehicles: number;
  minMovesRequired: number;
  maxMovesRequired: number;
}

export const DIFFICULTY_LEVELS: Record<string, DifficultyConfig> = {
  EASY: { gridSize: 6, minVehicles: 5, maxVehicles: 8, minMovesRequired: 6, maxMovesRequired: 12 },
  NORMAL: { gridSize: 6, minVehicles: 8, maxVehicles: 12, minMovesRequired: 10, maxMovesRequired: 15 },
  HARD: { gridSize: 6, minVehicles: 10, maxVehicles: 14, minMovesRequired: 15, maxMovesRequired: 25 },
  EXPERT: { gridSize: 6, minVehicles: 12, maxVehicles: 16, minMovesRequired: 25, maxMovesRequired: 50 },
  /** Too slow for a phone: pack scripts only (generate_pack.ts), never generated on the device */
  MASTER: { gridSize: 7, minVehicles: 14, maxVehicles: 20, minMovesRequired: 40, maxMovesRequired: 80 },
};

/** Difficulties offered by the level generator of the world map */
export const DEVICE_DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EXPERT'] as const;
export type DeviceDifficulty = typeof DEVICE_DIFFICULTIES[number];

const COLORS = GENERATOR_VEHICLE_COLORS;

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RNG
// ─────────────────────────────────────────────────────────────────────────────

/** Pseudo-random numbers in [0, 1) from a string seed: the same seed gives the same level */
export function createPRNG(seed: string): () => number {
  'worklet';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  // If h is 0, the generator would stay at 0
  if (h === 0) h = 1;

  return () => {
    'worklet';
    h = Math.imul(16807, h) | 0;
    return (h & 0x7fffffff) / 0x7fffffff;
  };
}

/** A fresh seed for a level generated on the map (not reproducible on purpose) */
export const randomSeed = (): string => `${Date.now()}-${Math.random()}`;

/**
 * Daily challenge: the same puzzle for everyone on a given date (seeded by the date),
 * NORMAL difficulty, HARD on Mondays.
 */
export async function generateDailyLevel(dateStr: string): Promise<Level | null> {
  return generateLevel(DAILY_LEVEL_ID, getDailyDifficulty(dateStr), getDailySeed(dateStr));
}

export function getDailyDifficulty(dateStr: string): DifficultyConfig {
  return parseLocalDateString(dateStr).getDay() === 1 ? DIFFICULTY_LEVELS.HARD : DIFFICULTY_LEVELS.NORMAL;
}

export const getDailySeed = (dateStr: string): string => `daily-${dateStr}`;

/** Campaign levels at least this hard feed the weekly challenge */
const WEEKLY_MIN_MOVES = 25;
/** Stride through the pool: consecutive weeks get unrelated levels */
const WEEKLY_POOL_STRIDE = 23;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Number of weeks between 1970 and the Monday of an ISO week key ('2026-W42') */
function getWeekIndex(weekKey: string): number {
  const [year, week] = weekKey.split('-W').map(Number);
  // January 4th is always in ISO week 1
  const jan4 = Date.UTC(year, 0, 4);
  const jan4DayOfWeek = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (jan4DayOfWeek - 1) * 86400000 + (week - 1) * WEEK_MS;
  return Math.round(monday / WEEK_MS);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Applies one of the 8 symmetries of the square (bit 0: transpose, bit 1: flip rows, bit 2: flip columns).
 * The puzzle stays equivalent, with the same minimum number of moves.
 */
export function transformLevel(level: Level, symmetry: number): Level {
  const n = level.gridSize;
  const transpose = (symmetry & 1) !== 0;
  const flipRows = (symmetry & 2) !== 0;
  const flipCols = (symmetry & 4) !== 0;

  const mapCell = (row: number, col: number): [number, number] => {
    let [r, c] = transpose ? [col, row] : [row, col];
    if (flipRows) r = n - 1 - r;
    if (flipCols) c = n - 1 - c;
    return [r, c];
  };

  const vehicles = level.vehicles.map((v) => {
    const cells = Array.from({ length: v.length }, (_, i) =>
      mapCell(v.orientation === 'vertical' ? v.row + i : v.row, v.orientation === 'horizontal' ? v.col + i : v.col)
    );
    const orientation: Vehicle['orientation'] = transpose
      ? (v.orientation === 'horizontal' ? 'vertical' : 'horizontal')
      : v.orientation;
    return {
      ...v,
      row: Math.min(...cells.map(([r]) => r)),
      col: Math.min(...cells.map(([, c]) => c)),
      orientation,
    };
  });

  // The exit is a virtual cell just outside the grid; 255 encodes -1 (top or left side)
  const [exitRow, exitCol] = mapCell(
    level.exitRow === 255 ? -1 : level.exitRow,
    level.exitCol === 255 ? -1 : level.exitCol,
  );

  return {
    ...level,
    vehicles,
    exitRow: exitRow === -1 ? 255 : exitRow,
    exitCol: exitCol === -1 ? 255 : exitCol,
  };
}

/**
 * Weekly challenge: same puzzle for everyone during an ISO week, harder than the daily.
 * Built from a hard campaign level, disguised by a symmetry and new colors:
 * instant to produce and the minimum number of moves is already known.
 */
export async function generateWeeklyLevel(weekKey: string): Promise<Level | null> {
  const pool = sampleLevels.filter(l => l.minMoves >= WEEKLY_MIN_MOVES);
  if (pool.length === 0) return null;

  const weekIndex = getWeekIndex(weekKey);
  // A stride coprime with the pool size visits every level before repeating one
  const stride = gcd(WEEKLY_POOL_STRIDE, pool.length) === 1 ? WEEKLY_POOL_STRIDE : 1;
  const source = pool[(weekIndex * stride) % pool.length];
  // Never the identity, so the level does not look like its campaign version
  const symmetry = 1 + (weekIndex % 7);

  const transformed = transformLevel(source, symmetry);

  // Shuffle the colors of the other vehicles
  const random = createPRNG(`weekly-${weekKey}`);
  const colors = shuffleWith(COLORS, random);
  let colorIndex = 0;
  const vehicles = transformed.vehicles.map(v =>
    v.isTarget ? v : { ...v, color: colors[colorIndex++ % colors.length] }
  );

  return { ...transformed, id: WEEKLY_LEVEL_ID, vehicles, updatedAt: Date.now() };
}

function shuffleWith<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/** Random boards tried before giving up */
const MAX_ATTEMPTS = 600;
/** Largest component explored, by grid size: bigger ones are skipped (too slow on a phone) */
const MAX_COMPONENT_STATES: Record<number, number> = { 6: 60000, 7: 60000, 8: 40000 };

function canPlace(
  vehicles: Vehicle[],
  row: number,
  col: number,
  length: number,
  orientation: 'horizontal' | 'vertical',
  gridSize: number,
): boolean {
  'worklet';
  for (let i = 0; i < length; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    if (r >= gridSize || c >= gridSize) return false;
    for (const v of vehicles) {
      const covers = v.orientation === 'horizontal'
        ? v.row === r && c >= v.col && c < v.col + v.length
        : v.col === c && r >= v.row && r < v.row + v.length;
      if (covers) return false;
    }
  }
  return true;
}

interface RandomBoard {
  vehicles: Vehicle[];
  exitRow: number;
  exitCol: number;
}

/**
 * A random board: the target car somewhere on a lane leading to an exit on any side,
 * then other vehicles anywhere (never lying on the target's lane, they would wall the exit).
 * It does not need to be solved or hard: the exploration finds the hardest state of it.
 */
function randomBoard(config: DifficultyConfig, random: () => number): RandomBoard {
  'worklet';
  const g = config.gridSize;
  const side = Math.floor(random() * 4); // 0 right, 1 left, 2 bottom, 3 top
  const lane = 1 + Math.floor(random() * (g - 1));
  const horizontal = side < 2;
  const targetPos = Math.floor(random() * (g - 1));
  const vehicles: Vehicle[] = [{
    id: 'target',
    row: horizontal ? lane : targetPos,
    col: horizontal ? targetPos : lane,
    length: 2,
    orientation: horizontal ? 'horizontal' : 'vertical',
    isTarget: true,
    color: TARGET_CAR_COLOR,
  }];
  const exitRow = horizontal ? lane : side === 2 ? g : 255;
  const exitCol = horizontal ? (side === 0 ? g : 255) : lane;

  const count = config.minVehicles + Math.floor(random() * (config.maxVehicles - config.minVehicles + 1));
  for (let tries = 0; vehicles.length < count && tries < count * 40; tries++) {
    const orientation: 'horizontal' | 'vertical' = random() < 0.5 ? 'horizontal' : 'vertical';
    const length = random() < 0.7 ? 2 : 3;
    const row = Math.floor(random() * g);
    const col = Math.floor(random() * g);
    if (orientation === 'horizontal' && horizontal && row === lane) continue;
    if (orientation === 'vertical' && !horizontal && col === lane) continue;
    if (!canPlace(vehicles, row, col, length, orientation, g)) continue;
    vehicles.push({
      id: `v${vehicles.length}`,
      row, col, length, orientation,
      isTarget: false,
      color: COLORS[vehicles.length % COLORS.length],
    });
  }
  return { vehicles, exitRow, exitCol };
}

/**
 * Generates a level of the given difficulty (see docs/GAME_DESIGN.md, Génération des niveaux).
 * Each random board is explored completely: the distance of every reachable state to the exit
 * is known, so one board gives a puzzle of any difficulty it holds, instead of hoping that a
 * random placement lands in the wanted range. The same seed always gives the same level
 * (`randomSeed()` for a new one; no default here: the worklet must not capture JS functions).
 */
export function generateLevel(id: number, config: DifficultyConfig, seed: string): Level | null {
  'worklet';
  const random = createPRNG(seed);
  const { gridSize, minMovesRequired, maxMovesRequired } = config;
  const maxStates = MAX_COMPONENT_STATES[gridSize] ?? 40000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = randomBoard(config, random);
    const compact = toCompactBoard(board.vehicles, gridSize, board.exitRow, board.exitCol);
    const component = exploreComponent(compact, initialPositions(board.vehicles), maxStates);
    if (!component || component.maxDistance < minMovesRequired) continue;

    // As hard as allowed, within the last 3 moves of the range for variety
    const top = Math.min(component.maxDistance, maxMovesRequired);
    const wanted = Math.max(minMovesRequired, top - Math.floor(random() * 3));
    const candidates: number[] = [];
    for (let s = 0; s < component.count; s++) {
      if (component.distance[s] === wanted) candidates.push(s);
    }
    if (candidates.length === 0) continue;

    const chosen = candidates[Math.floor(random() * candidates.length)];
    const n = compact.n;
    const vehicles = board.vehicles.map((v, i) => {
      const p = component.states[chosen * n + i];
      return v.orientation === 'horizontal' ? { ...v, col: p } : { ...v, row: p };
    });
    return {
      id,
      gridSize,
      vehicles,
      exitRow: board.exitRow,
      exitCol: board.exitCol,
      minMoves: wanted,
      updatedAt: Date.now(),
    };
  }
  return null;
}
