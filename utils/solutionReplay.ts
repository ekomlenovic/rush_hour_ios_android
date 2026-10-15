import type { Vehicle } from '@/store/types';
import type { Move } from './solver';

/** Positions of the vehicles after the first `step` moves of a solution (0 is the start) */
export function vehiclesAtStep(initial: Vehicle[], moves: Move[], step: number): Vehicle[] {
  const positions = new Map(initial.map(v => [v.id, { row: v.row, col: v.col }]));
  for (const move of moves.slice(0, Math.max(0, step))) {
    positions.set(move.vehicleId, { row: move.toRow, col: move.toCol });
  }
  return initial.map(v => ({ ...v, ...positions.get(v.id) }));
}
