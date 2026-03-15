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
    // Current bounds
    let minCol = 0;
    let maxCol = gridSize - vehicle.length;

    // IF target vehicle, it might go BEYOND the grid if the exit is at col -1 or col gridSize
    // But getMoveBounds is used for visual snapping. 
    // Usually, the game "wins" when it hits the boundary.
    // However, if we want to allow smooth sliding OFF the board, we'd increase bounds.
    // For now, let's keep it tight but allow +1 if it is the target car.
    // Looking at Rust: exitCol = gs (Right) or 255 (Left).
    // TypeScript checkWin will trigger as soon as it TOUCHES the exit.

    for (const other of others) {
      if (other.orientation === 'horizontal') {
        if (other.row === vehicle.row) {
          const otherEnd = other.col + other.length;
          // Strictly to the left
          if (otherEnd <= vehicle.col) {
            minCol = Math.max(minCol, otherEnd);
          } 
          // Strictly to the right
          else if (other.col >= vehicle.col + vehicle.length) {
            maxCol = Math.min(maxCol, other.col - vehicle.length);
          }
          // Overlap case: find the side based on relative centers
          else {
            const vehicleCenter = vehicle.col + vehicle.length / 2;
            const otherCenter = other.col + other.length / 2;
            if (otherCenter < vehicleCenter) {
              minCol = Math.max(minCol, otherEnd);
            } else {
              maxCol = Math.min(maxCol, other.col - vehicle.length);
            }
          }
        }
      } else {
        const otherRowStart = other.row;
        const otherRowEnd = other.row + other.length - 1;
        if (vehicle.row >= otherRowStart && vehicle.row <= otherRowEnd) {
          // Vertical car is only at other.col
          if (other.col < vehicle.col) {
            minCol = Math.max(minCol, other.col + 1);
          } else if (other.col >= vehicle.col + vehicle.length) {
            maxCol = Math.min(maxCol, other.col - vehicle.length);
          } else {
            // Overlap (should not happen in valid state)
            const vehicleCenter = vehicle.col + vehicle.length / 2;
            if (other.col < vehicleCenter) {
              minCol = Math.max(minCol, other.col + 1);
            } else {
              maxCol = Math.min(maxCol, other.col - vehicle.length);
            }
          }
        }
      }
    }

    return { min: minCol, max: maxCol };
  } else {
    let minRow = 0;
    let maxRow = gridSize - vehicle.length;

    for (const other of others) {
      if (other.orientation === 'vertical') {
        if (other.col === vehicle.col) {
          const otherEnd = other.row + other.length;
          if (otherEnd <= vehicle.row) {
            minRow = Math.max(minRow, otherEnd);
          } else if (other.row >= vehicle.row + vehicle.length) {
            maxRow = Math.min(maxRow, other.row - vehicle.length);
          } else {
            const vehicleCenter = vehicle.row + vehicle.length / 2;
            const otherCenter = other.row + other.length / 2;
            if (otherCenter < vehicleCenter) {
              minRow = Math.max(minRow, otherEnd);
            } else {
              maxRow = Math.min(maxRow, other.row - vehicle.length);
            }
          }
        }
      } else {
        const otherColStart = other.col;
        const otherColEnd = other.col + other.length - 1;
        if (vehicle.col >= otherColStart && vehicle.col <= otherColEnd) {
          if (other.row < vehicle.row) {
            minRow = Math.max(minRow, other.row + 1);
          } else if (other.row >= vehicle.row + vehicle.length) {
            maxRow = Math.min(maxRow, other.row - vehicle.length);
          } else {
            const vehicleCenter = vehicle.row + vehicle.length / 2;
            if (other.row < vehicleCenter) {
              minRow = Math.max(minRow, other.row + 1);
            } else {
              maxRow = Math.min(maxRow, other.row - vehicle.length);
            }
          }
        }
      }
    }

    return { min: minRow, max: maxRow };
  }
}

/**
 * Check if the target vehicle has reached the exit.
 * exitRow/exitCol can be:
 * - Right: exitCol = gridSize
 * - Left:  exitCol = 255 (or -1)
 * - Bottom: exitRow = gridSize
 * - Top:    exitRow = 255 (or -1)
 */
export function checkWin(
  vehicles: Vehicle[],
  exitRow: number,
  exitCol: number,
  gridSize: number
): boolean {
  const target = vehicles.find((v) => v.isTarget);
  if (!target) return false;

  // Normalize 255 to -1 for simplicity
  const exR = exitRow === 255 ? -1 : exitRow;
  const exC = exitCol === 255 ? -1 : exitCol;

  if (target.orientation === 'horizontal') {
    if (target.row !== exR) return false;
    // Exit on the right
    if (exC >= gridSize) return target.col + target.length >= gridSize;
    // Exit on the left
    if (exC < 0) return target.col <= 0;
  } else {
    if (target.col !== exC) return false;
    // Exit on the bottom
    if (exR >= gridSize) return target.row + target.length >= gridSize;
    // Exit on the top
    if (exR < 0) return target.row <= 0;
  }
  return false;
}
