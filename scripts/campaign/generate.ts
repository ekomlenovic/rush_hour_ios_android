// Generates the campaign levels after the current pack, following plan.ts, one level at a time.
// Every level found is saved at once in generated.jsonl: stop it whenever (Ctrl+C, shutdown),
// running it again resumes at the first missing level.
//
// Usage: npx tsx scripts/campaign/generate.ts [--to 500] [--budget 180] [--threads 6]
// Then:  npx tsx scripts/campaign/build.ts --to 500   (copies the levels into data/campaignPack.ts)
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Level } from '../../store/types';
import { sampleLevels } from '../../data/sampleLevels';
import { decodeCampaignLevel, encodeCampaignLevel } from '../../data/levelCodec';
import { solvePuzzle } from '../../utils/solver';
import { canonicalKey } from './canonical';
import { appendCheckpoint, readCheckpoint } from './checkpoint';
import { CAMPAIGN_SIZE, hash32, planLevel, type LevelPlan } from './plan';

const RUST_DIR = path.join(__dirname, '../../hardlvl');
const BINARY = path.join(RUST_DIR, 'target/release', process.platform === 'win32' ? 'rush_hour_gen.exe' : 'rush_hour_gen');
/** Attempts per level; from the third one, the number of moves asked goes down by one per attempt */
const MAX_ATTEMPTS = 12;
const MIN_RELAXED_MOVES = 24;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

function relax(plan: LevelPlan, attempt: number): LevelPlan {
  const drop = Math.max(0, attempt - 2);
  const minMoves = Math.max(MIN_RELAXED_MOVES, plan.minMoves - drop);
  return { ...plan, minMoves, maxMoves: Math.max(minMoves, plan.maxMoves - drop) };
}

function runGenerator(params: LevelPlan, seed: number, budget: number, threads: number) {
  const result = spawnSync(BINARY, [
    '--grid', String(params.grid),
    '--min-moves', String(params.minMoves), '--max-moves', String(params.maxMoves),
    '--min-vehicles', String(params.minVehicles), '--max-vehicles', String(params.maxVehicles),
    '--exit', params.exit,
    '--max-bfs-states', String(params.maxBfsStates),
    '--seed', String(seed), '--id', String(params.id),
    '--time-budget-secs', String(budget),
    '--threads', String(threads),
  ], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout) as { restart: number; level: Level };
}

function main() {
  const to = Math.min(arg('to', CAMPAIGN_SIZE), CAMPAIGN_SIZE);
  const budget = arg('budget', 180);
  const threads = arg('threads', 0);

  if (!fs.existsSync(BINARY)) {
    console.log('  Compilation du générateur (cargo build --release)...');
    execFileSync('cargo', ['build', '--release'], { cwd: RUST_DIR, stdio: 'inherit' });
  }

  const done = readCheckpoint();
  // No duplicate, even up to a symmetry, with the pack and with what is already generated
  const knownKeys = new Set(sampleLevels.map(canonicalKey));
  for (const g of done.values()) knownKeys.add(canonicalKey(decodeCampaignLevel(g.code, g.id)));

  const first = sampleLevels.length + 1;
  const todo: number[] = [];
  for (let id = first; id <= to; id++) if (!done.has(id)) todo.push(id);
  console.log(`\n  Niveaux ${first}-${to} : ${to - first + 1 - todo.length} déjà générés, ${todo.length} à faire\n`);

  for (const id of todo) {
    const plan = planLevel(id);
    let saved = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !saved; attempt++) {
      const params = relax(plan, attempt);
      const seed = hash32(`campaign-${id}-${attempt}`);
      const t0 = Date.now();
      console.log(`  [${id}/${to}] ${params.role} ${params.grid}x${params.grid} ${params.minMoves}-${params.maxMoves} coups, sortie ${params.exit}, essai ${attempt + 1}`);
      const found = runGenerator(params, seed, budget, threads);
      if (!found) continue;

      const level = found.level;
      const solved = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol, 200);
      const movers = new Set(solved.moves.map(m => m.vehicleId)).size;
      const key = canonicalKey(level);
      if (!solved.solvable || solved.minMoves !== level.minMoves) {
        console.log(`    rejeté : le solveur du jeu trouve ${solved.minMoves} coups, pas ${level.minMoves}`);
      } else if (movers < params.minMovers) {
        console.log(`    rejeté : seulement ${movers} véhicules bougent (minimum ${params.minMovers})`);
      } else if (knownKeys.has(key)) {
        console.log('    rejeté : doublon d\'un niveau existant (à une symétrie près)');
      } else {
        appendCheckpoint({
          id, params, attempt, seed, restart: found.restart,
          code: encodeCampaignLevel(level), movers, seconds: Math.round((Date.now() - t0) / 1000),
        });
        knownKeys.add(key);
        saved = true;
        console.log(`    ✓ sauvegardé (${level.minMoves} coups, ${movers} véhicules bougent)`);
      }
    }
    if (!saved) {
      // Ids must stay continuous: stop here rather than leave a hole
      console.error(`\n  Échec du niveau ${id} après ${MAX_ATTEMPTS} essais : relance avec un --budget plus grand.`);
      process.exit(1);
    }
  }
  console.log(`\n  Terminé : niveaux ${first}-${to} dans scripts/campaign/generated.jsonl`);
}

main();
