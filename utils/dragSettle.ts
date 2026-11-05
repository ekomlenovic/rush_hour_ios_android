import type { Vehicle } from '@/store/types';

/** What became of a released drag: played, refused by the game, or dropped on its own cell */
export type DragOutcome = 'moved' | 'refused' | 'stayed';

/**
 * Ends a drag released on `cell` (column of a horizontal vehicle, row of a vertical one).
 * Always compared with the vehicle as the game has it now, never with the position seen when
 * the drag began: a gesture kept from an earlier render (Safari web app) knew an old cell, took
 * a drop back onto it for "no move" and left the vehicle drawn on a cell the game had left.
 */
export function settleDrag(
  vehicle: Vehicle,
  cell: number,
  onMoveEnd: (vehicleId: string, newRow: number, newCol: number) => boolean | void,
): DragOutcome {
  const horizontal = vehicle.orientation === 'horizontal';
  if (cell === (horizontal ? vehicle.col : vehicle.row)) return 'stayed';
  const played = onMoveEnd(vehicle.id, horizontal ? vehicle.row : cell, horizontal ? cell : vehicle.col);
  return played === false ? 'refused' : 'moved';
}
