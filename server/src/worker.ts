import { parentPort } from 'node:worker_threads';
import { generatePuzzle, generateVariants, type WorkerJob } from './generation';

parentPort!.on('message', (job: WorkerJob) => {
  try {
    const result = job.op === 'variants'
      ? generateVariants(job.sourceId, job.difficulty, job.count, job.seed, job.minMoves)
      : generatePuzzle(job.seed, job.difficulty, job.minMoves);
    parentPort!.postMessage({ id: job.id, result });
  } catch (e) {
    parentPort!.postMessage({ id: job.id, result: null, error: String(e) });
  }
});
