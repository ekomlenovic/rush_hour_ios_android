import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { createPRNG, DIFFICULTY_LEVELS, dressVariant, exactStarts, generateSeededLevelSync, levelVariants, MULTI_LEVEL_ID, sampleLevels, type Level } from './core';
import type { Difficulty } from './config';

/**
 * Makes puzzles: from a seed (the same seed and difficulty always give the same puzzle), or variants of a level of the app.
 * With `minMoves`, only puzzles of exactly that optimum (the daily challenge, when the admin chose it): null or none if not found.
 */
export interface PuzzleGenerator {
  generate(seed: string, difficulty: Difficulty, minMoves?: number): Promise<Level | null>;
  /** Up to `count` variants of the level `sourceId` of the app for a difficulty (utils/variants.ts) */
  variants(sourceId: number, difficulty: Difficulty, count: number, seed: string, minMoves?: number): Promise<Level[]>;
  close(): Promise<void>;
}

export function generatePuzzle(seed: string, difficulty: Difficulty, minMoves?: number): Level | null {
  const level = generateSeededLevelSync(seed, MULTI_LEVEL_ID, DIFFICULTY_LEVELS[difficulty]);
  if (!level || minMoves === undefined) return level;
  // A start position of the same board with exactly that optimum: along its solution at least, when it is longer
  return exactStarts(level, minMoves, 1, createPRNG(`${seed}:exact`))[0] ?? null;
}

export function generateVariants(sourceId: number, difficulty: Difficulty, count: number, seed: string, minMoves?: number): Level[] {
  const source = sampleLevels.find(l => l.id === sourceId);
  if (!source) return [];
  if (minMoves !== undefined) {
    const random = createPRNG(seed);
    return exactStarts(source, minMoves, count, random).map(level => ({ ...dressVariant(level, random), id: MULTI_LEVEL_ID, updatedAt: 0 }));
  }
  return levelVariants(source, DIFFICULTY_LEVELS[difficulty], count, seed).map(level => ({ ...level, id: MULTI_LEVEL_ID }));
}

/** In the calling thread: for tests and tools */
export const inlineGenerator: PuzzleGenerator = {
  generate: async (seed, difficulty, minMoves) => generatePuzzle(seed, difficulty, minMoves),
  variants: async (sourceId, difficulty, count, seed, minMoves) => generateVariants(sourceId, difficulty, count, seed, minMoves),
  close: async () => {},
};

type Job =
  | { op: 'generate'; seed: string; difficulty: Difficulty; minMoves?: number }
  | { op: 'variants'; sourceId: number; difficulty: Difficulty; count: number; seed: string; minMoves?: number };
export type WorkerJob = Job & { id: number };

interface WorkerReply { id: number; result: Level | Level[] | null; error?: string }

/**
 * In a worker thread: a hard puzzle takes seconds to generate, during which
 * the server keeps answering. One job at a time, in order.
 */
export function workerGenerator(workerFile = path.join(__dirname, 'worker.cjs')): PuzzleGenerator {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, { resolve: (result: never) => void; reject: (e: Error) => void }>();

  const start = () => {
    const w = new Worker(workerFile);
    w.on('message', (reply: WorkerReply) => {
      const job = pending.get(reply.id);
      pending.delete(reply.id);
      if (reply.error) job?.reject(new Error(reply.error));
      else job?.resolve(reply.result as never);
    });
    w.on('error', (e) => {
      for (const job of pending.values()) job.reject(e);
      pending.clear();
      worker = null;
    });
    w.on('exit', () => { worker = null; });
    return w;
  };

  const run = <T>(job: Job): Promise<T> => {
    worker ??= start();
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (result: never) => void, reject });
      worker!.postMessage({ ...job, id });
    });
  };

  return {
    generate: (seed, difficulty, minMoves) => run<Level | null>({ op: 'generate', seed, difficulty, minMoves }),
    variants: (sourceId, difficulty, count, seed, minMoves) => run<Level[]>({ op: 'variants', sourceId, difficulty, count, seed, minMoves }),
    async close() {
      await worker?.terminate();
      worker = null;
      // The puzzles asked for will never come
      for (const job of pending.values()) job.reject(new Error('generator closed'));
      pending.clear();
    },
  };
}
