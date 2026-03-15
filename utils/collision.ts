import { Vehicle } from '@/store/gameStore';

/**
 * Compute how far a vehicle can slide in its constrained axis.
 * Returns { min, max } in GRID CELL units for the vehicle's row (vertical) or col (horizontal).
 */
export function getMoveBounds(
  vehicle: Vehicle,
  allVehicles: Vehicle[],
  gridSize: number
): { min: number; max: number } {
  const others = allVehicles.filter((v) => v.id !== vehicle.id);

  if (vehicle.orientation === 'horizontal') {
    // Vehicle slides along columns (col changes, row fixed)
    let minCol = 0;
    let maxCol = vehicle.isTarget ? gridSize - vehicle.length + 1 : gridSize - vehicle.length;

    for (const other of others) {
      if (other.orientation === 'horizontal') {
        // Same row?
        if (other.row === vehicle.row) {
          const otherEnd = other.col + other.length;
          // other is to the left
          if (otherEnd <= vehicle.col) {
            minCol = Math.max(minCol, otherEnd);
          }
          // other is to the right
          if (other.col >= vehicle.col + vehicle.length) {
            maxCol = Math.min(maxCol, other.col - vehicle.length);
          }
        }
      } else {
        // Vertical vehicle — does it block our row?
        const otherRowStart = other.row;
        const otherRowEnd = other.row + other.length - 1;
        if (vehicle.row >= otherRowStart && vehicle.row <= otherRowEnd) {
          // This vertical vehicle occupies our row at other.col
          if (other.col < vehicle.col) {
            minCol = Math.max(minCol, other.col + 1);
          }
          if (other.col >= vehicle.col + vehicle.length) {
            maxCol = Math.min(maxCol, other.col - vehicle.length);
          }
        }
      }
    }

    return { min: minCol, max: maxCol };
  } else {
    // Vertical: vehicle slides along rows (row changes, col fixed)
    let minRow = 0;
    let maxRow = vehicle.isTarget ? gridSize - vehicle.length + 1 : gridSize - vehicle.length;

    for (const other of others) {
      if (other.orientation === 'vertical') {
        // Same column?
        if (other.col === vehicle.col) {
          const otherEnd = other.row + other.length;
          if (otherEnd <= vehicle.row) {
            minRow = Math.max(minRow, otherEnd);
          }
          if (other.row >= vehicle.row + vehicle.length) {
            maxRow = Math.min(maxRow, other.row - vehicle.length);
          }
        }
      } else {
        // Horizontal vehicle — does it block our col?
        const otherColStart = other.col;
        const otherColEnd = other.col + other.length - 1;
        if (vehicle.col >= otherColStart && vehicle.col <= otherColEnd) {
          if (other.row < vehicle.row) {
            minRow = Math.max(minRow, other.row + 1);
          }
          if (other.row >= vehicle.row + vehicle.length) {
            maxRow = Math.min(maxRow, other.row - vehicle.length);
          }
        }
      }
    }

    return { min: minRow, max: maxRow };
  }
}

/**
 * Check if the target vehicle has reached the exit.
 */
export function checkWin(
  vehicles: Vehicle[],
  exitRow: number,
  exitCol: number,
  gridSize: number
): boolean {
  const target = vehicles.find((v) => v.isTarget);
  if (!target) return false;

  if (target.orientation === 'horizontal') {
    // Target needs to fully pass the exit column
    return target.row === exitRow && target.col + target.length > exitCol;
  } else {
    // Target needs to fully pass the exit row
    return target.col === exitCol && target.row + target.length > exitRow;
  }
}
