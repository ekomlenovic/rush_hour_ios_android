import { vehiclesAtStep } from '../utils/solutionReplay';
import { getMoveDirection } from '../utils/accessibility';
import { solvePuzzle } from '../utils/solver';
import { checkWin } from '../utils/collision';
import { sampleLevels } from '../data/sampleLevels';

const level = sampleLevels[0];
const { moves } = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);

describe('solution replay (rules in docs/GAME_DESIGN.md)', () => {
  it('starts from the level start and does not modify it', () => {
    const snapshot = JSON.stringify(level.vehicles);
    expect(vehiclesAtStep(level.vehicles, moves, 0)).toEqual(level.vehicles);
    vehiclesAtStep(level.vehicles, moves, moves.length);
    expect(JSON.stringify(level.vehicles)).toBe(snapshot);
  });

  it('wins exactly at the last move of the optimal solution', () => {
    expect(moves).toHaveLength(level.minMoves);
    for (let step = 0; step < moves.length; step++) {
      const v = vehiclesAtStep(level.vehicles, moves, step);
      expect(checkWin(v, level.exitRow, level.exitCol, level.gridSize)).toBe(false);
    }
    expect(checkWin(vehiclesAtStep(level.vehicles, moves, moves.length), level.exitRow, level.exitCol, level.gridSize)).toBe(true);
  });

  it('going back one move restores the previous positions', () => {
    const step = Math.floor(moves.length / 2);
    const forward = vehiclesAtStep(level.vehicles, moves, step + 1);
    const back = vehiclesAtStep(level.vehicles, moves, step);
    const moved = moves[step];
    expect(forward.filter(v => v.id !== moved.vehicleId)).toEqual(back.filter(v => v.id !== moved.vehicleId));
    expect(forward.find(v => v.id === moved.vehicleId)).toMatchObject({ row: moved.toRow, col: moved.toCol });
  });

  it('keeps the vehicles order (their letters stay the same)', () => {
    expect(vehiclesAtStep(level.vehicles, moves, 3).map(v => v.id)).toEqual(level.vehicles.map(v => v.id));
  });

  it('clamps out of range steps', () => {
    expect(vehiclesAtStep(level.vehicles, moves, -2)).toEqual(level.vehicles);
    expect(vehiclesAtStep(level.vehicles, moves, 999)).toEqual(vehiclesAtStep(level.vehicles, moves, moves.length));
  });
});

describe('getMoveDirection', () => {
  it('reads the direction along the vehicle axis', () => {
    expect(getMoveDirection({ row: 2, col: 1, orientation: 'horizontal' }, { toRow: 2, toCol: 3 })).toBe('right');
    expect(getMoveDirection({ row: 2, col: 3, orientation: 'horizontal' }, { toRow: 2, toCol: 0 })).toBe('left');
    expect(getMoveDirection({ row: 1, col: 4, orientation: 'vertical' }, { toRow: 3, toCol: 4 })).toBe('down');
    expect(getMoveDirection({ row: 3, col: 4, orientation: 'vertical' }, { toRow: 0, toCol: 4 })).toBe('up');
  });
});
