import {
  buildGenerationPlan, clampAmount, planTotal, shareOut,
  DEFAULT_DIFFICULTY_PARTS, DEFAULT_GRID_SIZE_PARTS, MAX_GENERATION_AMOUNT,
  GENERATION_DIFFICULTIES, GENERATION_GRID_SIZES, type DifficultyParts, type GenerationBatch,
} from '../utils/generationPlan';

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
