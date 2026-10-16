import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { DIFFICULTY_LEVELS, generateSeededLevelSync, MULTI_LEVEL_ID, type Level } from './core';
import type { Difficulty } from './config';

/** Makes the puzzle of a seed; the same seed and difficulty always give the same puzzle */
export interface PuzzleGenerator {
  generate(seed: string, difficulty: Difficulty): Promise<Level | null>;
  close(): Promise<void>;
}

export function generatePuzzle(seed: string, difficulty: Difficulty): Level | null {
  return generateSeededLevelSync(seed, MULTI_LEVEL_ID, DIFFICULTY_LEVELS[difficulty]);
}

/** In the calling thread: for tests and tools */
export const inlineGenerator: PuzzleGenerator = {
  generate: async (seed, difficulty) => generatePuzzle(seed, difficulty),
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
    generate(seed, difficulty) {
      worker ??= start();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker!.postMessage({ id, seed, difficulty });
      });
    },
    async close() {
      await worker?.terminate();
      worker = null;
    },
  };
}
