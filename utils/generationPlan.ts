/**
 * What a generation of map levels makes: how many levels of each difficulty and grid size.
 * The player gives a number of levels and a proportion per difficulty and per grid size
 * ("2 parts Normal, 1 part Hard"); the plan shares the levels out. Pure functions.
 */
import { DIFFICULTY_LEVELS, type DifficultyConfig } from './generator.core';

export const GENERATION_DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const;
export type DifficultyKey = typeof GENERATION_DIFFICULTIES[number];

export const GENERATION_GRID_SIZES = [6, 7, 8] as const;

/** Levels generated at once, at most */
export const MAX_GENERATION_AMOUNT = 100;
/** Parts of one difficulty or grid size, at most */
export const MAX_PARTS = 9;

/** Highest minimum number of moves the player can ask for: past it the generator finds nothing */
export const MAX_MIN_MOVES = 60;
/**
 * Room a difficulty must leave over a minimum asked by the player. Levels at the very top of the
 * range of a difficulty are rare: Hard 7x7 with 25 moves or more (the top of Hard) found nothing in
 * 5 minutes, where Expert, which starts there, is made for it
 */
const MIN_MOVES_MARGIN = 5;

/** Levels of one difficulty and grid size to generate */
export interface GenerationBatch {
  difficulty: DifficultyKey;
  gridSize: number;
  count: number;
  /** Optimal moves every level needs at least, asked by the player; not set: those of the difficulty */
  minMoves?: number;
}

/** A typed minimum of moves: null when nothing (or zero) is typed, never over MAX_MIN_MOVES */
export function clampMinMoves(value: number): number | null {
  if (!Number.isFinite(value) || value < 1) return null;
  return Math.min(MAX_MIN_MOVES, Math.floor(value));
}

/**
 * What the generator is asked for a batch. A minimum of moves over the one of the difficulty raises
 * it: the levels are then those of the first difficulty that goes MIN_MOVES_MARGIN moves past it
 * (its vehicles and its maximum of moves: Easy boards of 5 to 8 vehicles never take 30 moves), never
 * an easier one than the batch's. `difficulty` is that one, the one the time of a level is estimated
 * with. A minimum the difficulty already guarantees changes nothing.
 */
export function batchConfig(batch: GenerationBatch): { difficulty: DifficultyKey; config: DifficultyConfig; raised: boolean } {
  const base = DIFFICULTY_LEVELS[batch.difficulty];
  const minMoves = batch.minMoves ?? 0;
  if (minMoves <= base.minMovesRequired) return { difficulty: batch.difficulty, config: { ...base, gridSize: batch.gridSize }, raised: false };

  const reaching = GENERATION_DIFFICULTIES.find(d => DIFFICULTY_LEVELS[d].maxMovesRequired >= minMoves + MIN_MOVES_MARGIN) ?? 'MASTER';
  const difficulty = GENERATION_DIFFICULTIES[Math.max(GENERATION_DIFFICULTIES.indexOf(reaching), GENERATION_DIFFICULTIES.indexOf(batch.difficulty))];
  const tier = DIFFICULTY_LEVELS[difficulty];
  return {
    difficulty,
    // A difficulty whose own minimum is over the one asked keeps its own
    config: { ...tier, gridSize: batch.gridSize, minMovesRequired: Math.max(minMoves, tier.minMovesRequired) },
    raised: true,
  };
}

export type DifficultyParts = Record<DifficultyKey, number>;
export type GridSizeParts = Record<number, number>;

/** What the generator made before the proportions: Normal, 6x6 */
export const DEFAULT_DIFFICULTY_PARTS: DifficultyParts = { EASY: 0, NORMAL: 1, HARD: 0, EXPERT: 0, MASTER: 0 };
export const DEFAULT_GRID_SIZE_PARTS: GridSizeParts = { 6: 1, 7: 0, 8: 0 };

/** A typed number of levels, kept between 1 and MAX_GENERATION_AMOUNT (nothing typed: 1) */
export function clampAmount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_GENERATION_AMOUNT, Math.max(1, Math.floor(value)));
}

/**
 * Shares `amount` out by parts, to the nearest whole level (largest remainder): the sum is always
 * `amount`, and at equal remainders the first entries (the fastest to generate) take the extra level.
 */
export function shareOut(amount: number, parts: number[]): number[] {
  const clean = parts.map(p => (p > 0 && Number.isFinite(p) ? p : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total === 0 || amount <= 0) return clean.map(() => 0);
  const exact = clean.map(p => (amount * p) / total);
  const counts = exact.map(Math.floor);
  let left = amount - counts.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    counts[index]++;
    left--;
  }
  return counts;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * The levels to generate, easiest first (the map gets harder as it goes, and a cancelled generation
 * has made the fast levels). Each difficulty and each grid size gets exactly its share of the levels;
 * the sizes are spread over the difficulties rather than "every Hard level in 8x8".
 */
export function buildGenerationPlan(
  amount: number,
  difficultyParts: DifficultyParts,
  gridSizeParts: GridSizeParts,
  /** Optimal moves every level needs at least; null: those of each difficulty */
  minMoves: number | null = null,
): GenerationBatch[] {
  const n = clampAmount(amount);
  const perDifficulty = shareOut(n, GENERATION_DIFFICULTIES.map(d => difficultyParts[d] ?? 0));
  const perSize = shareOut(n, GENERATION_GRID_SIZES.map(s => gridSizeParts[s] ?? 0));
  const difficulties = GENERATION_DIFFICULTIES.flatMap((d, i) => Array<DifficultyKey>(perDifficulty[i]).fill(d));
  const sizes = GENERATION_GRID_SIZES.flatMap((s, i) => Array<number>(perSize[i]).fill(s));
  if (difficulties.length !== n || sizes.length !== n) return [];

  // Level i takes the size at i * step (mod n): a step that shares no factor with n visits every
  // size once, and one near n / golden ratio spreads them evenly over the difficulties
  let step = Math.max(1, Math.round(n * 0.618));
  while (gcd(step, n) !== 1) step++;

  const counts = new Map<string, GenerationBatch>();
  difficulties.forEach((difficulty, i) => {
    const gridSize = sizes[(i * step) % n];
    const key = `${difficulty}:${gridSize}`;
    const batch = counts.get(key) ?? { difficulty, gridSize, count: 0, ...(minMoves ? { minMoves } : null) };
    batch.count++;
    counts.set(key, batch);
  });

  const rank = (b: GenerationBatch) => GENERATION_DIFFICULTIES.indexOf(b.difficulty) * 10 + b.gridSize;
  return [...counts.values()].sort((a, b) => rank(a) - rank(b));
}

/** Levels of a plan */
export const planTotal = (plan: GenerationBatch[]): number => plan.reduce((sum, b) => sum + b.count, 0);
