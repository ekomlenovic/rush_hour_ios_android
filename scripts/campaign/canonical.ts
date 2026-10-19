// Shape of a level up to the 8 symmetries of the square: two levels with the same key are the same puzzle
import type { Level } from '../../store/types';
import { transformLevel } from '../../utils/generator';

function shapeKey(level: Level): string {
  const [target, ...others] = level.vehicles;
  const cell = (v: Level['vehicles'][number]) => `${v.row}${v.col}${v.orientation[0]}${v.length}`;
  return [level.gridSize, level.exitRow, level.exitCol, cell(target), ...others.map(cell).sort()].join(' ');
}

export function canonicalKey(level: Level): string {
  let best = '';
  for (let symmetry = 0; symmetry < 8; symmetry++) {
    const key = shapeKey(transformLevel(level, symmetry));
    if (!best || key < best) best = key;
  }
  return best;
}
