import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { DIFFICULTY_LEVELS, generateSeededLevelSync, levelVariant, MULTI_LEVEL_ID, sampleLevels, type Level } from './core';
import type { Difficulty } from './config';

/**
 * What a puzzle is for: a daily challenge is always generated from scratch; a duel of
 * the hardest difficulties is a variant of a level of the app (a master puzzle can take
 * many minutes to generate, a variant a second at most).
 */
export type PuzzleKind = 'challenge' | 'duel';
export const VARIANT_DIFFICULTIES: readonly Difficulty[] = ['EXPERT', 'MASTER'];

/** Makes the puzzle of a seed; the same seed, difficulty and kind always give the same puzzle */
export interface PuzzleGenerator {
  generate(seed: string, difficulty: Difficulty, kind?: PuzzleKind): Promise<Level | null>;
  close(): Promise<void>;
}

export function generatePuzzle(seed: string, difficulty: Difficulty, kind: PuzzleKind = 'challenge'): Level | null {
  const config = DIFFICULTY_LEVELS[difficulty];
  if (kind === 'duel' && VARIANT_DIFFICULTIES.includes(difficulty)) {
    const variant = levelVariant(sampleLevels, seed, MULTI_LEVEL_ID, config);
    if (variant) return variant;
  }
  return generateSeededLevelSync(seed, MULTI_LEVEL_ID, config);
}

/** In the calling thread: for tests and tools */
export const inlineGenerator: PuzzleGenerator = {
  generate: async (seed, difficulty, kind) => generatePuzzle(seed, difficulty, kind),
  close: async () => {},
};

interface WorkerReply { id: number; level: Level | null; error?: string }

/**
 * In a worker thread: a hard puzzle takes seconds to generate, during which
 * the server keeps answering. One puzzle at a time, in order.
 */
export function workerGenerator(workerFile = path.join(__dirname, 'worker.cjs')): PuzzleGenerator {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, { resolve: (level: Level | null) => void; reject: (e: Error) => void }>();

  const start = () => {
    const w = new Worker(workerFile);
    w.on('message', (reply: WorkerReply) => {
      const job = pending.get(reply.id);
      pending.delete(reply.id);
      if (reply.error) job?.reject(new Error(reply.error));
      else job?.resolve(reply.level);
    });
    w.on('error', (e) => {
      for (const job of pending.values()) job.reject(e);
      pending.clear();
      worker = null;
    });
    w.on('exit', () => { worker = null; });
    return w;
  };

  return {
    generate(seed, difficulty, kind = 'challenge') {
      worker ??= start();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker!.postMessage({ id, seed, difficulty, kind });
      });
    },
    async close() {
      await worker?.terminate();
      worker = null;
      // The puzzles asked for will never come
      for (const job of pending.values()) job.reject(new Error('generator closed'));
      pending.clear();
    },
  };
}
