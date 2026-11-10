import type { Vehicle } from '@/store/types';
import type { Facing } from '@/theme/art/art';

/**
 * A number from 0 to 2^32 - 1 drawn from `text` (FNV-1a): the same text always gives the same number.
 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Where the front of a drawn vehicle points on the board.
 * The target car always faces its exit (left or right for a horizontal car, up or down for a vertical one).
 * The other vehicles face one way or the other along their axis, picked at random but always the same for a
 * given vehicle of a given level: drawn from what does not change while it moves (its id, length, axis, lane)
 * and from the exit, so it never turns around during a game, an undo or a replay. Purely visual.
 * The exit is the level's exitRow / exitCol: past the grid on the right or bottom, 255 or negative on the left or top.
 */
export function vehicleFacing(
  vehicle: Pick<Vehicle, 'id' | 'row' | 'col' | 'length' | 'orientation' | 'isTarget'>,
  exitRow: number,
  exitCol: number,
  gridSize: number,
): Facing {
  const horizontal = vehicle.orientation === 'horizontal';
  if (vehicle.isTarget) {
    if (horizontal && (exitCol === 255 || exitCol < 0)) return 'left';
    if (!horizontal && exitRow >= gridSize && exitRow !== 255) return 'down';
    return horizontal ? 'right' : 'up';
  }
  // Its lane: the row of a horizontal vehicle, the column of a vertical one, the same wherever it slides
  const lane = horizontal ? vehicle.row : vehicle.col;
  const flipped = (hash(`${vehicle.id}|${vehicle.length}|${vehicle.orientation}|${lane}|${exitRow}|${exitCol}|${gridSize}`) & 1) === 1;
  if (horizontal) return flipped ? 'left' : 'right';
  return flipped ? 'down' : 'up';
}
