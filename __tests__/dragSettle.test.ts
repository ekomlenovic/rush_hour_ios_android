import type { Vehicle } from '../store/types';
import { settleDrag } from '../utils/dragSettle';

const vehicle = (over: Partial<Vehicle>): Vehicle =>
  ({ id: 'v1', row: 0, col: 0, length: 2, orientation: 'horizontal', isTarget: false, color: '#3B82F6', ...over });

describe('settleDrag (end of a drag)', () => {
  it('plays a drop on another cell, along the vehicle axis', () => {
    const move = jest.fn(() => true);
    expect(settleDrag(vehicle({ row: 2, col: 1 }), 3, move)).toBe('moved');
    expect(move).toHaveBeenLastCalledWith('v1', 2, 3);
    expect(settleDrag(vehicle({ row: 4, col: 5, orientation: 'vertical' }), 3, move)).toBe('moved');
    expect(move).toHaveBeenLastCalledWith('v1', 3, 5);
  });

  it('plays nothing for a drop on its own cell', () => {
    const move = jest.fn(() => true);
    expect(settleDrag(vehicle({ row: 4, col: 5, orientation: 'vertical' }), 4, move)).toBe('stayed');
    expect(move).not.toHaveBeenCalled();
  });

  it('tells a move refused by the game', () => {
    expect(settleDrag(vehicle({ col: 1 }), 2, () => false)).toBe('refused');
  });

  it('plays the way back onto the cell where the drag began (Safari web app, Défi #21)', () => {
    // The vehicle went up from row 4 to row 3, then is dragged back down to row 4. A gesture kept
    // from the render before the first move still saw row 4 and played nothing: drawn on rows 4-5,
    // the game kept it on rows 3-4 and blocked the vehicles around it.
    const move = jest.fn(() => true);
    const now = vehicle({ row: 3, col: 5, orientation: 'vertical' });
    expect(settleDrag(now, 4, move)).toBe('moved');
    expect(move).toHaveBeenCalledWith('v1', 4, 5);
  });
});
