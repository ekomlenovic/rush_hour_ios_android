import { Vehicle, Level } from '../store/gameStore';
import { solvePuzzle } from './solver';

export interface DifficultyConfig {
  gridSize: number;
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
  MASTER: { gridSize: 7, minVehicles: 14, maxVehicles: 20, minMovesRequired: 40, maxMovesRequired: 80 },
};

const COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#64748B', '#14B8A6',
];

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RNG (Linear Congruential Generator)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a simple pseudo-random number generator from a string seed.
 */
function createPRNG(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  // If h is 0, the LCG will stay at 0. Force it to something else.
  if (h === 0) h = 1;

  return function () {
    h = Math.imul(16807, h) | 0;
    // We want a positive float between 0 and 1
    const res = (h & 0x7fffffff) / 0x7fffffff;
    return res;
  };
}


let currentRNG = Math.random;

function seededRandom() {
  return currentRNG();
}

/**
 * Wraps generation with a specific seed to ensure deterministic results.
 * Now asynchronous to prevent UI blocking during the multi-attempt trial process.
 */
export async function generateDailyLevel(dateStr: string): Promise<Level | null> {
  const prng = createPRNG(dateStr);
  const oldRNG = currentRNG;
  currentRNG = prng;

  const date = new Date(dateStr);
  const isMonday = date.getDay() === 1;

  // Use a fixed difficulty for Daily Challenge: NORMAL usually, HARD on Mondays
  const difficulty = isMonday ? DIFFICULTY_LEVELS.HARD : DIFFICULTY_LEVELS.NORMAL;
  // Use timestamp for daily ID: ensuring it changes every day

  const dailyId = Date.parse(dateStr) || 999999;

  try {
    // We use a small timeout to allow UI to breathe
    return new Promise((resolve) => {
      setTimeout(() => {
        // We use the new scrambled generator for near-instant on-device generation
        const level = generateScrambledLevel(dailyId, difficulty);
        currentRNG = oldRNG; // Restore RNG after generation
        resolve(level);
      }, 0);
    });
  } catch (e) {
    currentRNG = oldRNG;
    return null;
  }
}

/**
 * Generates a level by starting from a solved state and scrambling it backwards.
 * This is O(1) in terms of "probability of success" and very fast on mobile.
 */
export function generateScrambledLevel(id: number, config: DifficultyConfig, retries: number = 0): Level | null {
  const { gridSize, minVehicles, maxVehicles, minMovesRequired } = config;
  const targetRow = Math.floor(gridSize / 2) - 1;
  const exitCol = gridSize;

  // 1. Initial Solved State
  const vehicles: Vehicle[] = [{
    id: 'target',
    row: targetRow,
    col: gridSize - 2,
    length: 2,
    orientation: 'horizontal',
    isTarget: true,
    color: '#EF4444',
  }];

  // 2. Add random vehicles
  const targetCount = minVehicles + Math.floor(seededRandom() * (maxVehicles - minVehicles + 1));
  let attempts = 0;
  while (vehicles.length < targetCount && attempts < 100) {
    attempts++;
    const orientation = seededRandom() > 0.5 ? 'horizontal' : 'vertical';
    const length = seededRandom() > 0.3 ? 2 : 3;
    const row = Math.floor(seededRandom() * gridSize);
    const col = Math.floor(seededRandom() * gridSize);

    if (canPlace(vehicles, row, col, length, orientation, gridSize)) {
      vehicles.push({
        id: `v${vehicles.length}`,
        row, col, length, orientation,
        isTarget: false,
        color: COLORS[vehicles.length % COLORS.length],
      });
    }
  }

  // 3. Scramble
  // Perform random moves backwards
  const scrambleSteps = 150;
  for (let s = 0; s < scrambleSteps; s++) {
    const vIdx = Math.floor(seededRandom() * vehicles.length);
    const v = vehicles[vIdx];
    const dir = seededRandom() > 0.5 ? 1 : -1;
    const dist = Math.floor(seededRandom() * 2) + 1; // move 1 or 2 cells

    // Test if move is valid
    const newPos = (v.orientation === 'horizontal' ? v.col : v.row) + dir * dist;
    const testRow = v.orientation === 'vertical' ? newPos : v.row;
    const testCol = v.orientation === 'horizontal' ? newPos : v.col;

    // Boundary check
    if (newPos >= 0 && newPos + v.length <= gridSize) {
      // Collision check (ignoring current vehicle)
      const others = vehicles.filter((_, i) => i !== vIdx);
      if (canPlace(others, testRow, testCol, v.length, v.orientation, gridSize)) {
        v.row = testRow;
        v.col = testCol;
      }
    }
  }

  // 4. Validate and get minMoves
  const solveResult = solvePuzzle(vehicles, gridSize, targetRow, exitCol, 200);

  if (solveResult.solvable && solveResult.minMoves >= (minMovesRequired / 2)) {
    return {
      id,
      gridSize,
      vehicles,
      exitRow: targetRow,
      exitCol,
      minMoves: solveResult.minMoves,
      updatedAt: Date.now(),
    };
  }

  // Fallback if scramble didn't yield a "hard enough" level or somehow broke
  // Limit retries to prevent infinite recursion
  const currentRetries = (arguments[2] || 0);
  if (currentRetries < 20) {
    return generateScrambledLevel(id, config, currentRetries + 1);
  }

  // Final fallback: try the original (slower but guaranteed) generator
  return generateLevel(id, config);
}





// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}


// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENT HELPER
// ─────────────────────────────────────────────────────────────────────────────

function canPlace(
  vehicles: Vehicle[],
  row: number,
  col: number,
  length: number,
  orientation: 'horizontal' | 'vertical',
  gridSize: number,
): boolean {
  if (orientation === 'horizontal') {
    if (col + length > gridSize) return false;
    for (let i = 0; i < length; i++) {
      const c = col + i;
      if (vehicles.some(v =>
        v.orientation === 'horizontal'
          ? v.row === row && c >= v.col && c < v.col + v.length
          : v.col === c && row >= v.row && row < v.row + v.length,
      )) return false;
    }
  } else {
    if (row + length > gridSize) return false;
    for (let i = 0; i < length; i++) {
      const r = row + i;
      if (vehicles.some(v =>
        v.orientation === 'horizontal'
          ? v.row === r && col >= v.col && col < v.col + v.length
          : v.col === col && r >= v.row && r < v.row + v.length,
      )) return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateLevel(id: number, config: DifficultyConfig): Level | null {
  const { gridSize, minVehicles, maxVehicles, minMovesRequired, maxMovesRequired } = config;

  const targetRow = Math.floor(gridSize / 2) - 1;
  const exitCol = gridSize;
  const bfsLimit = maxMovesRequired + 10;
  const maxAttempts = minMovesRequired >= 20 ? 3000 : 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const vehicles: Vehicle[] = [];

    vehicles.push({
      id: 'target',
      row: targetRow,
      col: 0,
      length: 2,
      orientation: 'horizontal',
      isTarget: true,
      color: '#EF4444',
    });

    const pathCols = shuffle(Array.from({ length: gridSize - 2 }, (_, i) => i + 2));
    const minBlock = clamp(Math.floor(minMovesRequired / 5), 1, pathCols.length);
    const maxBlock = clamp(Math.ceil(maxMovesRequired / 4), minBlock, pathCols.length);
    const numBlock = minBlock + Math.floor(seededRandom() * (maxBlock - minBlock + 1));


    for (let b = 0; b < numBlock; b++) {
      const col = pathCols[b];
      for (let p = 0; p < 25; p++) {
        const length = seededRandom() > 0.4 ? 2 : 3;
        const minRow = Math.max(0, targetRow - length + 1);
        const maxRow = Math.min(gridSize - length, targetRow);
        if (minRow > maxRow) continue;

        const row = minRow + Math.floor(seededRandom() * (maxRow - minRow + 1));
        if (canPlace(vehicles, row, col, length, 'vertical', gridSize)) {
          vehicles.push({
            id: `blocker_${b}`,
            row, col, length,
            orientation: 'vertical',
            isTarget: false,
            color: COLORS[b % COLORS.length],
          });
          break;
        }
      }
    }

    const targetCount = minVehicles + Math.floor(seededRandom() * (maxVehicles - minVehicles + 1));
    let stalls = 0;
    while (vehicles.length < targetCount + 1 && stalls < 6) {
      let placed = false;
      for (let p = 0; p < 40; p++) {
        const orientation: 'horizontal' | 'vertical' = seededRandom() > 0.5 ? 'horizontal' : 'vertical';
        const length = seededRandom() > 0.3 ? 2 : 3;
        const row = Math.floor(seededRandom() * gridSize);
        const col = Math.floor(seededRandom() * gridSize);

        if (orientation === 'horizontal' && row === targetRow) continue;

        if (canPlace(vehicles, row, col, length, orientation, gridSize)) {
          vehicles.push({
            id: `v${vehicles.length}`,
            row, col, length, orientation,
            isTarget: false,
            color: COLORS[vehicles.length % COLORS.length],
          });
          placed = true;
          break;
        }
      }
      if (!placed) stalls++;
    }

    // ── 4. optimized solver – exact minimum move count ─────────────────────────────
    const moves = solvePuzzle(vehicles, gridSize, targetRow, exitCol, bfsLimit).minMoves;

    if (moves >= minMovesRequired && moves <= maxMovesRequired) {
      return {
        id,
        gridSize,
        vehicles,
        exitRow: targetRow,
        exitCol,
        minMoves: moves,
        updatedAt: Date.now(),
      };


    }

  }

  return null;
}