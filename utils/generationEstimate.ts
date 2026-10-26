/**
 * Time to generate one map level, learnt on the phone (issue 162).
 *
 * A level costs very differently with the difficulty and the grid size (Normal 6x6: a few
 * seconds; Normal 8x8: a minute or more), and with the phone. The estimate starts from a
 * table of measures (DEFAULT_LEVEL_MS) and adapts to what this phone actually takes:
 * - a combination already generated here: the average of its measures, with the table as
 *   one more sample so that a single lucky level does not erase it;
 * - a combination never generated here: the table, scaled by how fast this phone was on
 *   the others (a phone twice slower in Easy is likely twice slower in Hard too).
 * Pure functions: the measures are kept by store/generationTimes.ts.
 */

/** A level this long to generate freezes the app for a minute or more: confirmed first */
export const LONG_LEVEL_MS = 60_000;

/** The measures of one combination (difficulty and grid size) on this phone */
export interface GenerationSample {
  /** Average time of a level, failed tries included */
  avgMs: number;
  /** Number of measures in the average, capped at MAX_SAMPLES: the newest keep a weight */
  count: number;
  /** Longest level measured: a combination that once took over LONG_LEVEL_MS is still confirmed */
  maxMs: number;
}

export type GenerationSamples = Record<string, GenerationSample>;

/** Past this many measures, the average moves like a moving average: the phone can change */
export const MAX_SAMPLES = 20;

/**
 * One level of a combination can take this many times the average: Hard 7x7 measured 1.2 s, 7.1 s
 * and 22.1 s, Normal 7x7 from 1 s to 12 s
 */
const SLOW_LEVEL_FACTOR = 2;

/** Weight of the table in the estimate of a measured combination, in measures */
const PRIOR_WEIGHT = 1;

/** How much faster or slower than the table a phone can be */
const MIN_SPEED_FACTOR = 0.1;
const MAX_SPEED_FACTOR = 10;

/**
 * Time of one level on a phone (Hermes, no JIT), failed tries included, per difficulty and grid size.
 * Node times from scripts/benchGenerator.ts (issue 162; Hard 8x8 made no level in 7 minutes), times
 * PHONE_FACTOR; Expert 6x6 and Master 7x7 keep the times used before. Only the starting point: the
 * measures of the phone take over.
 */
const PHONE_FACTOR = 5;
const NODE_LEVEL_MS: Record<string, Record<number, number>> = {
  EASY: { 6: 100, 7: 100, 8: 200 },
  NORMAL: { 6: 300, 7: 5_000, 8: 50_000 },
  HARD: { 6: 1_000, 7: 12_000, 8: 600_000 },
  EXPERT: { 6: 100_000, 7: 500_000, 8: 2_500_000 },
  MASTER: { 6: 240_000, 7: 240_000, 8: 1_200_000 },
};

export const DEFAULT_LEVEL_MS: Record<string, Record<number, number>> = Object.fromEntries(
  Object.entries(NODE_LEVEL_MS).map(([difficulty, sizes]) => [
    difficulty,
    Object.fromEntries(Object.entries(sizes).map(([size, ms]) => [size, ms * PHONE_FACTOR])),
  ]),
);

/** Key of a combination in the measures */
export const sampleKey = (difficulty: string, gridSize: number): string => `${difficulty}:${gridSize}`;

/** The table's time of a level; an unknown combination takes the slowest of its difficulty */
export function defaultLevelMs(difficulty: string, gridSize: number): number {
  const sizes = DEFAULT_LEVEL_MS[difficulty] ?? DEFAULT_LEVEL_MS.NORMAL;
  return sizes[gridSize] ?? Math.max(...Object.values(sizes));
}

/**
 * How much slower than the table this phone is (1: as fast), from every combination measured:
 * geometric mean of measured / table, weighted by the number of measures.
 */
export function speedFactor(samples: GenerationSamples): number {
  let weight = 0;
  let logSum = 0;
  for (const [key, sample] of Object.entries(samples)) {
    const [difficulty, size] = key.split(':');
    if (!(sample.count > 0) || !(sample.avgMs > 0)) continue;
    logSum += sample.count * Math.log(sample.avgMs / defaultLevelMs(difficulty, Number(size)));
    weight += sample.count;
  }
  if (weight === 0) return 1;
  return Math.min(MAX_SPEED_FACTOR, Math.max(MIN_SPEED_FACTOR, Math.exp(logSum / weight)));
}

/** Estimated time of one level on this phone */
export function estimateLevelMs(difficulty: string, gridSize: number, samples: GenerationSamples): number {
  const prior = defaultLevelMs(difficulty, gridSize) * speedFactor(samples);
  const sample = samples[sampleKey(difficulty, gridSize)];
  if (!sample || !(sample.count > 0)) return prior;
  return (prior * PRIOR_WEIGHT + sample.avgMs * sample.count) / (PRIOR_WEIGHT + sample.count);
}

/**
 * A level of this combination can freeze the app a minute or more: never started without saying so.
 * Levels vary a lot: an average of half a minute, or one level measured over a minute, is enough.
 */
export function needsConfirmation(difficulty: string, gridSize: number, samples: GenerationSamples): boolean {
  const sample = samples[sampleKey(difficulty, gridSize)];
  return estimateLevelMs(difficulty, gridSize, samples) * SLOW_LEVEL_FACTOR >= LONG_LEVEL_MS
    || (sample?.maxMs ?? 0) >= LONG_LEVEL_MS;
}

/** The measures with one more level of this combination */
export function addSample(samples: GenerationSamples, difficulty: string, gridSize: number, ms: number): GenerationSamples {
  if (!(ms >= 0) || !Number.isFinite(ms)) return samples;
  const key = sampleKey(difficulty, gridSize);
  const previous = samples[key];
  const count = Math.min(MAX_SAMPLES, (previous?.count ?? 0) + 1);
  const avgMs = previous ? previous.avgMs + (ms - previous.avgMs) / count : ms;
  return { ...samples, [key]: { avgMs, count, maxMs: Math.max(previous?.maxMs ?? 0, ms) } };
}
