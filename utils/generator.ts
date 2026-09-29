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

  const dailyId = 999999;

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
 * Picks a random exit side and returns the corresponding target vehicle config.
 * Sides: 0=right, 1=left, 2=bottom, 3=top
 */
function pickExitSide(gridSize: number): {
  exitRow: number;
  exitCol: number;
  targetOrientation: 'horizontal' | 'vertical';
  targetRow: number;
  targetCol: number;
} {
  const side = Math.floor(seededRandom() * 4);
  switch (side) {
    case 0: { // Right exit
      const row = Math.floor(seededRandom() * (gridSize - 1)) + 1; // avoid row 0 for variety
      return { exitRow: row, exitCol: gridSize, targetOrientation: 'horizontal', targetRow: row, targetCol: gridSize - 2 };
    }
    case 1: { // Left exit
      const row = Math.floor(seededRandom() * (gridSize - 1)) + 1;
      return { exitRow: row, exitCol: 255, targetOrientation: 'horizontal', targetRow: row, targetCol: 0 };
    }
    case 2: { // Bottom exit
      const col = Math.floor(seededRandom() * (gridSize - 1)) + 1;
      return { exitRow: gridSize, exitCol: col, targetOrientation: 'vertical', targetRow: gridSize - 2, targetCol: col };
    }
    case 3: { // Top exit
      const col = Math.floor(seededRandom() * (gridSize - 1)) + 1;
      return { exitRow: 255, exitCol: col, targetOrientation: 'vertical', targetRow: 0, targetCol: col };
    }
    default: { // Fallback to right (classic)
      const row = Math.floor(gridSize / 2) - 1;
      return { exitRow: row, exitCol: gridSize, targetOrientation: 'horizontal', targetRow: row, targetCol: gridSize - 2 };
    }
  }
}

/**
 * Generates a level by starting from a solved state and scrambling it backwards.
 * This is O(1) in terms of "probability of success" and very fast on mobile.
 * Now randomly picks one of 4 exit sides for variety.
 */
export function generateScrambledLevel(id: number, config: DifficultyConfig, retries: number = 0): Level | null {
  const { gridSize, minVehicles, maxVehicles, minMovesRequired } = config;
  const { exitRow, exitCol, targetOrientation, targetRow, targetCol } = pickExitSide(gridSize);

  // 1. Initial Solved State — target is placed at the exit edge
  const vehicles: Vehicle[] = [{
    id: 'target',
    row: targetRow,
    col: targetCol,
    length: 2,
    orientation: targetOrientation,
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
  const solveResult = solvePuzzle(vehicles, gridSize, exitRow, exitCol, 200);

  if (solveResult.solvable && solveResult.minMoves >= (minMovesRequired / 2)) {
    return {
      id,
      gridSize,
      vehicles,
      exitRow,
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

  const bfsLimit = maxMovesRequired + 10;
  const maxAttempts = minMovesRequired >= 20 ? 3000 : 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { exitRow, exitCol, targetOrientation, targetRow, targetCol } = pickExitSide(gridSize);
    const vehicles: Vehicle[] = [];

    // Place target at the far end from the exit (so it has to travel across)
    const startRow = targetOrientation === 'horizontal' ? targetRow : (exitRow === 255 ? gridSize - 2 : 0);
    const startCol = targetOrientation === 'vertical' ? targetCol : (exitCol === 255 ? gridSize - 2 : 0);

    vehicles.push({
      id: 'target',
      row: startRow,
      col: startCol,
      length: 2,
      orientation: targetOrientation,
      isTarget: true,
      color: '#EF4444',
    });

    // Place blockers perpendicular to the target's path
    const isHorizTarget = targetOrientation === 'horizontal';
    const pathIndices = isHorizTarget
      ? shuffle(Array.from({ length: gridSize - 2 }, (_, i) => i + 2))  // columns to block
      : shuffle(Array.from({ length: gridSize - 2 }, (_, i) => i + 2)); // rows to block

    const minBlock = clamp(Math.floor(minMovesRequired / 5), 1, pathIndices.length);
    const maxBlock = clamp(Math.ceil(maxMovesRequired / 4), minBlock, pathIndices.length);
    const numBlock = minBlock + Math.floor(seededRandom() * (maxBlock - minBlock + 1));

    for (let b = 0; b < numBlock; b++) {
      const idx = pathIndices[b];
      for (let p = 0; p < 25; p++) {
        const length = seededRandom() > 0.4 ? 2 : 3;

        if (isHorizTarget) {
          // Place vertical blockers on target's row
          const minRow = Math.max(0, startRow - length + 1);
          const maxRow = Math.min(gridSize - length, startRow);
          if (minRow > maxRow) continue;
          const row = minRow + Math.floor(seededRandom() * (maxRow - minRow + 1));
          if (canPlace(vehicles, row, idx, length, 'vertical', gridSize)) {
            vehicles.push({ id: `blocker_${b}`, row, col: idx, length, orientation: 'vertical', isTarget: false, color: COLORS[b % COLORS.length] });
            break;
          }
        } else {
          // Place horizontal blockers on target's column
          const minCol = Math.max(0, startCol - length + 1);
          const maxCol = Math.min(gridSize - length, startCol);
          if (minCol > maxCol) continue;
          const col = minCol + Math.floor(seededRandom() * (maxCol - minCol + 1));
          if (canPlace(vehicles, idx, col, length, 'horizontal', gridSize)) {
            vehicles.push({ id: `blocker_${b}`, row: idx, col, length, orientation: 'horizontal', isTarget: false, color: COLORS[b % COLORS.length] });
            break;
          }
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

        // Don't place a same-orientation vehicle on the target's fixed axis
        if (isHorizTarget && orientation === 'horizontal' && row === startRow) continue;
        if (!isHorizTarget && orientation === 'vertical' && col === startCol) continue;

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
    const moves = solvePuzzle(vehicles, gridSize, exitRow, exitCol, bfsLimit).minMoves;

    if (moves >= minMovesRequired && moves <= maxMovesRequired) {
      return {
        id,
        gridSize,
        vehicles,
        exitRow,
        exitCol,
        minMoves: moves,
        updatedAt: Date.now(),
      };


    }

  }

  return null;
}