import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { DIFFICULTY_LEVELS, generateSeededLevelSync, levelVariants, MULTI_LEVEL_ID, sampleLevels, type Level } from './core';
import type { Difficulty } from './config';

/** Makes puzzles: from a seed (the same seed and difficulty always give the same puzzle), or variants of a level of the app */
export interface PuzzleGenerator {
  generate(seed: string, difficulty: Difficulty): Promise<Level | null>;
  /** Up to `count` variants of the level `sourceId` of the app for a difficulty (utils/variants.ts) */
  variants(sourceId: number, difficulty: Difficulty, count: number, seed: string): Promise<Level[]>;
  close(): Promise<void>;
}

export function generatePuzzle(seed: string, difficulty: Difficulty): Level | null {
  return generateSeededLevelSync(seed, MULTI_LEVEL_ID, DIFFICULTY_LEVELS[difficulty]);
}

export function generateVariants(sourceId: number, difficulty: Difficulty, count: number, seed: string): Level[] {
  const source = sampleLevels.find(l => l.id === sourceId);
  if (!source) return [];
  return levelVariants(source, DIFFICULTY_LEVELS[difficulty], count, seed).map(level => ({ ...level, id: MULTI_LEVEL_ID }));
}

/** In the calling thread: for tests and tools */
export const inlineGenerator: PuzzleGenerator = {
  generate: async (seed, difficulty) => generatePuzzle(seed, difficulty),
  variants: async (sourceId, difficulty, count, seed) => generateVariants(sourceId, difficulty, count, seed),
  close: async () => {},
};

type Job =
  | { op: 'generate'; seed: string; difficulty: Difficulty }
  | { op: 'variants'; sourceId: number; difficulty: Difficulty; count: number; seed: string };
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
    generate: (seed, difficulty) => run<Level | null>({ op: 'generate', seed, difficulty }),
    variants: (sourceId, difficulty, count, seed) => run<Level[]>({ op: 'variants', sourceId, difficulty, count, seed }),
    async close() {
      await worker?.terminate();
      worker = null;
      // The puzzles asked for will never come
      for (const job of pending.values()) job.reject(new Error('generator closed'));
      pending.clear();
    },
  };
}
