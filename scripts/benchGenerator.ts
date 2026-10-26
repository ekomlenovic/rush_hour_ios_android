/**
 * Benchmark of the map generator, out of CI: time of generateLevel per difficulty and grid size.
 * Usage: npx tsx scripts/benchGenerator.ts [DIFFICULTY] [GRID_SIZE] [COUNT]
 * Node has a JIT, Hermes on a phone does not: the phone is slower (see utils/generationEstimate.ts).
 */
import { DIFFICULTY_LEVELS, generateLevel } from '../utils/generator';

const [difficulty = 'NORMAL', size = '6', count = '3'] = process.argv.slice(2);
const config = { ...DIFFICULTY_LEVELS[difficulty], gridSize: Number(size) };
const times: string[] = [];
for (let i = 0; i < Number(count); i++) {
  const start = performance.now();
  const level = generateLevel(1000 + i, config);
  times.push(`${((performance.now() - start) / 1000).toFixed(1)} s${level ? '' : ' (failed)'}`);
}
console.log(`${difficulty} ${size}x${size}: ${times.join(' ; ')}`);
