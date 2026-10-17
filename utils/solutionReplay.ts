import type { MoveRecord, Vehicle } from '@/store/types';
import type { Move } from './solver';

/** Positions of the vehicles after the first `step` moves of a solution (0 is the start) */
export function vehiclesAtStep(initial: Vehicle[], moves: Move[], step: number): Vehicle[] {
  const positions = new Map(initial.map(v => [v.id, { row: v.row, col: v.col }]));
  for (const move of moves.slice(0, Math.max(0, step))) {
    positions.set(move.vehicleId, { row: move.toRow, col: move.toCol });
  }
  return initial.map(v => ({ ...v, ...positions.get(v.id) }));
}

/** The moves of a move log (the player's own solution) as solution moves, from the starting position */
export function movesFromLog(initial: Vehicle[], log: readonly MoveRecord[]): Move[] {
  const positions = new Map(initial.map(v => [v.id, { row: v.row, col: v.col }]));
  const moves: Move[] = [];
  for (const record of log) {
    const vehicle = initial.find(v => v.id === record.vehicleId);
    const position = positions.get(record.vehicleId);
    if (!vehicle || !position) continue;
    const next = vehicle.orientation === 'horizontal'
      ? { row: position.row, col: position.col + record.delta }
      : { row: position.row + record.delta, col: position.col };
    positions.set(vehicle.id, next);
    moves.push({ vehicleId: vehicle.id, toRow: next.row, toCol: next.col });
  }
  return moves;
}
