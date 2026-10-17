import type { Level } from '../store/types';
import { sampleLevels } from '../data/sampleLevels';
import { DIFFICULTY_LEVELS, createPRNG } from '../utils/generator';
import { solvePuzzle } from '../utils/solver';
import { applyMoves, toMoveRecord } from '../utils/moveLog';
import { dressVariant, hardStarts, levelVariants, variantSources } from '../utils/variants';

const master = DIFFICULTY_LEVELS.MASTER;
// Quick ones to explore: a 6×6 and a 7×7 level of 40 moves or more
const SOURCES = variantSources(sampleLevels, master).filter(l => [101, 292].includes(l.id));

/** The optimal solution of a level, played by the rules of the game: does it win? */
function solvesByTheRules(level: Level): boolean {
  const solved = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol, 120);
  let vehicles = level.vehicles;
  const moves = solved.moves.map((m, i) => {
    const record = toMoveRecord(vehicles.find(v => v.id === m.vehicleId)!, m.toRow, m.toCol, i)!;
    vehicles = vehicles.map(v => (v.id === m.vehicleId ? { ...v, row: m.toRow, col: m.toCol } : v));
    return record;
  });
  const result = applyMoves(level, moves);
  return solved.minMoves === level.minMoves && result.ok && result.won;
}

describe('variants of the hard levels of the app (hardest duels)', () => {
  it('start from the levels of the range of the difficulty', () => {
    expect(SOURCES.map(l => l.id)).toEqual([101, 292]);
    const sources = variantSources(sampleLevels, master);
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.every(l => l.minMoves >= master.minMovesRequired && l.minMoves <= master.maxMovesRequired)).toBe(true);
  });

  it.each(SOURCES.map(l => [l.id, l] as const))('level %i: every hard start position, its optimum exact (the start one included)', (_, level) => {
    const found = hardStarts(level, level.minMoves - 2, master.maxMovesRequired)!;
    expect(found.total).toBe(found.starts.length);
    expect(found.total).toBeGreaterThan(1);
    const key = (l: { vehicles: Level['vehicles'] }) => JSON.stringify(l.vehicles.map(v => [v.row, v.col]));
    expect(found.starts.find(s => key(s) === key(level))?.minMoves).toBe(level.minMoves);
    // All different, all in range; a few checked by the solver
    expect(new Set(found.starts.map(key)).size).toBe(found.total);
    expect(found.starts.every(s => s.minMoves >= level.minMoves - 2 && s.minMoves <= master.maxMovesRequired)).toBe(true);
    for (const start of found.starts.slice(0, 5)) {
      expect(solvePuzzle(start.vehicles, level.gridSize, level.exitRow, level.exitCol, 120).minMoves).toBe(start.minMoves);
    }
  });

  it('variants: different start positions, turned, colored, solvable by the rules; the same seed gives the same ones', () => {
    const [level] = SOURCES;
    const variants = levelVariants(level, master, 5, 'seed');
    expect(variants).toHaveLength(5);
    for (const v of variants) {
      expect(v.minMoves).toBeGreaterThanOrEqual(Math.max(master.minMovesRequired, level.minMoves - 2));
      expect(solvesByTheRules(v)).toBe(true);
      // The red car stays red
      expect(v.vehicles.find(x => x.isTarget)!.color).toBe(level.vehicles.find(x => x.isTarget)!.color);
    }
    expect(new Set(variants.map(v => JSON.stringify(v.vehicles))).size).toBe(5);
    expect(levelVariants(level, master, 5, 'seed')).toEqual(variants);
  });

  it('dressing a variant again turns and colors it, the puzzle stays the same', () => {
    const [level] = SOURCES;
    const random = createPRNG('x');
    const looks = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const dressed = dressVariant(level, random);
      expect(solvesByTheRules(dressed)).toBe(true);
      looks.add(JSON.stringify(dressed.vehicles));
    }
    expect(looks.size).toBeGreaterThan(3);
  });

  it('explores boards up to the largest one of the app (375 000 positions)', () => {
    const { MAX_STATES } = require('../utils/variants') as typeof import('../utils/variants');
    expect(MAX_STATES).toBeGreaterThanOrEqual(400_000);
  });
});
