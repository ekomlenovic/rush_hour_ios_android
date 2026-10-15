import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets';
import { solvePuzzle, Move, SolverResult } from './solver';
import { generateLevel, randomSeed, type DifficultyConfig } from './generator';
import type { Level, Vehicle } from '../store/gameStore';

/**
 * Heavy computations (solver, level generation) run on a dedicated worklet runtime:
 * a background thread, so neither the JS thread (touches, buttons) nor the UI thread
 * (animations) freezes. Falls back to the JS thread if the runtime is not available.
 */
let runtime: WorkletRuntime | null = null;
let runtimeFailed = false;

function getRuntime(): WorkletRuntime | null {
  if (runtime || runtimeFailed) return runtime;
  try {
    runtime = createWorkletRuntime({ name: 'rush-hour-compute' });
  } catch (e) {
    console.warn('Background runtime unavailable, computing on the JS thread', e);
    runtimeFailed = true;
  }
  return runtime;
}

/** Solves a board on the background thread */
export async function solvePuzzleAsync(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  depthLimit: number = 200
): Promise<SolverResult> {
  const background = getRuntime();
  if (!background) return solvePuzzle(vehicles, gridSize, exitRow, exitCol, depthLimit);
  return runOnRuntimeAsync(background, (v: Vehicle[], g: number, r: number, c: number, d: number) => {
    'worklet';
    return solvePuzzle(v, g, r, c, d);
  }, vehicles, gridSize, exitRow, exitCol, depthLimit);
}

/** First move of an optimal solution, computed on the background thread */
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

/** Generates a level on the background thread (same seed, same level) */
export async function generateLevelAsync(id: number, config: DifficultyConfig, seed: string = randomSeed()): Promise<Level | null> {
  const background = getRuntime();
  if (!background) return generateLevel(id, config, seed);
  return runOnRuntimeAsync(background, (levelId: number, difficulty: DifficultyConfig, levelSeed: string) => {
    'worklet';
    return generateLevel(levelId, difficulty, levelSeed);
  }, id, config, seed);
}
