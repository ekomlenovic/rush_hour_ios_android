import type { Vehicle } from '@/store/types';
import { TARGET_CAR_COLOR } from '../theme/board';

/** Pure geometry of the level creator */

type Orientation = Vehicle['orientation'];
export type ExitSide = 'Right' | 'Left' | 'Top' | 'Bottom';

/** Grid cells [row, col] covered by a vehicle */
export function vehicleCells(row: number, col: number, orientation: Orientation, length: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let i = 0; i < length; i++) {
    cells.push([
      orientation === 'vertical' ? row + i : row,
      orientation === 'horizontal' ? col + i : col,
    ]);
  }
  return cells;
}

/** Whether a vehicle placed there would overlap one of `vehicles` (except `excludeId`) */
export function hasCollision(
  vehicles: Vehicle[],
  row: number, col: number,
  orientation: Orientation, length: number,
  excludeId?: string,
): boolean {
  const cells = vehicleCells(row, col, orientation, length);
  return vehicles.some(v => {
    if (v.id === excludeId) return false;
    return vehicleCells(v.row, v.col, v.orientation, v.length)
      .some(([vr, vc]) => cells.some(([r, c]) => r === vr && c === vc));
  });
}

/** Exit side encoded by exitRow / exitCol (255 is the top or left side), or null */
export function getExitSide(exitRow: number, exitCol: number, gridSize: number): ExitSide | null {
  if (exitCol >= gridSize && exitCol !== 255) return 'Right';
  if (exitCol === 255) return 'Left';
  if (exitRow >= gridSize && exitRow !== 255) return 'Bottom';
  if (exitRow === 255) return 'Top';
  return null;
}

/**
 * Exit on another side of the grid: the target car takes the matching orientation,
 * stays in its row (or column) and is pulled back inside the grid if needed.
 */
export function moveExitToSide(target: Vehicle, side: ExitSide, gridSize: number): {
  exitRow: number;
  exitCol: number;
  target: Pick<Vehicle, 'orientation' | 'row' | 'col'>;
} {
  const orientation: Orientation = side === 'Right' || side === 'Left' ? 'horizontal' : 'vertical';
  const exitRow = side === 'Bottom' ? gridSize : side === 'Top' ? 255 : target.row;
  const exitCol = side === 'Right' ? gridSize : side === 'Left' ? 255 : target.col;

  return {
    exitRow,
    exitCol,
    target: {
      orientation,
      row: orientation === 'vertical' ? Math.min(target.row, gridSize - target.length) : target.row,
      col: orientation === 'horizontal' ? Math.min(target.col, gridSize - target.length) : target.col,
    },
  };
}

/** The base color if unused, else the first unused palette color (never the target red) */
export function getNextAvailableColor(usedColors: string[], baseColor: string, palette: string[]): string {
  if (!usedColors.includes(baseColor)) return baseColor;
  const available = palette.filter(c => !usedColors.includes(c) && c !== TARGET_CAR_COLOR);
  return available.length > 0 ? available[0] : palette[Math.floor(Math.random() * palette.length)];
}

/** First free top-left cell (row by row) where such a vehicle fits, or null if the board is full */
export function findFreeCell(
  vehicles: Vehicle[],
  orientation: Orientation, length: number,
  gridSize: number,
): { row: number; col: number } | null {
  const maxRow = gridSize - (orientation === 'vertical' ? length : 1);
  const maxCol = gridSize - (orientation === 'horizontal' ? length : 1);
  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col <= maxCol; col++) {
      if (!hasCollision(vehicles, row, col, orientation, length)) return { row, col };
    }
  }
  return null;
}

/**
 * The board after a change of its size: the vehicles that still fit stay where they are,
 * the target car is pulled back inside the grid and keeps its exit side. `removed` vehicles
 * no longer fit (or would overlap the target pulled back): the player is asked first.
 */
export function resizeBoard(
  vehicles: Vehicle[],
  exitRow: number, exitCol: number,
  gridSize: number, newSize: number,
): { vehicles: Vehicle[]; exitRow: number; exitCol: number; removed: number } {
  const side = getExitSide(exitRow, exitCol, gridSize) ?? 'Right';
  const fits = (v: Pick<Vehicle, 'row' | 'col' | 'orientation' | 'length'>) =>
    v.row + (v.orientation === 'vertical' ? v.length : 1) <= newSize
    && v.col + (v.orientation === 'horizontal' ? v.length : 1) <= newSize;

  const target = vehicles.find(v => v.isTarget);
  const movedTarget = target ? {
    ...target,
    row: Math.min(target.row, newSize - (target.orientation === 'vertical' ? target.length : 1)),
    col: Math.min(target.col, newSize - (target.orientation === 'horizontal' ? target.length : 1)),
  } : undefined;
  const kept = vehicles.filter(v => !v.isTarget && fits(v)
    && !(movedTarget && hasCollision([movedTarget], v.row, v.col, v.orientation, v.length)));
  const next = movedTarget ? [movedTarget, ...kept] : kept;

  return {
    vehicles: next,
    exitRow: side === 'Bottom' ? newSize : side === 'Top' ? 255 : movedTarget?.row ?? exitRow,
    exitCol: side === 'Right' ? newSize : side === 'Left' ? 255 : movedTarget?.col ?? exitCol,
    removed: vehicles.length - next.length,
  };
}
