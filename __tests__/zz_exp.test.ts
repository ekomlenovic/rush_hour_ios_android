import { createPRNG, DIFFICULTY_LEVELS } from '../utils/generator';
import { exploreComponent, initialPositions, toCompactBoard } from '../utils/solver';
import type { Vehicle } from '../store/types';
jest.setTimeout(1800000);

function canPlace(vs: Vehicle[], row: number, col: number, length: number, o: string, g: number) {
  for (let i = 0; i < length; i++) {
    const r = o === 'vertical' ? row + i : row; const c = o === 'horizontal' ? col + i : col;
    if (r >= g || c >= g) return false;
    for (const v of vs) if (v.orientation === 'horizontal' ? v.row === r && c >= v.col && c < v.col + v.length : v.col === c && r >= v.row && r < v.row + v.length) return false;
  }
  return true;
}
function board(cfg: any, random: () => number, blockers: number) {
  const g = cfg.gridSize; const lane = 1 + Math.floor(random() * (g - 1));
  const targetPos = Math.floor(random() * (g - 1));
  const vehicles: Vehicle[] = [{ id: 'target', row: lane, col: targetPos, length: 2, orientation: 'horizontal', isTarget: true, color: '' }];
  // perpendicular blockers crossing the lane
  for (let b = 0, tries = 0; b < blockers && tries < 50; tries++) {
    const col = Math.floor(random() * g); const length = random() < 0.5 ? 2 : 3;
    const row = Math.max(0, Math.min(g - length, lane - Math.floor(random() * length)));
    if (canPlace(vehicles, row, col, length, 'vertical', g)) { vehicles.push({ id: 'b' + b, row, col, length, orientation: 'vertical', isTarget: false, color: '' }); b++; }
  }
  const count = cfg.minVehicles + Math.floor(random() * (cfg.maxVehicles - cfg.minVehicles + 1));
  for (let t = 0; vehicles.length < count && t < count * 40; t++) {
    const o = random() < 0.5 ? 'horizontal' : 'vertical'; const length = random() < 0.7 ? 2 : 3;
    const row = Math.floor(random() * g); const col = Math.floor(random() * g);
    if (o === 'horizontal' && row === lane) continue;
    if (!canPlace(vehicles, row, col, length, o, g)) continue;
    vehicles.push({ id: 'v' + vehicles.length, row, col, length, orientation: o as any, isTarget: false, color: '' });
  }
  return vehicles;
}
it('variants', () => {
  const out: string[] = [];
  const cfg = DIFFICULTY_LEVELS.EXPERT;
  for (const [blockers, cap] of [[0, 60000], [0, 200000], [2, 60000], [3, 60000], [3, 200000]]) {
    const random = createPRNG('exp-' + blockers + '-' + cap);
    let attempts = 0, hits = 0, skipped = 0; const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      attempts++;
      const vs = board(cfg, random, blockers);
      const g = cfg.gridSize; const lane = vs[0].row;
      const c = exploreComponent(toCompactBoard(vs, g, lane, g), initialPositions(vs), cap);
      if (!c) { skipped++; continue; }
      if (c.maxDistance >= cfg.minMovesRequired) hits++;
    }
    out.push(`blockers ${blockers} cap ${cap}: ${attempts} boards in 60 s, ${hits} hits (${(60000 / Math.max(hits, 1) / 1000).toFixed(1)} s/hit, ${(attempts / Math.max(hits, 1)).toFixed(0)} boards/hit), skipped ${skipped}`);
  }
  console.log(out.join('\n'));
});
