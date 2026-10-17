import { sampleLevels } from '../data/sampleLevels';
import { DIFFICULTY_LEVELS } from '../utils/generator';
import { solvePuzzle } from '../utils/solver';
import { applyMoves, toMoveRecord } from '../utils/moveLog';
import { levelVariant, variantSources } from '../utils/variants';

describe('variants of the hard levels of the app (hardest duels)', () => {
  const master = DIFFICULTY_LEVELS.MASTER;

  it('start from the levels of the range of the difficulty', () => {
    const sources = variantSources(sampleLevels, master);
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.every(l => l.minMoves >= master.minMovesRequired && l.minMoves <= master.maxMovesRequired)).toBe(true);
  });

  it.each(['duel:a', 'duel:b', 'duel:c', 'duel:d'])('%s: a solvable puzzle of the difficulty, its optimum checked by the solver', (seed) => {
    const variant = levelVariant(sampleLevels, seed, 999, master)!;
    expect(variant.id).toBe(999);
    expect(variant.minMoves).toBeGreaterThanOrEqual(master.minMovesRequired);
    expect(variant.minMoves).toBeLessThanOrEqual(master.maxMovesRequired);
    const solved = solvePuzzle(variant.vehicles, variant.gridSize, variant.exitRow, variant.exitCol, 120);
    expect(solved.minMoves).toBe(variant.minMoves);
    // Its solution plays by the rules of the game, and wins
    let vehicles = variant.vehicles;
    const moves = solved.moves.map((m, i) => {
      const record = toMoveRecord(vehicles.find(v => v.id === m.vehicleId)!, m.toRow, m.toCol, i)!;
      vehicles = vehicles.map(v => (v.id === m.vehicleId ? { ...v, row: m.toRow, col: m.toCol } : v));
      return record;
    });
    expect(applyMoves(variant, moves)).toMatchObject({ ok: true, won: true });
    // The red car stays red
    expect(variant.vehicles.find(v => v.isTarget)!.color).toBe(sampleLevels[0].vehicles.find(v => v.isTarget)!.color);
  });

  it('the same seed gives the same variant, another seed another one', () => {
    const boards = (seed: string) => JSON.stringify(levelVariant(sampleLevels, seed, 1, master)!.vehicles);
    expect(boards('duel:x')).toBe(boards('duel:x'));
    const distinct = new Set(['1', '2', '3', '4', '5', '6', '7', '8'].map(s => boards(`duel:${s}`)));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it('nothing to start from: null', () => {
    expect(levelVariant(sampleLevels, 'duel:x', 1, { ...master, minMovesRequired: 500, maxMovesRequired: 600 })).toBeNull();
  });
});
