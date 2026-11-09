import {
  batchConfig, buildGenerationPlan, clampAmount, clampMinMoves, movesRange, planTotal, shareOut,
  DEFAULT_DIFFICULTY_PARTS, DEFAULT_GRID_SIZE_PARTS, MAX_GENERATION_AMOUNT,
  GENERATION_DIFFICULTIES, GENERATION_GRID_SIZES, type DifficultyParts, type GenerationBatch,
} from '../utils/generationPlan';
import { DIFFICULTY_LEVELS, generateLevel } from '../utils/generator.core';

const NONE: DifficultyParts = { EASY: 0, NORMAL: 0, HARD: 0, EXPERT: 0, MASTER: 0 };
const perDifficulty = (plan: GenerationBatch[], d: string) => plan.filter(b => b.difficulty === d).reduce((s, b) => s + b.count, 0);
const perSize = (plan: GenerationBatch[], size: number) => plan.filter(b => b.gridSize === size).reduce((s, b) => s + b.count, 0);

describe('number of levels typed by the player', () => {
  it('stays between 1 and the maximum, whole', () => {
    expect(clampAmount(20)).toBe(20);
    expect(clampAmount(50)).toBe(50);
    expect(clampAmount(0)).toBe(1);
    expect(clampAmount(-3)).toBe(1);
    expect(clampAmount(12.9)).toBe(12);
    expect(clampAmount(NaN)).toBe(1);
    expect(clampAmount(100000)).toBe(MAX_GENERATION_AMOUNT);
  });
});

describe('shareOut', () => {
  it('always gives every level, to the nearest whole one', () => {
    expect(shareOut(10, [1, 1])).toEqual([5, 5]);
    expect(shareOut(10, [2, 1])).toEqual([7, 3]);
    expect(shareOut(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(shareOut(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(shareOut(20, [3, 0, 1])).toEqual([15, 0, 5]);
  });

  it('gives nothing without parts', () => {
    expect(shareOut(10, [0, 0])).toEqual([0, 0]);
    expect(shareOut(0, [1, 1])).toEqual([0, 0]);
  });
});

describe('buildGenerationPlan', () => {
  it('is what the generator made before the proportions: Normal 6x6', () => {
    expect(buildGenerationPlan(3, DEFAULT_DIFFICULTY_PARTS, DEFAULT_GRID_SIZE_PARTS)).toEqual([{ difficulty: 'NORMAL', gridSize: 6, count: 3 }]);
  });

  it('gives each difficulty and each grid size exactly its share', () => {
    const plan = buildGenerationPlan(20, { ...NONE, NORMAL: 2, HARD: 1, EXPERT: 1 }, { 6: 3, 7: 1, 8: 1 });
    expect(planTotal(plan)).toBe(20);
    expect(['NORMAL', 'HARD', 'EXPERT'].map(d => perDifficulty(plan, d))).toEqual([10, 5, 5]);
    expect([6, 7, 8].map(s => perSize(plan, s))).toEqual([12, 4, 4]);
  });

  it('spreads the grid sizes over the difficulties', () => {
    const plan = buildGenerationPlan(50, { ...NONE, EASY: 1, HARD: 1 }, { 6: 1, 7: 1, 8: 0 });
    // Not "every Easy level in 6x6, every Hard one in 7x7"
    for (const batch of plan) expect(batch.count).toBeGreaterThanOrEqual(10);
    expect(plan).toHaveLength(4);
  });

  it('goes from the easiest to the hardest, small grids first', () => {
    const plan = buildGenerationPlan(30, { EASY: 1, NORMAL: 1, HARD: 1, EXPERT: 1, MASTER: 1 }, { 6: 1, 7: 1, 8: 1 });
    const rank = plan.map(b => GENERATION_DIFFICULTIES.indexOf(b.difficulty) * 10 + b.gridSize);
    expect(rank).toEqual([...rank].sort((a, b) => a - b));
  });

  it('keeps the shares exact for every number of levels', () => {
    const difficulties = { EASY: 1, NORMAL: 3, HARD: 2, EXPERT: 0, MASTER: 1 };
    const sizes = { 6: 2, 7: 1, 8: 1 };
    for (let amount = 1; amount <= MAX_GENERATION_AMOUNT; amount++) {
      const plan = buildGenerationPlan(amount, difficulties, sizes);
      expect(planTotal(plan)).toBe(amount);
      expect(GENERATION_DIFFICULTIES.map(d => perDifficulty(plan, d))).toEqual(shareOut(amount, GENERATION_DIFFICULTIES.map(d => difficulties[d])));
      expect(GENERATION_GRID_SIZES.map(s => perSize(plan, s))).toEqual(shareOut(amount, GENERATION_GRID_SIZES.map(s => sizes[s])));
    }
  });

  it('is empty when a proportion has no part at all', () => {
    expect(buildGenerationPlan(10, NONE, DEFAULT_GRID_SIZE_PARTS)).toEqual([]);
    expect(buildGenerationPlan(10, DEFAULT_DIFFICULTY_PARTS, { 6: 0, 7: 0, 8: 0 })).toEqual([]);
  });
});

describe('minimum of moves chosen by the player, per difficulty', () => {
  it('is nothing when the field is empty, and never over the most moves of the difficulty', () => {
    expect(clampMinMoves(NaN, 'HARD')).toBeNull();
    expect(clampMinMoves(0, 'HARD')).toBeNull();
    expect(clampMinMoves(18, 'HARD')).toBe(18);
    expect(clampMinMoves(8, 'HARD')).toBe(8);
    expect(clampMinMoves(99, 'HARD')).toBe(25);
    expect(clampMinMoves(99, 'MASTER')).toBe(80);
    expect(movesRange('HARD')).toEqual({ min: 15, max: 25 });
  });

  it('is carried by the batches of its difficulty only', () => {
    const plan = buildGenerationPlan(4, { ...NONE, EASY: 1, HARD: 1 }, DEFAULT_GRID_SIZE_PARTS, { HARD: 20, EXPERT: 30 });
    expect(plan).toEqual([
      { difficulty: 'EASY', gridSize: 6, count: 2 },
      { difficulty: 'HARD', gridSize: 6, count: 2, minMoves: 20 },
    ]);
  });

  it('without a minimum, a batch is its difficulty as it is', () => {
    expect(batchConfig({ difficulty: 'HARD', gridSize: 7, count: 1 })).toEqual({ config: { ...DIFFICULTY_LEVELS.HARD, gridSize: 7 }, custom: false, slowdown: 1 });
  });

  it('keeps the boards of the difficulty, from the minimum chosen, longer levels kept', () => {
    expect(batchConfig({ difficulty: 'HARD', gridSize: 7, count: 1, minMoves: 20 }).config)
      .toEqual({ ...DIFFICULTY_LEVELS.HARD, gridSize: 7, minMovesRequired: 20, keepLonger: true });
    // Under the usual minimum too: the player chooses
    expect(batchConfig({ difficulty: 'HARD', gridSize: 6, count: 1, minMoves: 8 })).toMatchObject({
      config: { minMovesRequired: 8, maxMovesRequired: 25, minVehicles: 10 }, custom: true, slowdown: 1,
    });
  });

  it('counts a level as longer to find the closer the minimum is to the most of the difficulty', () => {
    const slowdown = (minMoves: number) => batchConfig({ difficulty: 'HARD', gridSize: 6, count: 1, minMoves }).slowdown;
    expect(slowdown(15)).toBe(1);
    expect(slowdown(20)).toBeCloseTo(11 / 6);
    expect(slowdown(25)).toBe(11);
    expect(slowdown(20)).toBeGreaterThan(slowdown(18));
  });
});

describe('the generator, with a minimum of moves chosen', () => {
  it('makes levels of at least that many moves, and keeps one longer than the difficulty usually goes', () => {
    // Easy from 12 moves, the most of Easy: without "longer levels kept", only levels of exactly 12 moves
    const { config } = batchConfig({ difficulty: 'EASY', gridSize: 6, count: 1, minMoves: 12 });
    const found: number[] = [];
    for (let i = 0; i < 12; i++) {
      const level = generateLevel(i + 1, config);
      if (level) found.push(level.minMoves);
    }
    expect(found.length).toBeGreaterThan(0);
    for (const moves of found) expect(moves).toBeGreaterThanOrEqual(12);
    expect(Math.max(...found)).toBeGreaterThan(DIFFICULTY_LEVELS.EASY.maxMovesRequired);
  });

  it('without it, never goes over the most moves of the difficulty', () => {
    for (let i = 0; i < 20; i++) {
      const level = generateLevel(i + 1, DIFFICULTY_LEVELS.EASY);
      if (level) expect(level.minMoves).toBeLessThanOrEqual(DIFFICULTY_LEVELS.EASY.maxMovesRequired);
    }
  });
});
