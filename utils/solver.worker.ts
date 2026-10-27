import { solvePuzzle, validateLevel } from './solver';
import { generateSeededLevelSync } from './generator.core';

/**
 * The Web Worker of the solver on the web (utils/solverRuntime.web.ts): runs the task named
 * in each message and sends back its result, one at a time, in order.
 */
const TASKS: Record<string, (...args: any[]) => unknown> = { solvePuzzle, validateLevel, generateSeededLevelSync };

self.onmessage = (event: MessageEvent<{ id: number; task: string; args: unknown[] }>) => {
  const { id, task, args } = event.data;
  try {
    const run = TASKS[task];
    if (!run) throw new Error(`unknown solver task ${task}`);
    self.postMessage({ id, result: run(...args) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
