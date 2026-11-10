/**
 * Benchmark of the map generator, out of CI: time of a level per difficulty and grid size, and how
 * varied the levels are (moves, vehicles, vehicles moved by the solution, exit sides, duplicates).
 * Usage: npx tsx scripts/benchGenerator.ts [DIFFICULTY|ALL] [GRID_SIZE|ALL] [SECONDS]
 * Node has a JIT, Hermes on a phone does not: the phone is slower (see utils/generationEstimate.ts).
 * The recipes (utils/mapGenerator.ts) were chosen with it: change one, measure again.
 */
import { DIFFICULTY_LEVELS } from '../utils/generator.core';
import { generateMapLevelChunk } from '../utils/mapGenerator';
import { solvePuzzle } from '../utils/solver';
import { canonicalKey } from './campaign/canonical';
import type { Level } from '../store/types';

const [difficultyArg = 'NORMAL', sizeArg = '6', seconds = '10'] = process.argv.slice(2);
const difficulties = difficultyArg === 'ALL' ? Object.keys(DIFFICULTY_LEVELS) : [difficultyArg];
const sizes = sizeArg === 'ALL' ? [6, 7, 8] : [Number(sizeArg)];
const average = (values: number[]) => (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

for (const difficulty of difficulties) {
  for (const size of sizes) {
    const levels: Level[] = [];
    let slowest = 0;
    let since = performance.now();
    const start = since;
    while (performance.now() - start < Number(seconds) * 1000) {
      const level = generateMapLevelChunk(1000 + levels.length, difficulty, size);
      if (!level) continue;
      levels.push(level);
      slowest = Math.max(slowest, performance.now() - since);
      since = performance.now();
    }
    const elapsed = (performance.now() - start) / 1000;
    if (levels.length === 0) {
      console.log(`${difficulty} ${size}x${size}: no level in ${elapsed.toFixed(0)} s`);
      continue;
    }
    const moved = levels.map(l => new Set(solvePuzzle(l.vehicles, l.gridSize, l.exitRow, l.exitCol).moves.map(m => m.vehicleId)).size);
    const moves = levels.map(l => l.minMoves);
    const sides = [0, 0, 0, 0];
    for (const l of levels) sides[l.exitCol === size ? 0 : l.exitCol === 255 ? 1 : l.exitRow === size ? 2 : 3]++;
    console.log(
      `${difficulty} ${size}x${size}: ${(elapsed / levels.length).toFixed(2)} s per level (slowest ${(slowest / 1000).toFixed(1)} s, ${levels.length} levels)`
      + ` | moves ${Math.min(...moves)}-${Math.max(...moves)}, average ${average(moves)}`
      + ` | vehicles ${Math.min(...levels.map(l => l.vehicles.length))}-${Math.max(...levels.map(l => l.vehicles.length))}`
      + ` | moved by the solution ${average(moved)}`
      + ` | exits right/left/bottom/top ${sides.join('/')}`
      + ` | distinct ${new Set(levels.map(canonicalKey)).size}/${levels.length}`,
    );
  }
}
