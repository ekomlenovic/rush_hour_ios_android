import type { Level, Vehicle } from '../store/types';
import { createPRNG, shuffleWith, transformLevel, type DifficultyConfig } from './generator';
import { checkWin, getMoveBounds } from './collision';
import { solvePuzzle } from './solver';

/**
 * Variants of hand-checked hard levels (the levels of the app), for the hardest duels:
 * generating a master puzzle from scratch can take many minutes, a variant takes
 * milliseconds to seconds. A variant is one of these levels turned or mirrored (8
 * symmetries, same difficulty), started from another position of the same board (a few
 * random moves, then solved again to stay in the range of the difficulty), with its
 * colors shuffled. The same seed always gives the same variant.
 */

/** Random walks tried before keeping the level only turned (always in range) */
const WALKS = 20;
/** A variant may be this much easier than its level, no more: random moves tend to get closer to the exit */
const MAX_EASIER = 2;
/** Longest random walk from the start position */
const MAX_WALK = 12;

/** The levels of a difficulty: their optimum in its range */
export function variantSources(levels: readonly Level[], config: DifficultyConfig): Level[] {
  return levels.filter(l => l.minMoves >= config.minMovesRequired && l.minMoves <= config.maxMovesRequired);
}

/** A few random moves from a position (never the winning one) */
function randomWalk(level: Level, random: () => number): Vehicle[] {
  let vehicles = level.vehicles.map(v => ({ ...v }));
  const steps = 1 + Math.floor(random() * MAX_WALK);
  for (let s = 0; s < steps; s++) {
    const vehicle = vehicles[Math.floor(random() * vehicles.length)];
    const { min, max } = getMoveBounds(vehicle, vehicles, level.gridSize);
    if (max <= min) continue;
    const current = vehicle.orientation === 'horizontal' ? vehicle.col : vehicle.row;
    let position = min + Math.floor(random() * (max - min));
    if (position >= current) position++;
    const moved = vehicle.orientation === 'horizontal' ? { ...vehicle, col: position } : { ...vehicle, row: position };
    const next = vehicles.map(v => (v.id === vehicle.id ? moved : v));
    if (checkWin(next, level.exitRow, level.exitCol, level.gridSize)) continue;
    vehicles = next;
  }
  return vehicles;
}

/** A variant of one of the levels of the range of `config`; null if there is none to start from */
export function levelVariant(levels: readonly Level[], seed: string, id: number, config: DifficultyConfig): Level | null {
  const sources = variantSources(levels, config);
  if (sources.length === 0) return null;
  const random = createPRNG(seed);
  const source = sources[Math.floor(random() * sources.length)];
  const turned = transformLevel(source, Math.floor(random() * 8));

  // As hard as its level, or nearly
  const lowest = Math.max(config.minMovesRequired, source.minMoves - MAX_EASIER);
  let variant: Level = turned;
  for (let walk = 0; walk < WALKS; walk++) {
    const vehicles = randomWalk(turned, random);
    const { minMoves } = solvePuzzle(vehicles, turned.gridSize, turned.exitRow, turned.exitCol, config.maxMovesRequired + 10);
    if (minMoves >= lowest && minMoves <= config.maxMovesRequired) {
      variant = { ...turned, vehicles, minMoves };
      break;
    }
  }

  // Other colors: the same board does not look the same
  const colors = shuffleWith(variant.vehicles.filter(v => !v.isTarget).map(v => v.color), random);
  let next = 0;
  const vehicles = variant.vehicles.map(v => (v.isTarget ? v : { ...v, color: colors[next++] }));
  return { ...variant, id, vehicles, updatedAt: 0 };
}
