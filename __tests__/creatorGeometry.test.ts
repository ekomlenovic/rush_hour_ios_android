import { hasCollision, vehicleCells, getExitSide, moveExitToSide, getNextAvailableColor } from '../utils/creatorGeometry';
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
