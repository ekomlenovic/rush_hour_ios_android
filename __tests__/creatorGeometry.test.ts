import { hasCollision, vehicleCells, getExitSide, moveExitToSide, getNextAvailableColor, findFreeCell, resizeBoard } from '../utils/creatorGeometry';
import type { Vehicle } from '../store/types';

const car = (id: string, row: number, col: number, orientation: Vehicle['orientation'], length = 2): Vehicle =>
  ({ id, row, col, orientation, length, isTarget: id === 'target', color: '#000' });

describe('vehicleCells', () => {
  it('lists the cells along the orientation', () => {
    expect(vehicleCells(2, 1, 'horizontal', 3)).toEqual([[2, 1], [2, 2], [2, 3]]);
    expect(vehicleCells(0, 4, 'vertical', 2)).toEqual([[0, 4], [1, 4]]);
  });
});

describe('hasCollision', () => {
  const board = [car('target', 2, 0, 'horizontal'), car('v1', 0, 3, 'vertical', 3)];

  it('detects an overlap', () => {
    expect(hasCollision(board, 2, 2, 'horizontal', 2)).toBe(true); // hits v1 at (2,3)
    expect(hasCollision(board, 1, 1, 'vertical', 2)).toBe(true); // hits target at (2,1)
  });

  it('allows free cells and ignores the moved vehicle itself', () => {
    expect(hasCollision(board, 4, 0, 'horizontal', 3)).toBe(false);
    expect(hasCollision(board, 2, 1, 'horizontal', 2, 'target')).toBe(false);
  });
});

describe('exit side', () => {
  it('is read from exitRow / exitCol (255 is top or left)', () => {
    expect(getExitSide(2, 6, 6)).toBe('Right');
    expect(getExitSide(2, 255, 6)).toBe('Left');
    expect(getExitSide(6, 3, 6)).toBe('Bottom');
    expect(getExitSide(255, 3, 6)).toBe('Top');
    expect(getExitSide(2, 3, 6)).toBeNull();
  });

  it('moving it turns the target car and keeps it inside the grid', () => {
    const target = car('target', 5, 4, 'horizontal');
    expect(moveExitToSide(target, 'Bottom', 6)).toEqual({ exitRow: 6, exitCol: 4, target: { orientation: 'vertical', row: 4, col: 4 } });
    expect(moveExitToSide(target, 'Top', 6)).toEqual({ exitRow: 255, exitCol: 4, target: { orientation: 'vertical', row: 4, col: 4 } });
    expect(moveExitToSide(target, 'Right', 6)).toEqual({ exitRow: 5, exitCol: 6, target: { orientation: 'horizontal', row: 5, col: 4 } });
    expect(moveExitToSide(car('target', 1, 5, 'vertical'), 'Left', 6)).toEqual({ exitRow: 1, exitCol: 255, target: { orientation: 'horizontal', row: 1, col: 4 } });
  });
});

describe('getNextAvailableColor', () => {
  const palette = ['#A', '#B', '#EF4444', '#C'];

  it('keeps the base color when unused, else takes the first free one (never the target red)', () => {
    expect(getNextAvailableColor([], '#B', palette)).toBe('#B');
    expect(getNextAvailableColor(['#A', '#B'], '#A', palette)).toBe('#C');
  });
});

describe('findFreeCell', () => {
  it('returns the first free place, row by row', () => {
    const board = [car('target', 0, 0, 'horizontal'), car('v1', 0, 2, 'vertical', 3)];
    expect(findFreeCell(board, 'horizontal', 2, 6)).toEqual({ row: 0, col: 3 });
    expect(findFreeCell(board, 'vertical', 3, 6)).toEqual({ row: 0, col: 3 });
  });

  it('returns null when nothing fits', () => {
    const full = [0, 1].map(r => car(`h${r}`, r, 0, 'horizontal'));
    expect(findFreeCell(full, 'horizontal', 2, 2)).toBeNull();
  });
});

describe('resizeBoard', () => {
  it('keeps every vehicle on a bigger board, and the exit on its side', () => {
    const board = [car('target', 2, 3, 'horizontal'), car('v1', 0, 5, 'vertical', 3), car('v2', 5, 0, 'horizontal', 3)];
    const result = resizeBoard(board, 2, 6, 6, 8);
    expect(result.vehicles).toEqual(board);
    expect([result.exitRow, result.exitCol, result.removed]).toEqual([2, 8, 0]);
  });

  it('drops the vehicles out of a smaller board and pulls the target car back inside', () => {
    const board = [car('target', 6, 3, 'vertical'), car('v1', 0, 0, 'horizontal', 3), car('v2', 7, 0, 'horizontal'), car('v3', 4, 3, 'vertical')];
    // Exit at the bottom of an 8×8 board, shrunk to 6×6: the target goes up to rows 4-5, over v3
    const result = resizeBoard(board, 8, 3, 8, 6);
    expect(result.vehicles.map(v => [v.id, v.row, v.col])).toEqual([['target', 4, 3], ['v1', 0, 0]]);
    expect([result.exitRow, result.exitCol, result.removed]).toEqual([6, 3, 2]);
  });

  it('keeps an exit on the top or left side', () => {
    const result = resizeBoard([car('target', 1, 7, 'vertical')], 255, 7, 8, 7);
    expect(result.vehicles[0]).toMatchObject({ row: 1, col: 6 });
    expect([result.exitRow, result.exitCol]).toEqual([255, 6]);
  });
});
