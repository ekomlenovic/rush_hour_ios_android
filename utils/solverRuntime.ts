import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets';

/**
 * The thread of the solver: a worklet runtime of its own, neither the JS thread (touches, React)
 * nor the UI one (drawing, animations), so a long search never freezes the screen.
 * On the web, a Web Worker (solverRuntime.web.ts).
 */
let runtime: WorkletRuntime | null = null;
const solverRuntime = () => (runtime ??= createWorkletRuntime({ name: 'solver' }));

/** Runs a worklet on the solver runtime, e.g. the generator of the daily (utils/generator.ts) */
export function runOnSolverRuntime<Args extends unknown[], R>(worklet: (...args: Args) => R, ...args: Args): Promise<R> {
  return runOnRuntimeAsync(solverRuntime(), worklet, ...args);
}
