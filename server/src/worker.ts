import { parentPort } from 'node:worker_threads';
import { generatePuzzle } from './generation';

parentPort!.on('message', ({ id, seed, difficulty }) => {
  try {
    parentPort!.postMessage({ id, level: generatePuzzle(seed, difficulty) });
  } catch (e) {
    parentPort!.postMessage({ id, level: null, error: String(e) });
  }
});
