// Optimal solution of a campaign level, as drags from the top-left cell of a vehicle to its new cell.
// Usage: npx tsx store-listing/tools/solve.ts <levelId>
import { sampleLevels } from '../../data/sampleLevels';
import { solvePuzzle } from '../../utils/solver';

const level = sampleLevels.find(l => l.id === Number(process.argv[2]));
if (!level) throw new Error(`Unknown level ${process.argv[2]}`);
const result = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
const pos = Object.fromEntries(level.vehicles.map(v => [v.id, { row: v.row, col: v.col }]));
const moves = result.moves.map(m => {
  const v = pos[m.vehicleId];
  const drag = [v.row, v.col, m.toRow, m.toCol];
  v.row = m.toRow;
  v.col = m.toCol;
  return drag;
});
console.log(JSON.stringify({ gridSize: level.gridSize, minMoves: result.minMoves, moves }));
