import { DIFFICULTY_LEVELS, createPRNG } from '../utils/generator';
import { MAP_RECIPES, exploreCluster, generateMapLevelChunk, generateMapLevelWith, mapRecipe } from '../utils/mapGenerator';
import { solvePuzzle } from '../utils/solver';
import { sampleLevels } from '../data/sampleLevels';
import { canonicalKey } from '../utils/levelShape';
import type { Level } from '../store/types';

/** A level of the generator, calling it until one comes out, as the app does */
function generate(difficulty: string, gridSize: number, random: () => number, id = 1): Level {
  for (let call = 0; call < 2000; call++) {
    const level = generateMapLevelWith(id, difficulty, gridSize, random);
    if (level) return level;
  }
  throw new Error(`no ${difficulty} ${gridSize}x${gridSize} level`);
}

const solve = (level: Level) => solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);

/** The cells of a level, each one taken at most once and inside the grid */
function expectValidBoard(level: Level) {
  const taken = new Set<string>();
  for (const v of level.vehicles) {
    for (let k = 0; k < v.length; k++) {
      const row = v.orientation === 'vertical' ? v.row + k : v.row;
      const col = v.orientation === 'horizontal' ? v.col + k : v.col;
      expect(row >= 0 && row < level.gridSize && col >= 0 && col < level.gridSize).toBe(true);
      expect(taken.has(`${row},${col}`)).toBe(false);
      taken.add(`${row},${col}`);
    }
  }
  expect(new Set(level.vehicles.map(v => v.id)).size).toBe(level.vehicles.length);
  expect(level.vehicles.filter(v => v.isTarget)).toHaveLength(1);
}

describe('exploreCluster', () => {
  it('gives every position of a board the number of moves of the solver', () => {
    const level = generate('NORMAL', 6, createPRNG('cluster'));
    const cluster = exploreCluster(level.vehicles, level.gridSize, level.exitRow, level.exitCol, 1_000_000)!;
    expect(cluster.count).toBeGreaterThan(50);
    // One position out of a few, the furthest ones included
    const step = Math.max(1, Math.floor(cluster.count / 150));
    let checked = 0;
    for (let s = 0; s < cluster.count; s += step) {
      const vehicles = level.vehicles.map((v, i) => {
        const place = cluster.positions[s * cluster.n + i];
        return v.orientation === 'horizontal' ? { ...v, col: place } : { ...v, row: place };
      });
      expect(solvePuzzle(vehicles, level.gridSize, level.exitRow, level.exitCol).minMoves).toBe(cluster.dist[s]);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
    expect(Math.max(...cluster.dist)).toBe(cluster.maxDist);
  });

  it('agrees with the solver on levels of the campaign, whatever the side of the exit', () => {
    for (const level of sampleLevels.filter(l => l.gridSize === 6).slice(0, 40)) {
      const cluster = exploreCluster(level.vehicles, level.gridSize, level.exitRow, level.exitCol, 1_000_000)!;
      // Position 0 is the board itself
      expect(cluster.dist[0]).toBe(solve(level).minMoves);
    }
  });

  it('gives up on a board over the limit, and on one that cannot be won', () => {
    const level = generate('NORMAL', 6, createPRNG('limit'));
    expect(exploreCluster(level.vehicles, level.gridSize, level.exitRow, level.exitCol, 10)).toBeNull();
    // A truck across the exit that can never move away: the lane is closed
    const blocked = [
      { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal' as const, isTarget: true, color: '#f00' },
      { id: 'a', row: 0, col: 5, length: 3, orientation: 'vertical' as const, isTarget: false, color: '#0f0' },
      { id: 'b', row: 3, col: 5, length: 3, orientation: 'vertical' as const, isTarget: false, color: '#00f' },
    ];
    expect(exploreCluster(blocked, 6, 2, 6, 1_000_000)).toBeNull();
    expect(solvePuzzle(blocked, 6, 2, 6).solvable).toBe(false);
  });
});

describe('map generator', () => {
  it('has a recipe for every difficulty and grid size of the options', () => {
    for (const difficulty of Object.keys(DIFFICULTY_LEVELS)) {
      for (const size of [6, 7, 8]) expect(MAP_RECIPES[difficulty]?.[size]).toBeDefined();
    }
  });

  it.each([
    ['EASY', 6], ['EASY', 7], ['EASY', 8],
    ['NORMAL', 6], ['NORMAL', 7], ['NORMAL', 8],
    ['HARD', 6], ['HARD', 7], ['HARD', 8],
    ['EXPERT', 6], ['EXPERT', 7],
  ] as const)('makes %s %dx%d levels in the range of the difficulty, with the moves of the solver', (difficulty, size) => {
    const random = createPRNG(`${difficulty}-${size}`);
    const { minMovesRequired, maxMovesRequired } = DIFFICULTY_LEVELS[difficulty];
    for (let i = 0; i < 2; i++) {
      const level = generate(difficulty, size, random, 500 + i);
      expect(level.id).toBe(500 + i);
      expect(level.gridSize).toBe(size);
      expectValidBoard(level);
      expect(level.minMoves).toBeGreaterThanOrEqual(minMovesRequired);
      expect(level.minMoves).toBeLessThanOrEqual(maxMovesRequired);
      expect(solve(level).minMoves).toBe(level.minMoves);
    }
  }, 120_000);

  it('makes varied levels: no duplicate even mirrored or rotated, every exit side, several sizes of board', () => {
    const random = createPRNG('variety');
    const levels = Array.from({ length: 40 }, () => generate('HARD', 6, random));
    expect(new Set(levels.map(canonicalKey)).size).toBe(levels.length);
    expect(new Set(levels.map(l => `${l.exitRow === 255 || l.exitRow === 6}${l.exitRow === 255 || l.exitCol === 255}`)).size).toBe(4);
    expect(new Set(levels.map(l => l.vehicles.length)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(levels.map(l => l.minMoves)).size).toBeGreaterThanOrEqual(4);
  }, 120_000);

  it('varies how full and how made of trucks the dense boards are (Normal 8x8)', () => {
    // One level out of three, by its id, is made with more free cells
    expect(mapRecipe('NORMAL', 8, 1002).freeCells).toEqual(MAP_RECIPES.NORMAL[8].alternate!.freeCells);
    expect(mapRecipe('NORMAL', 8, 1001).freeCells).toEqual(MAP_RECIPES.NORMAL[8].freeCells);
    expect(mapRecipe('HARD', 8, 1002)).toBe(MAP_RECIPES.HARD[8]);

    const random = createPRNG('dense');
    const levels = Array.from({ length: 9 }, (_, i) => generate('NORMAL', 8, random, 1000 + i));
    const counts = levels.map(l => l.vehicles.length);
    const trucks = levels.map(l => l.vehicles.filter(v => v.length === 3).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...trucks) - Math.min(...trucks)).toBeGreaterThanOrEqual(4);
    for (const level of levels) expect(solve(level).minMoves).toBe(level.minMoves);
  }, 120_000);

  it('draws with Math.random in the app: an unknown difficulty or size still gives a level or nothing, never an error', () => {
    const level = generateMapLevelChunk(7, 'EASY', 6);
    if (level) expectValidBoard(level);
    expect(() => generateMapLevelChunk(7, 'UNKNOWN', 9)).not.toThrow();
  });
});
