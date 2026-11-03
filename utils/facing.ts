import type { Vehicle } from '@/store/types';
import type { Facing } from '@/theme/art/art';

/**
 * Where the front of a drawn vehicle points on the board.
 * The target car always faces its exit (left or right for a horizontal car, up or down for a vertical one);
 * the other vehicles face right when horizontal, up when vertical.
 * The exit is the level's exitRow / exitCol: past the grid on the right or bottom, 255 or negative on the left or top.
 */
export function vehicleFacing(
  vehicle: Pick<Vehicle, 'orientation' | 'isTarget'>,
  exitRow: number,
  exitCol: number,
  gridSize: number,
): Facing {
  const horizontal = vehicle.orientation === 'horizontal';
  if (vehicle.isTarget) {
    if (horizontal && (exitCol === 255 || exitCol < 0)) return 'left';
    if (!horizontal && exitRow >= gridSize && exitRow !== 255) return 'down';
  }
  return horizontal ? 'right' : 'up';
}
