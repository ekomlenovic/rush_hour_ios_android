import {
  batchConfig, buildGenerationPlan, clampAmount, clampMinMoves, planTotal, shareOut, MAX_MIN_MOVES,
  DEFAULT_DIFFICULTY_PARTS, DEFAULT_GRID_SIZE_PARTS, MAX_GENERATION_AMOUNT,
  GENERATION_DIFFICULTIES, GENERATION_GRID_SIZES, type DifficultyParts, type GenerationBatch,
} from '../utils/generationPlan';
import { DIFFICULTY_LEVELS } from '../utils/generator.core';

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

describe('minimum of moves asked by the player', () => {
  it('is nothing when the field is empty, and never over the maximum', () => {
    expect(clampMinMoves(NaN)).toBeNull();
    expect(clampMinMoves(0)).toBeNull();
    expect(clampMinMoves(18)).toBe(18);
    expect(clampMinMoves(99)).toBe(MAX_MIN_MOVES);
  });

  it('is carried by every batch of the plan, or by none', () => {
    const parts = { ...NONE, EASY: 1, HARD: 1 };
    expect(buildGenerationPlan(4, parts, DEFAULT_GRID_SIZE_PARTS, 20).map(b => b.minMoves)).toEqual([20, 20]);
    expect(buildGenerationPlan(4, parts, DEFAULT_GRID_SIZE_PARTS).every(b => !('minMoves' in b))).toBe(true);
  });

  it('changes nothing when the difficulty already guarantees it', () => {
    expect(batchConfig({ difficulty: 'HARD', gridSize: 7, count: 1 })).toEqual({ difficulty: 'HARD', config: { ...DIFFICULTY_LEVELS.HARD, gridSize: 7 }, raised: false });
    expect(batchConfig({ difficulty: 'HARD', gridSize: 7, count: 1, minMoves: 15 }).raised).toBe(false);
    expect(batchConfig({ difficulty: 'HARD', gridSize: 7, count: 1, minMoves: 8 }).config.minMovesRequired).toBe(15);
  });

  it('raises the minimum of the difficulty', () => {
    const { difficulty, config, raised } = batchConfig({ difficulty: 'HARD', gridSize: 6, count: 1, minMoves: 20 });
    expect(raised).toBe(true);
    expect(difficulty).toBe('HARD');
    expect(config).toEqual({ ...DIFFICULTY_LEVELS.HARD, gridSize: 6, minMovesRequired: 20 });
  });

  it('goes to the next difficulty at the top of the range: Hard levels of 25 moves are too rare to wait for', () => {
    expect(batchConfig({ difficulty: 'HARD', gridSize: 7, count: 1, minMoves: 25 })).toEqual({
      difficulty: 'EXPERT', config: { ...DIFFICULTY_LEVELS.EXPERT, gridSize: 7 }, raised: true,
    });
    expect(batchConfig({ difficulty: 'NORMAL', gridSize: 6, count: 1, minMoves: 12 })).toEqual({
      difficulty: 'HARD', config: { ...DIFFICULTY_LEVELS.HARD, gridSize: 6 }, raised: true,
    });
  });

  it('takes the vehicles of the first difficulty that reaches that many moves, and keeps the grid size', () => {
    const { difficulty, config } = batchConfig({ difficulty: 'EASY', gridSize: 6, count: 1, minMoves: 30 });
    expect(difficulty).toBe('EXPERT');
    expect(config).toEqual({ ...DIFFICULTY_LEVELS.EXPERT, gridSize: 6, minMovesRequired: 30 });
    // Never an easier difficulty than the one chosen
    expect(batchConfig({ difficulty: 'MASTER', gridSize: 8, count: 1, minMoves: MAX_MIN_MOVES })).toMatchObject({
      difficulty: 'MASTER', config: { gridSize: 8, minMovesRequired: MAX_MIN_MOVES, maxMovesRequired: 80 },
    });
  });

  it('always asks for a range the generator can search', () => {
    for (const difficulty of GENERATION_DIFFICULTIES) {
      for (let minMoves = 1; minMoves <= MAX_MIN_MOVES; minMoves++) {
        const { config } = batchConfig({ difficulty, gridSize: 6, count: 1, minMoves });
        expect(config.minMovesRequired).toBeGreaterThanOrEqual(Math.max(minMoves, DIFFICULTY_LEVELS[difficulty].minMovesRequired));
        expect(config.maxMovesRequired).toBeGreaterThanOrEqual(config.minMovesRequired + 5);
      }
    }
  });
});
