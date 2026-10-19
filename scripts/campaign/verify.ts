// Off-CI check: the game solver solves every campaign level in exactly its minMoves.
// Usage: npx tsx scripts/campaign/verify.ts [--from 310]
import { sampleLevels } from '../../data/sampleLevels';
import { solvePuzzle } from '../../utils/solver';

const i = process.argv.indexOf('--from');
const from = i >= 0 ? Number(process.argv[i + 1]) : 1;
let failures = 0;
for (const level of sampleLevels.filter(l => l.id >= from)) {
  const t0 = Date.now();
  const result = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol, 200);
  const ok = result.solvable && result.minMoves === level.minMoves;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${level.id} : ${result.minMoves} coups (attendu ${level.minMoves}), ${Date.now() - t0} ms`);
}
console.log(failures ? `\n${failures} niveau(x) en erreur` : '\nTous les niveaux sont résolus en exactement minMoves');
process.exit(failures ? 1 : 0);
