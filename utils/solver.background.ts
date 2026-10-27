import { runOnSolverRuntime } from './solverRuntime';
import { solvePuzzle, validateLevel, Move, SolverResult } from './solver';
import { decodeSharedLevel, withOptimum } from './sharing';
import type { Level, Vehicle } from '../store/types';

/**
 * Background versions of the solver, on the solver runtime (utils/solverRuntime.ts): a thread
 * of its own, so a long search never freezes the screen.
 */
export { runOnSolverRuntime };

export function solvePuzzleAsync(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  depthLimit: number = 200
): Promise<SolverResult> {
  return runOnSolverRuntime(solvePuzzle, vehicles, gridSize, exitRow, exitCol, depthLimit, Infinity);
}

/**
 * Background version of getHint.
 */
export async function getHintAsync(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number
): Promise<Move | null> {
  const result = await solvePuzzleAsync(vehicles, gridSize, exitRow, exitCol);
  if (!result.solvable || result.moves.length === 0) return null;
  return result.moves[0];
}

/** Background version of validateLevel: the optimum, -1 if unsolvable, -2 if too big to search */
export function validateLevelAsync(vehicles: Vehicle[], gridSize: number, exitRow: number, exitCol: number): Promise<number> {
  return runOnSolverRuntime(validateLevel, vehicles, gridSize, exitRow, exitCol);
}

/** parseSharedLevel (utils/sharing.ts) solved in the background: a forged link never freezes the app */
export async function parseSharedLevelAsync(data: string, id: number = Date.now()): Promise<Level | null> {
  const level = decodeSharedLevel(data, id);
  return level && withOptimum(level, await validateLevelAsync(level.vehicles, level.gridSize, level.exitRow, level.exitCol));
}
