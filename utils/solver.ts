import { Vehicle } from '../store/gameStore';

/**
 * Represents a single move: which vehicle moved, and to which position.
 */
export interface Move {
  vehicleId: string;
  toRow: number;
  toCol: number;
}

/**
 * Result of the BFS solver.
 */
export interface SolverResult {
  /** Whether the puzzle is solvable */
  solvable: boolean;
  /** Minimum number of moves to solve */
  minMoves: number;
  /** The full optimal sequence of moves */
  moves: Move[];
}

/**
 * Board of a puzzle in compact form: one position per vehicle (column of a horizontal
 * vehicle, row of a vertical one), the rest never changes during a game.
 * Every function here is a worklet: they also run on a background thread (utils/background.ts).
 */
export interface CompactBoard {
  n: number;
  gridSize: number;
  isHoriz: Uint8Array;
  /** Row of a horizontal vehicle, column of a vertical one */
  fixed: Uint8Array;
  len: Uint8Array;
  targetIdx: number;
  /** The target exits on the high side (right or bottom), else on the low side (left or top) */
  exitHigh: boolean;
  /** The exit is on the target's lane */
  exitOnLane: boolean;
}

export function toCompactBoard(vehicles: Vehicle[], gridSize: number, exitRow: number, exitCol: number): CompactBoard {
  'worklet';
  const n = vehicles.length;
  const isHoriz = new Uint8Array(n);
  const fixed = new Uint8Array(n);
  const len = new Uint8Array(n);
  let targetIdx = -1;
  for (let i = 0; i < n; i++) {
    const v = vehicles[i];
    isHoriz[i] = v.orientation === 'horizontal' ? 1 : 0;
    fixed[i] = isHoriz[i] ? v.row : v.col;
    len[i] = v.length;
    if (v.isTarget) targetIdx = i;
  }
  // 255 encodes -1 (exit on the top or left side)
  const exR = exitRow === 255 ? -1 : exitRow;
  const exC = exitCol === 255 ? -1 : exitCol;
  let exitHigh = false;
  let exitOnLane = false;
  if (targetIdx >= 0) {
    if (isHoriz[targetIdx]) {
      exitOnLane = fixed[targetIdx] === exR && (exC >= gridSize || exC < 0);
      exitHigh = exC >= gridSize;
    } else {
      exitOnLane = fixed[targetIdx] === exC && (exR >= gridSize || exR < 0);
      exitHigh = exR >= gridSize;
    }
  }
  return { n, gridSize, isHoriz, fixed, len, targetIdx, exitHigh, exitOnLane };
}

export function initialPositions(vehicles: Vehicle[]): Uint8Array {
  'worklet';
  const pos = new Uint8Array(vehicles.length);
  for (let i = 0; i < vehicles.length; i++) {
    pos[i] = vehicles[i].orientation === 'horizontal' ? vehicles[i].col : vehicles[i].row;
  }
  return pos;
}

/** Whether the target car touches its exit in the state stored at `offset` */
function isWinAt(b: CompactBoard, states: Uint8Array, offset: number): boolean {
  'worklet';
  if (b.targetIdx < 0 || !b.exitOnLane) return false;
  const p = states[offset + b.targetIdx];
  return b.exitHigh ? p + b.len[b.targetIdx] >= b.gridSize : p <= 0;
}

/**
 * Hash key of a state: a number in mixed radix (positions of each vehicle) when it fits
 * in 2^53, which is the case of every realistic 6x6 and 7x7 board, else a string.
 */
function makeKeyFn(b: CompactBoard): (states: Uint8Array, offset: number) => number | string {
  'worklet';
  let product = 1;
  for (let i = 0; i < b.n; i++) product *= b.gridSize - b.len[i] + 1;
  if (product < Number.MAX_SAFE_INTEGER) {
    const radix = new Float64Array(b.n);
    for (let i = 0; i < b.n; i++) radix[i] = b.gridSize - b.len[i] + 1;
    return (states, offset) => {
      'worklet';
      let k = 0;
      for (let i = 0; i < b.n; i++) k = k * radix[i] + states[offset + i];
      return k;
    };
  }
  return (states, offset) => {
    'worklet';
    let k = '';
    for (let i = 0; i < b.n; i++) k += String.fromCharCode(65 + states[offset + i]);
    return k;
  };
}

/** Fills `grid` with the index of the vehicle on each cell (-1 if empty) */
function fillGrid(b: CompactBoard, grid: Int8Array, states: Uint8Array, offset: number): void {
  'worklet';
  grid.fill(-1);
  const g = b.gridSize;
  for (let i = 0; i < b.n; i++) {
    const p = states[offset + i];
    for (let k = 0; k < b.len[i]; k++) {
      grid[b.isHoriz[i] ? b.fixed[i] * g + p + k : (p + k) * g + b.fixed[i]] = i;
    }
  }
}

/** Growable flat list of states (n positions each) */
function createStateStore(n: number, capacity: number) {
  'worklet';
  const store = { n, count: 0, data: new Uint8Array(Math.max(1, n) * capacity) };
  return store;
}

function pushState(store: { n: number; count: number; data: Uint8Array }, source: Uint8Array, sourceOffset: number, vi: number, np: number): number {
  'worklet';
  const n = store.n;
  if ((store.count + 1) * n > store.data.length) {
    const bigger = new Uint8Array(store.data.length * 2);
    bigger.set(store.data);
    store.data = bigger;
  }
  const offset = store.count * n;
  for (let i = 0; i < n; i++) store.data[offset + i] = source[sourceOffset + i];
  if (vi >= 0) store.data[offset + vi] = np;
  return store.count++;
}

function growInt32(array: Int32Array, needed: number): Int32Array {
  'worklet';
  if (needed <= array.length) return array;
  const bigger = new Int32Array(Math.max(needed, array.length * 2));
  bigger.set(array);
  return bigger;
}

/**
 * Breadth-first search of the shortest solution. Neighbors are visited in a fixed order
 * (vehicle index, backward then forward, nearest first): the solution is deterministic.
 */
export function solvePuzzle(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  depthLimit: number = 200
): SolverResult {
  'worklet';
  const b = toCompactBoard(vehicles, gridSize, exitRow, exitCol);
  const n = b.n;
  const store = createStateStore(n, 1024);
  pushState(store, initialPositions(vehicles), 0, -1, 0);

  if (isWinAt(b, store.data, 0)) return { solvable: true, minMoves: 0, moves: [] };

  const keyOf = makeKeyFn(b);
  const visited = new Map<number | string, number>();
  visited.set(keyOf(store.data, 0), 0);

  let parent: Int32Array = new Int32Array(1024);
  let movedVehicle: Int32Array = new Int32Array(1024);
  let depth: Int32Array = new Int32Array(1024);
  parent[0] = -1;

  const grid = new Int8Array(gridSize * gridSize);
  const scratch = new Uint8Array(n);
  let finalIndex = -1;

  for (let head = 0; head < store.count && finalIndex < 0; head++) {
    if (depth[head] >= depthLimit) continue;
    const offset = head * n;
    fillGrid(b, grid, store.data, offset);

    for (let vi = 0; vi < n && finalIndex < 0; vi++) {
      const curP = store.data[offset + vi];
      const l = b.len[vi];
      for (let dir = -1; dir <= 1 && finalIndex < 0; dir += 2) {
        for (let step = 1; ; step++) {
          const np = curP + dir * step;
          if (np < 0 || np + l > gridSize) break;
          const cell = dir < 0 ? np : np + l - 1;
          const occupant = b.isHoriz[vi] ? grid[b.fixed[vi] * gridSize + cell] : grid[cell * gridSize + b.fixed[vi]];
          if (occupant !== -1) break;

          for (let i = 0; i < n; i++) scratch[i] = store.data[offset + i];
          scratch[vi] = np;
          const key = keyOf(scratch, 0);
          if (visited.has(key)) continue;

          const index = pushState(store, scratch, 0, -1, 0);
          visited.set(key, index);
          parent = growInt32(parent, index + 1);
          movedVehicle = growInt32(movedVehicle, index + 1);
          depth = growInt32(depth, index + 1);
          parent[index] = head;
          movedVehicle[index] = vi;
          depth[index] = depth[head] + 1;

          if (isWinAt(b, store.data, index * n)) {
            finalIndex = index;
            break;
          }
        }
      }
    }
  }

  if (finalIndex < 0) return { solvable: false, minMoves: -1, moves: [] };

  const moves: Move[] = [];
  for (let s = finalIndex; parent[s] >= 0; s = parent[s]) {
    const vi = movedVehicle[s];
    const p = store.data[s * n + vi];
    moves.push({
      vehicleId: vehicles[vi].id,
      toRow: b.isHoriz[vi] ? b.fixed[vi] : p,
      toCol: b.isHoriz[vi] ? p : b.fixed[vi],
    });
  }
  moves.reverse();
  return { solvable: true, minMoves: moves.length, moves };
}

export interface ComponentDistances {
  /** Number of states reachable from the start */
  count: number;
  /** Flat positions, `n` per state */
  states: Uint8Array;
  /** Fewest moves from each state to a win, -1 when the exit is unreachable */
  distance: Int32Array;
  /** Largest distance in the component */
  maxDistance: number;
}

/**
 * Explores every state reachable from the start, then measures the distance of each one to
 * the exit with a breadth-first search from all the winning states (moves are reversible).
 * One exploration gives the difficulty of every puzzle of the component.
 * Returns null past `maxStates` (too big to explore on a phone).
 */
export function exploreComponent(b: CompactBoard, start: Uint8Array, maxStates: number): ComponentDistances | null {
  'worklet';
  const n = b.n;
  const g = b.gridSize;
  const store = createStateStore(n, 2048);
  pushState(store, start, 0, -1, 0);
  const keyOf = makeKeyFn(b);
  const index = new Map<number | string, number>();
  index.set(keyOf(store.data, 0), 0);

  // Edges in compressed rows: neighbors of state s are edges[edgeStart[s] .. edgeStart[s + 1]]
  let edgeStart: Int32Array = new Int32Array(2048);
  let edges: Int32Array = new Int32Array(16384);
  let edgeCount = 0;
  const grid = new Int8Array(g * g);
  const scratch = new Uint8Array(n);

  for (let s = 0; s < store.count; s++) {
    if (store.count > maxStates) return null;
    const offset = s * n;
    edgeStart = growInt32(edgeStart, s + 2);
    edgeStart[s] = edgeCount;
    fillGrid(b, grid, store.data, offset);

    for (let vi = 0; vi < n; vi++) {
      const curP = store.data[offset + vi];
      const l = b.len[vi];
      for (let dir = -1; dir <= 1; dir += 2) {
        for (let step = 1; ; step++) {
          const np = curP + dir * step;
          if (np < 0 || np + l > g) break;
          const cell = dir < 0 ? np : np + l - 1;
          const occupant = b.isHoriz[vi] ? grid[b.fixed[vi] * g + cell] : grid[cell * g + b.fixed[vi]];
          if (occupant !== -1) break;

          for (let i = 0; i < n; i++) scratch[i] = store.data[offset + i];
          scratch[vi] = np;
          const key = keyOf(scratch, 0);
          let next = index.get(key);
          if (next === undefined) {
            next = pushState(store, scratch, 0, -1, 0);
            index.set(key, next);
          }
          edges = growInt32(edges, edgeCount + 1);
          edges[edgeCount++] = next;
        }
      }
    }
  }
  edgeStart = growInt32(edgeStart, store.count + 1);
  edgeStart[store.count] = edgeCount;

  const distance = new Int32Array(store.count).fill(-1);
  const queue = new Int32Array(store.count);
  let tail = 0;
  for (let s = 0; s < store.count; s++) {
    if (isWinAt(b, store.data, s * n)) {
      distance[s] = 0;
      queue[tail++] = s;
    }
  }
  let maxDistance = tail > 0 ? 0 : -1;
  for (let head = 0; head < tail; head++) {
    const s = queue[head];
    for (let e = edgeStart[s]; e < edgeStart[s + 1]; e++) {
      const next = edges[e];
      if (distance[next] < 0) {
        distance[next] = distance[s] + 1;
        if (distance[next] > maxDistance) maxDistance = distance[next];
        queue[tail++] = next;
      }
    }
  }

  return { count: store.count, states: store.data, distance, maxDistance };
}

/**
 * Get the next best move (hint) from the current board state.
 * Runs BFS from the current position and returns the first move
 * of the optimal remaining path.
 */
export function getHint(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number
): Move | null {
  'worklet';
  const result = solvePuzzle(vehicles, gridSize, exitRow, exitCol);
  if (!result.solvable || result.moves.length === 0) return null;
  return result.moves[0];
}

/**
 * Validate that a level configuration is solvable.
 * Returns the minimum number of moves, or -1 if unsolvable.
 */
export function validateLevel(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number
): number {
  const result = solvePuzzle(vehicles, gridSize, exitRow, exitCol);
  return result.minMoves;
}
