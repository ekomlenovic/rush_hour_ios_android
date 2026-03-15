import { runOnUI, runOnJS } from 'react-native-reanimated';
import { solvePuzzle, Move, SolverResult } from './solver';
import { Vehicle } from '../store/gameStore';

/**
 * Background version of solvePuzzle using Reanimated's UI thread.
 * This prevents the Main JS thread from hanging during complex computations.
 */
export async function solvePuzzleAsync(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  depthLimit: number = 200
): Promise<SolverResult> {
  return new Promise((resolve) => {
    runOnUI(() => {
      'worklet';
      const result = solvePuzzle(vehicles, gridSize, exitRow, exitCol, depthLimit);
      runOnJS(resolve)(result);
    })();
  });
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
