import { solvePuzzle as solve } from '../../utils/solver';
import { toMoveRecord } from '../../utils/moveLog';
import type { Level, MoveRecord, Vehicle } from '../src/core';

export { applyMoves } from '../src/core';

/** The optimal solution of a puzzle as a move log */
export function solvePuzzle(level: Level): MoveRecord[] {
  let vehicles: Vehicle[] = level.vehicles;
  return solve(level.vehicles, level.gridSize, level.exitRow, level.exitCol).moves.map((m, i) => {
    const v = vehicles.find(x => x.id === m.vehicleId)!;
    vehicles = vehicles.map(x => (x.id === m.vehicleId ? { ...x, row: m.toRow, col: m.toCol } : x));
    return toMoveRecord(v, m.toRow, m.toCol, i * 1000)!;
  });
}
