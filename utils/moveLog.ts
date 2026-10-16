import type { Level, MoveRecord, Vehicle } from '../store/types';
import { checkWin, getMoveBounds } from './collision';

/** The move that takes a vehicle to a new position, or null if it does not move along its axis */
export function toMoveRecord(vehicle: Vehicle, newRow: number, newCol: number, t: number): MoveRecord | null {
  const delta = vehicle.orientation === 'horizontal' ? newCol - vehicle.col : newRow - vehicle.row;
  const offAxis = vehicle.orientation === 'horizontal' ? newRow !== vehicle.row : newCol !== vehicle.col;
  if (delta === 0 || offAxis) return null;
  return { vehicleId: vehicle.id, delta, t };
}

/** Why a move log is refused, with the index of the faulty move */
export type MoveLogError =
  | 'invalid_move'      // not a well-formed move (delta not a non-zero integer, bad time…)
  | 'unknown_vehicle'
  | 'blocked'           // goes through a vehicle or out of the grid
  | 'time_backwards'    // times must never decrease
  | 'move_after_win';   // the game is over once the target car is out

export type ApplyMovesResult =
  | { ok: true; vehicles: Vehicle[]; moveCount: number; won: boolean }
  | { ok: false; error: MoveLogError; index: number };

/**
 * Replays a move log from the start position of a level with the rules of the game
 * (same collisions as a drag on the board). Pure: shared by the multiplayer server,
 * which checks a win this way, and by the replay of a game (#46).
 */
export function applyMoves(level: Level, moves: readonly MoveRecord[]): ApplyMovesResult {
  let vehicles = level.vehicles.map(v => ({ ...v }));
  let won = false;
  let lastT = 0;

  for (let index = 0; index < moves.length; index++) {
    const move = moves[index];
    if (!move || typeof move.vehicleId !== 'string' || !Number.isInteger(move.delta) || move.delta === 0
      || typeof move.t !== 'number' || !Number.isFinite(move.t) || move.t < 0) {
      return { ok: false, error: 'invalid_move', index };
    }
    if (won) return { ok: false, error: 'move_after_win', index };
    if (move.t < lastT) return { ok: false, error: 'time_backwards', index };
    lastT = move.t;

    const vehicle = vehicles.find(v => v.id === move.vehicleId);
    if (!vehicle) return { ok: false, error: 'unknown_vehicle', index };

    const { min, max } = getMoveBounds(vehicle, vehicles, level.gridSize);
    const horizontal = vehicle.orientation === 'horizontal';
    const position = (horizontal ? vehicle.col : vehicle.row) + move.delta;
    if (position < min || position > max) return { ok: false, error: 'blocked', index };

    vehicles = vehicles.map(v => v.id !== vehicle.id ? v
      : { ...v, row: horizontal ? v.row : position, col: horizontal ? position : v.col });
    won = checkWin(vehicles, level.exitRow, level.exitCol, level.gridSize);
  }

  return { ok: true, vehicles, moveCount: moves.length, won };
}

/** The move from one position of the board to the next (one vehicle moved), e.g. the opposite of the last move for an undo */
export function diffMove(from: readonly Vehicle[], to: readonly Vehicle[], t: number): MoveRecord | null {
  for (const vehicle of from) {
    const next = to.find(v => v.id === vehicle.id);
    if (next && (next.row !== vehicle.row || next.col !== vehicle.col)) return toMoveRecord(vehicle, next.row, next.col, t);
  }
  return null;
}
