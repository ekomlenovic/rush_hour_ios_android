import { solvePuzzle, validateLevel } from './solver';
import { generateSeededLevelSync } from './generator.core';

/**
 * The thread of the solver on the web: a Web Worker (utils/solver.worker.ts), the web has no
 * worklet runtime. Only the worklets it knows can run there: a function cannot be sent to a worker,
 * its name is. Without workers (or if it fails to start), the search runs on the page.
 */
const TASKS = new Map<Function, string>([
  [solvePuzzle, 'solvePuzzle'],
  [validateLevel, 'validateLevel'],
  [generateSeededLevelSync, 'generateSeededLevelSync'],
]);

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void };

let worker: Worker | null | undefined;
const pending = new Map<number, Pending>();
let nextId = 0;

function startWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./solver.worker', import.meta.url));
    worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const { id, result, error } = event.data;
      const task = pending.get(id);
      pending.delete(id);
      if (error !== undefined) task?.reject(new Error(error));
      else task?.resolve(result);
    };
    worker.onerror = (event) => {
      // The worker could not load: what waits for it, and what comes next, runs on the page
      console.warn('[solver] worker unavailable, the search runs on the page', event.message);
      event.preventDefault?.();
      worker?.terminate();
      worker = null;
      for (const task of pending.values()) task.reject(new Error('solver worker failed'));
      pending.clear();
    };
  } catch (error) {
    console.warn('[solver] worker unavailable, the search runs on the page', error);
    worker = null;
  }
  return worker;
}

/** Runs one of the solver's worklets in the worker, e.g. the generator of the daily (utils/generator.ts) */
export function runOnSolverRuntime<Args extends unknown[], R>(worklet: (...args: Args) => R, ...args: Args): Promise<R> {
  const task = TASKS.get(worklet);
  const solver = task ? startWorker() : null;
  if (!task || !solver) {
    // On the page, after the current frame: the screen shows what it was doing first
    return new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(worklet(...args)); } catch (error) { reject(error as Error); }
    }, 0));
  }
  const id = nextId++;
  return new Promise<R>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    solver.postMessage({ id, task, args });
  }).catch(error => {
    // The worker died with this task: it runs on the page rather than being lost
    if ((error as Error).message === 'solver worker failed') return worklet(...args);
    throw error;
  });
}
