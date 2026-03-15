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
};

const COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#64748B', '#14B8A6',
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

    const pathCols = shuffle([2, 3, 4, 5]);
    const minBlock = clamp(Math.floor(minMovesRequired / 5), 1, 4);
    const maxBlock = clamp(Math.ceil(maxMovesRequired / 4), minBlock, 4);
    const numBlock = minBlock + Math.floor(Math.random() * (maxBlock - minBlock + 1));

    for (let b = 0; b < numBlock; b++) {
      const col = pathCols[b];
      for (let p = 0; p < 25; p++) {
        const length = Math.random() > 0.4 ? 2 : 3;
        const minRow = Math.max(0, targetRow - length + 1);
        const maxRow = Math.min(gridSize - length, targetRow);
        if (minRow > maxRow) continue;

        const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
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

    const targetCount = minVehicles + Math.floor(Math.random() * (maxVehicles - minVehicles + 1));
    let stalls = 0;
    while (vehicles.length < targetCount + 1 && stalls < 6) {
      let placed = false;
      for (let p = 0; p < 40; p++) {
        const orientation: 'horizontal' | 'vertical' = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        const length = Math.random() > 0.3 ? 2 : 3;
        const row = Math.floor(Math.random() * gridSize);
        const col = Math.floor(Math.random() * gridSize);

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
      };
    }
  }

  return null;
}