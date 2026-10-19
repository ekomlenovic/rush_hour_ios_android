import type { Vehicle } from '../store/types';

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
  /** Given up after maxStates positions: no answer, the board is too big to search */
  tooComplex?: boolean;
}

/**
 * Positions a level from elsewhere (a link, the creator) may make the solver look at.
 * A 10×10 board full of small cars without a solution has millions of them (minutes,
 * gigabytes on a phone): past this it is refused. The hardest level of the app needs 300 000.
 */
export const MAX_VALIDATE_STATES = 1_000_000;

/**
 * High-performance BFS Solver.
 * Finds the shortest sequence of moves to solve the puzzle.
 * The search order is part of the game: the generator (daily levels, server puzzles)
 * and the hints depend on which shortest solution comes first, so it never changes.
 */
export function solvePuzzle(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  depthLimit: number = 200,
  maxStates: number = Infinity
): SolverResult {
  'worklet';
  const n = vehicles.length;
  const isHoriz = new Uint8Array(n);
  const fixed = new Uint8Array(n);
  const len = new Uint8Array(n);
  const ids = new Array<string>(n);
  let targetIdx = -1;

  for (let i = 0; i < n; i++) {
    const v = vehicles[i];
    ids[i] = v.id;
    isHoriz[i] = v.orientation === 'horizontal' ? 1 : 0;
    fixed[i] = v.orientation === 'horizontal' ? v.row : v.col;
    len[i] = v.length;
    if (v.isTarget) targetIdx = i;
  }

  // Normalize 255 to -1
  const exR = exitRow === 255 ? -1 : exitRow;
  const exC = exitCol === 255 ? -1 : exitCol;

  /** Only the target car decides a win */
  const isWin = (p: number): boolean => {
    if (targetIdx === -1) return false;
    if (isHoriz[targetIdx]) {
      if (fixed[targetIdx] !== exR) return false;
      if (exC >= gridSize) return p + len[targetIdx] >= gridSize;
      if (exC < 0) return p <= 0;
    } else {
      if (fixed[targetIdx] !== exC) return false;
      if (exR >= gridSize) return p + len[targetIdx] >= gridSize;
      if (exR < 0) return p <= 0;
    }
    return false;
  };

  // Check if initial state is already winning
  if (targetIdx !== -1 && isWin(isHoriz[targetIdx] ? vehicles[targetIdx].col : vehicles[targetIdx].row)) {
    return { solvable: true, minMoves: 0, moves: [] };
  }

  // The positions seen, in the order found (which is also the BFS queue): the cars of
  // each one side by side in `positions`, with the move that led there from `parent`
  let capacity = 1024;
  let positions = new Uint8Array(capacity * n);
  let parent = new Int32Array(capacity);
  let depth = new Uint16Array(capacity);
  let moved = new Int16Array(capacity);
  let hashes = new Int32Array(capacity);
  let count = 0;

  // Positions seen, by hash (Zobrist: a random number per car and place, xor-ed): an open
  // addressing table of state numbers + 1, twice as big as the states it holds
  const zobrist = new Int32Array(n * 16);
  let seed = 0x2545f491;
  for (let i = 0; i < zobrist.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    zobrist[i] = seed;
  }
  let table = new Int32Array(capacity * 2);
  let mask = table.length - 1;

  const grow = () => {
    capacity *= 2;
    const p = new Uint8Array(capacity * n); p.set(positions); positions = p;
    const pa = new Int32Array(capacity); pa.set(parent); parent = pa;
    const d = new Uint16Array(capacity); d.set(depth); depth = d;
    const m = new Int16Array(capacity); m.set(moved); moved = m;
    const h = new Int32Array(capacity); h.set(hashes); hashes = h;
    table = new Int32Array(capacity * 2);
    mask = table.length - 1;
    for (let s = 0; s < count; s++) {
      let slot = hashes[s] & mask;
      while (table[slot] !== 0) slot = (slot + 1) & mask;
      table[slot] = s + 1;
    }
  };

  /** Whether the position in state `s` (of hash `hash`) was seen; if not, it is added */
  const isNew = (s: number, hash: number): boolean => {
    let slot = hash & mask;
    for (let other = table[slot]; other !== 0; slot = (slot + 1) & mask, other = table[slot]) {
      if (hashes[other - 1] !== hash) continue;
      const a = (other - 1) * n;
      const b = s * n;
      let same = true;
      for (let i = 0; i < n; i++) if (positions[a + i] !== positions[b + i]) { same = false; break; }
      if (same) return false;
    }
    table[slot] = s + 1;
    hashes[s] = hash;
    return true;
  };

  let startHash = 0;
  for (let i = 0; i < n; i++) {
    positions[i] = isHoriz[i] ? vehicles[i].col : vehicles[i].row;
    startHash ^= zobrist[i * 16 + positions[i]];
  }
  parent[0] = -1;
  moved[0] = -1;
  isNew(0, startHash);
  count = 1;

  // Which cells are taken in the position being expanded
  const grid = new Uint8Array(gridSize * gridSize);
  let found = -1;
  let tooComplex = false;

  for (let head = 0; head < count && found === -1 && !tooComplex; head++) {
    if (depth[head] >= depthLimit) continue;
    const base = head * n;

    grid.fill(0);
    for (let i = 0; i < n; i++) {
      const p = positions[base + i];
      for (let k = 0; k < len[i]; k++) {
        grid[isHoriz[i] ? fixed[i] * gridSize + p + k : (p + k) * gridSize + fixed[i]] = 1;
      }
    }

    for (let vi = 0; vi < n && found === -1 && !tooComplex; vi++) {
      const curP = positions[base + vi];
      // Sliding back, then forward, one cell further each time until blocked
      for (let dir = -1; dir <= 1 && found === -1 && !tooComplex; dir += 2) {
        for (let step = 1; ; step++) {
          const np = curP + dir * step;
          if (np < 0 || np + len[vi] > gridSize) break;
          // The cell the car enters: its front going forward, its back going back
          const cell = dir === -1 ? np : np + len[vi] - 1;
          if (grid[isHoriz[vi] ? fixed[vi] * gridSize + cell : cell * gridSize + fixed[vi]]) break;

          // Written in the next free state, kept only if new
          if (count === capacity) grow();
          const next = count;
          positions.copyWithin(next * n, base, base + n);
          positions[next * n + vi] = np;
          if (!isNew(next, hashes[head] ^ zobrist[vi * 16 + curP] ^ zobrist[vi * 16 + np])) continue;

          parent[next] = head;
          depth[next] = depth[head] + 1;
          moved[next] = vi;
          count++;

          if (vi === targetIdx && isWin(np)) {
            found = next;
            break;
          }
          if (count > maxStates) {
            tooComplex = true;
            break;
          }
        }
      }
    }
  }

  if (found !== -1) {
    const path: Move[] = [];
    for (let s = found; parent[s] !== -1; s = parent[s]) {
      const vi = moved[s];
      const p = positions[s * n + vi];
      path.push({ vehicleId: ids[vi], toRow: isHoriz[vi] ? fixed[vi] : p, toCol: isHoriz[vi] ? p : fixed[vi] });
    }
    path.reverse();
    return { solvable: true, minMoves: path.length, moves: path };
  }

  return tooComplex
    ? { solvable: false, minMoves: -1, moves: [], tooComplex: true }
    : { solvable: false, minMoves: -1, moves: [] };
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
 * Returns the minimum number of moves, -1 if unsolvable, -2 if too big to search
 * (more than maxStates positions, see MAX_VALIDATE_STATES).
 */
export function validateLevel(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  maxStates: number = MAX_VALIDATE_STATES
): number {
  'worklet';
  const result = solvePuzzle(vehicles, gridSize, exitRow, exitCol, 200, maxStates);
  return result.tooComplex ? -2 : result.minMoves;
}
