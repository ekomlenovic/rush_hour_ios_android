import type { Level, Vehicle } from '../store/types';
import { solvePuzzle } from './solver';
import { DIFFICULTY_LEVELS, type DifficultyConfig } from './generator.core';
import { GENERATOR_VEHICLE_COLORS, TARGET_CAR_COLOR } from '../theme/board';

/**
 * The generator of the map levels (options of the map), one recipe per difficulty and grid size.
 *
 * Apart from generator.core.ts on purpose: that one makes the daily challenge and the puzzles of
 * the server from a seed, and can never draw differently. This one draws with Math.random and
 * its levels are saved whole, so it can change freely.
 *
 * Two methods, the faster one measured for each case (scripts/benchGenerator.ts):
 * - 'reject': a random board, solved; kept if its number of moves is in the range. The fastest
 *   for easy levels, where most boards fit.
 * - 'explore': a random board, then every position reachable from it with its distance to the
 *   exit (exploreCluster); the level is one of those positions, at a distance drawn in the range.
 *   One board gives a level as soon as any of its positions is hard enough: far fewer boards
 *   thrown away for hard levels.
 * Boards whose positions go over maxStates are dropped: a hard level does not need a huge board,
 * and a huge one costs seconds.
 */
export interface MapRecipe {
  method: 'reject' | 'explore';
  /** Most positions looked at for one board, a bigger board is dropped */
  maxStates: number;
  /** Vehicle counts of the difficulty times this: a bigger grid needs more vehicles to be as tight */
  vehicleScale?: number;
  /** Dense board: vehicles are added until this many free cells are left, at most (drawn in the range) */
  freeCells?: [number, number];
  /** 'reject' only: boards tried in one call of generateMapLevelChunk */
  attempts?: number;
  /**
   * One level out of `every` (by its id) is made with these free cells instead: slower, but the
   * levels of the case do not all look as full
   */
  alternate?: { every: number; freeCells: [number, number] };
}

/**
 * Share of 3-cell vehicles of a dense board, drawn for each board: as full with many trucks as
 * with many cars, a 8x8 board has from under twenty vehicles to nearly thirty
 */
const TRUCK_SHARE: [number, number] = [0.1, 0.9];

/** Positions looked at in one call of generateMapLevelChunk ('explore'): about a second on a phone */
const CHUNK_STATES = 150_000;
/** What building and checking a board costs, counted in positions */
const BOARD_COST = 200;

export const MAP_RECIPES: Record<string, Record<number, MapRecipe>> = {
  EASY: {
    6: { method: 'reject', maxStates: 200_000, attempts: 300 },
    7: { method: 'reject', maxStates: 200_000, attempts: 80 },
    8: { method: 'reject', maxStates: 200_000, attempts: 50 },
  },
  NORMAL: {
    6: { method: 'reject', maxStates: 200_000, attempts: 100 },
    7: { method: 'explore', maxStates: 20_000 },
    8: { method: 'explore', maxStates: 20_000, freeCells: [2, 6], alternate: { every: 3, freeCells: [7, 12] } },
  },
  HARD: {
    6: { method: 'explore', maxStates: 20_000 },
    7: { method: 'explore', maxStates: 20_000, vehicleScale: 1.36 },
    8: { method: 'explore', maxStates: 20_000, freeCells: [1, 4] },
  },
  EXPERT: {
    6: { method: 'explore', maxStates: 60_000 },
    7: { method: 'explore', maxStates: 20_000, freeCells: [3, 6] },
    8: { method: 'explore', maxStates: 20_000, freeCells: [1, 4] },
  },
  MASTER: {
    6: { method: 'explore', maxStates: 60_000, freeCells: [3, 6] },
    7: { method: 'explore', maxStates: 60_000, freeCells: [5, 9] },
    8: { method: 'explore', maxStates: 20_000, freeCells: [1, 4] },
  },
};

/** A grid size or difficulty without a recipe: explored, dense when the grid is big */
const FALLBACK_RECIPE: MapRecipe = { method: 'explore', maxStates: 20_000 };
const FALLBACK_BIG_RECIPE: MapRecipe = { method: 'explore', maxStates: 20_000, freeCells: [1, 6] };

const COLORS = GENERATOR_VEHICLE_COLORS;

// ─────────────────────────────────────────────────────────────────────────────
// The worklet plugin turns each worklet into a constant that captures the worklets it
// calls when it is created: a worklet is defined below the ones it calls (issue 159)
// ─────────────────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[], random: () => number): T[] {
  'worklet';
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clampTo(val: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, val));
}

/** The cells of the grid taken by these vehicles (1), row by row */
function occupancy(vehicles: Vehicle[], gridSize: number): Uint8Array {
  'worklet';
  const grid = new Uint8Array(gridSize * gridSize);
  for (const v of vehicles) {
    for (let k = 0; k < v.length; k++) {
      grid[v.orientation === 'horizontal' ? v.row * gridSize + v.col + k : (v.row + k) * gridSize + v.col] = 1;
    }
  }
  return grid;
}

function fits(grid: Uint8Array, gridSize: number, row: number, col: number, length: number, horizontal: boolean): boolean {
  'worklet';
  if ((horizontal ? col : row) + length > gridSize) return false;
  for (let k = 0; k < length; k++) {
    if (grid[horizontal ? row * gridSize + col + k : (row + k) * gridSize + col]) return false;
  }
  return true;
}

function mark(grid: Uint8Array, gridSize: number, row: number, col: number, length: number, horizontal: boolean): void {
  'worklet';
  for (let k = 0; k < length; k++) grid[horizontal ? row * gridSize + col + k : (row + k) * gridSize + col] = 1;
}

/**
 * A random board: the exit on one of the 4 sides, the target at the far end of its lane, vehicles
 * across that lane, then random ones. Either up to a number of vehicles drawn in the difficulty's
 * range (times vehicleScale), or, with freeCells, until that many free cells are left.
 */
function buildMapBoard(
  config: DifficultyConfig,
  recipe: MapRecipe,
  random: () => number,
): { vehicles: Vehicle[]; exitRow: number; exitCol: number } {
  'worklet';
  const { gridSize, minMovesRequired, maxMovesRequired } = config;
  const side = Math.floor(random() * 4);
  const horizontalTarget = side < 2;
  // The lane of the target, never the first one; sides: 0 right, 1 left, 2 bottom, 3 top
  const lane = Math.floor(random() * (gridSize - 1)) + 1;
  const exitFar = side === 0 || side === 2;
  const exitRow = horizontalTarget ? lane : (exitFar ? gridSize : 255);
  const exitCol = horizontalTarget ? (exitFar ? gridSize : 255) : lane;
  // The target starts at the other end: it has the whole lane to cross
  const start = exitFar ? 0 : gridSize - 2;

  const vehicles: Vehicle[] = [{
    id: 'target',
    row: horizontalTarget ? lane : start,
    col: horizontalTarget ? start : lane,
    length: 2,
    orientation: horizontalTarget ? 'horizontal' : 'vertical',
    isTarget: true,
    color: TARGET_CAR_COLOR,
  }];
  const grid = occupancy(vehicles, gridSize);
  const add = (id: string, row: number, col: number, length: number, horizontal: boolean) => {
    vehicles.push({
      id, row, col, length,
      orientation: horizontal ? 'horizontal' : 'vertical',
      isTarget: false,
      color: COLORS[(vehicles.length - 1) % COLORS.length],
    });
    mark(grid, gridSize, row, col, length, horizontal);
  };

  // Vehicles across the lane of the target, on cells it has to cross
  const crossings = shuffled(
    Array.from({ length: gridSize - 2 }, (_, i) => (exitFar ? i + 2 : i)),
    random,
  );
  const minBlock = clampTo(Math.floor(minMovesRequired / 5), 1, crossings.length);
  const maxBlock = clampTo(Math.ceil(maxMovesRequired / 4), minBlock, crossings.length);
  const blockers = minBlock + Math.floor(random() * (maxBlock - minBlock + 1));
  for (let b = 0; b < blockers; b++) {
    for (let p = 0; p < 25; p++) {
      const length = random() > 0.4 ? 2 : 3;
      const lo = Math.max(0, lane - length + 1);
      const hi = Math.min(gridSize - length, lane);
      const at = lo + Math.floor(random() * (hi - lo + 1));
      const row = horizontalTarget ? at : crossings[b];
      const col = horizontalTarget ? crossings[b] : at;
      if (fits(grid, gridSize, row, col, length, !horizontalTarget)) {
        add(`blocker_${b}`, row, col, length, !horizontalTarget);
        break;
      }
    }
  }

  /** No vehicle along the lane of the target: it could never get out of its way */
  const allowed = (row: number, col: number, horizontal: boolean) =>
    !(horizontal === horizontalTarget && (horizontal ? row : col) === lane);

  if (recipe.freeCells) {
    const [minFree, maxFree] = recipe.freeCells;
    const wantFree = minFree + Math.floor(random() * (maxFree - minFree + 1));
    const truckShare = TRUCK_SHARE[0] + random() * (TRUCK_SHARE[1] - TRUCK_SHARE[0]);
    let free = 0;
    for (let i = 0; i < grid.length; i++) if (!grid[i]) free++;
    while (free > wantFree) {
      let placed = false;
      for (let p = 0; p < 40 && !placed; p++) {
        const horizontal = random() > 0.5;
        const length = random() < truckShare ? 3 : 2;
        const row = Math.floor(random() * gridSize);
        const col = Math.floor(random() * gridSize);
        if (allowed(row, col, horizontal) && fits(grid, gridSize, row, col, length, horizontal)) {
          add(`v${vehicles.length}`, row, col, length, horizontal);
          free -= length;
          placed = true;
        }
      }
      if (placed) continue;
      // Random draws no longer find a place: one of the places left, if any
      const options: number[] = [];
      for (let cell = 0; cell < grid.length; cell++) {
        const row = Math.floor(cell / gridSize);
        const col = cell % gridSize;
        for (let o = 0; o < 4; o++) {
          const horizontal = o < 2;
          const length = 2 + (o % 2);
          if (allowed(row, col, horizontal) && fits(grid, gridSize, row, col, length, horizontal)) options.push(cell * 4 + o);
        }
      }
      if (options.length === 0) break;
      const option = options[Math.floor(random() * options.length)];
      const cell = Math.floor(option / 4);
      const length = 2 + (option % 2);
      add(`v${vehicles.length}`, Math.floor(cell / gridSize), cell % gridSize, length, option % 4 < 2);
      free -= length;
    }
  } else {
    const scale = recipe.vehicleScale ?? 1;
    const minVehicles = Math.round(config.minVehicles * scale);
    const maxVehicles = Math.round(config.maxVehicles * scale);
    const wanted = minVehicles + Math.floor(random() * (maxVehicles - minVehicles + 1));
    let stalls = 0;
    while (vehicles.length < wanted + 1 && stalls < 6) {
      let placed = false;
      for (let p = 0; p < 40 && !placed; p++) {
        const horizontal = random() > 0.5;
        const length = random() > 0.3 ? 2 : 3;
        const row = Math.floor(random() * gridSize);
        const col = Math.floor(random() * gridSize);
        if (allowed(row, col, horizontal) && fits(grid, gridSize, row, col, length, horizontal)) {
          add(`v${vehicles.length}`, row, col, length, horizontal);
          placed = true;
        }
      }
      if (!placed) stalls++;
    }
  }

  return { vehicles, exitRow, exitCol };
}

/** Every position reachable from a board (the place of each vehicle along its lane, side by side) and its distance to the exit */
export interface Cluster {
  /** Vehicles of the board */
  n: number;
  /** Positions found */
  count: number;
  /** positions[s * n + i]: column (horizontal) or row (vertical) of vehicle i in position s */
  positions: Uint8Array;
  /** Fewest moves from position s to a win */
  dist: Uint16Array;
  /** Distance of the position furthest from a win */
  maxDist: number;
}

/**
 * Every position reachable from a board, with its fewest moves to a win: a first pass finds them
 * all, a second one walks back from all the winning ones at once (a move can always be undone).
 * A move is one vehicle sliding any distance, as in solvePuzzle: dist is its minMoves.
 * Null when the board has more than maxStates positions, or none that wins.
 */
export function exploreCluster(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  maxStates: number,
): Cluster | null {
  'worklet';
  const n = vehicles.length;
  const isHoriz = new Uint8Array(n);
  const fixed = new Uint8Array(n);
  const len = new Uint8Array(n);
  let targetIdx = -1;
  for (let i = 0; i < n; i++) {
    const v = vehicles[i];
    isHoriz[i] = v.orientation === 'horizontal' ? 1 : 0;
    fixed[i] = v.orientation === 'horizontal' ? v.row : v.col;
    len[i] = v.length;
    if (v.isTarget) targetIdx = i;
  }
  if (targetIdx === -1) return null;
  // The place of the target that wins: against the side of the exit (255 is the top or left one)
  const exitLine = isHoriz[targetIdx] ? exitCol : exitRow;
  const winPlace = exitLine === 255 ? 0 : gridSize - len[targetIdx];

  let capacity = 1024;
  let positions = new Uint8Array(capacity * n);
  let hashes = new Int32Array(capacity);
  // Positions seen, by hash (a random number per vehicle and place, xor-ed): an open addressing
  // table of position numbers + 1, twice as big as the positions it holds
  const zobrist = new Int32Array(n * 16);
  let seed = 0x2545f491;
  for (let i = 0; i < zobrist.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    zobrist[i] = seed;
  }
  let table = new Int32Array(capacity * 2);
  let mask = table.length - 1;

  let startHash = 0;
  for (let i = 0; i < n; i++) {
    positions[i] = isHoriz[i] ? vehicles[i].col : vehicles[i].row;
    startHash ^= zobrist[i * 16 + positions[i]];
  }
  hashes[0] = startHash;
  table[startHash & mask] = 1;
  let count = 1;

  const grid = new Uint8Array(gridSize * gridSize);
  let dist = new Uint16Array(0);
  let queue = new Int32Array(0);
  let tail = 0;

  // Pass 0 finds every position; pass 1 goes through them from the winning ones, giving distances
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      dist = new Uint16Array(count).fill(0xffff);
      queue = new Int32Array(count);
      for (let s = 0; s < count; s++) {
        if (positions[s * n + targetIdx] === winPlace) { dist[s] = 0; queue[tail++] = s; }
      }
      if (tail === 0) return null;
    }
    for (let at = 0; at < (pass === 0 ? count : tail); at++) {
      const head = pass === 0 ? at : queue[at];
      const base = head * n;
      grid.fill(0);
      for (let i = 0; i < n; i++) {
        const p = positions[base + i];
        for (let k = 0; k < len[i]; k++) grid[isHoriz[i] ? fixed[i] * gridSize + p + k : (p + k) * gridSize + fixed[i]] = 1;
      }
      const headHash = hashes[head];
      for (let vi = 0; vi < n; vi++) {
        const cur = positions[base + vi];
        const length = len[vi];
        const line = fixed[vi];
        const horiz = isHoriz[vi];
        // Sliding back, then forward, one cell further each time until blocked
        for (let dir = -1; dir <= 1; dir += 2) {
          for (let step = 1; ; step++) {
            const np = cur + dir * step;
            if (np < 0 || np + length > gridSize) break;
            const cell = dir === -1 ? np : np + length - 1;
            if (grid[horiz ? line * gridSize + cell : cell * gridSize + line]) break;

            // The position after this move: already known?
            const hash = headHash ^ zobrist[vi * 16 + cur] ^ zobrist[vi * 16 + np];
            let slot = hash & mask;
            let known = -1;
            for (let other = table[slot]; other !== 0; slot = (slot + 1) & mask, other = table[slot]) {
              if (hashes[other - 1] !== hash) continue;
              const a = (other - 1) * n;
              let same = positions[a + vi] === np;
              for (let i = 0; same && i < n; i++) if (i !== vi && positions[a + i] !== positions[base + i]) same = false;
              if (same) { known = other - 1; break; }
            }

            if (pass === 1) {
              if (known !== -1 && dist[known] === 0xffff) {
                dist[known] = dist[head] + 1;
                queue[tail++] = known;
              }
              continue;
            }
            if (known !== -1) continue;
            if (count >= maxStates) return null;
            if (count === capacity) {
              capacity *= 2;
              const grownPositions = new Uint8Array(capacity * n); grownPositions.set(positions); positions = grownPositions;
              const grownHashes = new Int32Array(capacity); grownHashes.set(hashes); hashes = grownHashes;
              table = new Int32Array(capacity * 2);
              mask = table.length - 1;
              for (let s = 0; s < count; s++) {
                let free = hashes[s] & mask;
                while (table[free] !== 0) free = (free + 1) & mask;
                table[free] = s + 1;
              }
              slot = hash & mask;
              while (table[slot] !== 0) slot = (slot + 1) & mask;
            }
            positions.copyWithin(count * n, base, base + n);
            positions[count * n + vi] = np;
            hashes[count] = hash;
            table[slot] = count + 1;
            count++;
          }
        }
      }
    }
  }

  return { n, count, positions, dist, maxDist: dist[queue[tail - 1]] };
}

/** The recipe of a level, from its difficulty, its grid size and its id (alternate) */
export function mapRecipe(difficulty: string, gridSize: number, id: number): MapRecipe {
  'worklet';
  const recipes = MAP_RECIPES[difficulty];
  const recipe = (recipes && recipes[gridSize]) ?? (gridSize >= 8 ? FALLBACK_BIG_RECIPE : FALLBACK_RECIPE);
  const { alternate } = recipe;
  return alternate && id % alternate.every === 0 ? { ...recipe, freeCells: alternate.freeCells } : recipe;
}

/**
 * Tries to make one map level of a difficulty and grid size, for a bounded amount of work
 * (about a second on a phone): null when none came out, the caller tries again. Short calls
 * leave room for Cancel, and for the progress to move.
 */
export function generateMapLevelWith(id: number, difficulty: string, gridSize: number, random: () => number): Level | null {
  'worklet';
  const config: DifficultyConfig = { ...(DIFFICULTY_LEVELS[difficulty] ?? DIFFICULTY_LEVELS.NORMAL), gridSize };
  const recipe = mapRecipe(difficulty, gridSize, id);
  const { minMovesRequired, maxMovesRequired } = config;

  if (recipe.method === 'reject') {
    const attempts = recipe.attempts ?? 50;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const { vehicles, exitRow, exitCol } = buildMapBoard(config, recipe, random);
      const moves = solvePuzzle(vehicles, gridSize, exitRow, exitCol, maxMovesRequired + 10, recipe.maxStates).minMoves;
      if (moves >= minMovesRequired && moves <= maxMovesRequired) {
        return { id, gridSize, vehicles, exitRow, exitCol, minMoves: moves, updatedAt: Date.now() };
      }
    }
    return null;
  }

  for (let work = 0; work < CHUNK_STATES;) {
    const { vehicles, exitRow, exitCol } = buildMapBoard(config, recipe, random);
    const cluster = exploreCluster(vehicles, gridSize, exitRow, exitCol, recipe.maxStates);
    work += BOARD_COST + (cluster ? cluster.count * 2 : recipe.maxStates);
    if (!cluster || cluster.maxDist < minMovesRequired) continue;

    // A distance drawn in the range, then one of the positions at that distance: not always the
    // hardest position of the board, and never twice the same level from the same board
    const wanted = minMovesRequired + Math.floor(random() * (Math.min(maxMovesRequired, cluster.maxDist) - minMovesRequired + 1));
    let candidates = 0;
    for (let s = 0; s < cluster.count; s++) if (cluster.dist[s] === wanted) candidates++;
    let pick = Math.floor(random() * candidates);
    let chosen = -1;
    for (let s = 0; s < cluster.count && chosen === -1; s++) {
      if (cluster.dist[s] === wanted && pick-- === 0) chosen = s;
    }
    if (chosen === -1) continue;

    const placed = vehicles.map((v, i) => {
      const place = cluster.positions[chosen * cluster.n + i];
      return v.orientation === 'horizontal' ? { ...v, col: place } : { ...v, row: place };
    });
    // The number of moves the game will show is the one of its own solver
    const moves = solvePuzzle(placed, gridSize, exitRow, exitCol).minMoves;
    if (moves < minMovesRequired || moves > maxMovesRequired) continue;
    return { id, gridSize, vehicles: placed, exitRow, exitCol, minMoves: moves, updatedAt: Date.now() };
  }
  return null;
}

/** generateMapLevelWith drawing with Math.random: what the app runs on the solver runtime (hooks/useLevelGenerator.ts) */
export function generateMapLevelChunk(id: number, difficulty: string, gridSize: number): Level | null {
  'worklet';
  return generateMapLevelWith(id, difficulty, gridSize, Math.random);
}
