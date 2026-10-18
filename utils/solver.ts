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
}

/**
 * Most states the generator lets the solver go through for one board (a couple of
 * hundred MB): a board over it is dropped as if unsolvable. Some 7x7 boards have a
 * huge number of states, and their search used to take all the memory of the server.
 * The old solver ran out of memory well before this, so it changes no puzzle it made.
 */
export const GENERATOR_MAX_STATES = 8_000_000;

/**
 * High-performance BFS Solver.
 * Finds the shortest sequence of moves to solve the puzzle.
 * Past `maxStates` states seen, it gives up: not solvable.
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

  const initialPos = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    initialPos[i] = isHoriz[i] ? vehicles[i].col : vehicles[i].row;
  }

  // Normalize 255 to -1
  const exR = exitRow === 255 ? -1 : exitRow;
  const exC = exitCol === 255 ? -1 : exitCol;

  const isWinState = (pos: Uint8Array): boolean => {
    if (targetIdx === -1) return false;
    const p = pos[targetIdx];
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
  if (isWinState(initialPos)) {
    return { solvable: true, minMoves: 0, moves: [] };
  }

  // The states seen, in the order of the BFS (the queue is this order): a hard puzzle
  // goes through millions of them, so they are kept in typed arrays, a few dozen bytes
  // each, and not as objects (a big puzzle used to take gigabytes)
  let capacity = 1 << 12;
  let states = new Uint8Array(capacity * n);
  let parent = new Int32Array(capacity);
  let movedVehicle = new Uint8Array(capacity);
  let movedTo = new Uint8Array(capacity);
  let depths = new Uint16Array(capacity);
  let count = 0;

  // Open addressing: the index of a state + 1, 0 for an empty slot
  let tableMask = (1 << 13) - 1;
  let table = new Int32Array(tableMask + 1);

  const hashOf = (pos: Uint8Array, offset: number): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < n; i++) h = Math.imul(h ^ pos[offset + i], 0x01000193);
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return h >>> 0;
  };

  /** The slot of `pos` in the table: the slot holding it, or the empty one where it goes */
  const slotOf = (pos: Uint8Array): number => {
    let slot = hashOf(pos, 0) & tableMask;
    for (;;) {
      const entry = table[slot];
      if (entry === 0) return slot;
      const offset = (entry - 1) * n;
      let same = true;
      for (let i = 0; i < n; i++) {
        if (states[offset + i] !== pos[i]) { same = false; break; }
      }
      if (same) return slot;
      slot = (slot + 1) & tableMask;
    }
  };

  const add = (pos: Uint8Array, slot: number, from: number, vi: number, to: number, depth: number): number => {
    if (count === capacity) {
      capacity *= 2;
      const grownStates = new Uint8Array(capacity * n);
      grownStates.set(states);
      states = grownStates;
      const grownParent = new Int32Array(capacity);
      grownParent.set(parent);
      parent = grownParent;
      const grownVehicle = new Uint8Array(capacity);
      grownVehicle.set(movedVehicle);
      movedVehicle = grownVehicle;
      const grownTo = new Uint8Array(capacity);
      grownTo.set(movedTo);
      movedTo = grownTo;
      const grownDepths = new Uint16Array(capacity);
      grownDepths.set(depths);
      depths = grownDepths;
    }
    const index = count++;
    states.set(pos, index * n);
    parent[index] = from;
    movedVehicle[index] = vi;
    movedTo[index] = to;
    depths[index] = depth;
    table[slot] = index + 1;
    // At most half full
    if (count * 2 > tableMask) {
      tableMask = tableMask * 2 + 1;
      table = new Int32Array(tableMask + 1);
      for (let s = 0; s < count; s++) {
        let free = hashOf(states, s * n) & tableMask;
        while (table[free] !== 0) free = (free + 1) & tableMask;
        table[free] = s + 1;
      }
    }
    return index;
  };

  add(initialPos, slotOf(initialPos), -1, 0, 0, 0);

  const pos = new Uint8Array(n);
  const next = new Uint8Array(n);
  // The cells taken in the state being expanded
  const grid = new Uint8Array(gridSize * gridSize);
  let finalIndex = -1;

  for (let head = 0; head < count && finalIndex === -1 && count < maxStates; head++) {
    const depth = depths[head];
    if (depth >= depthLimit) continue;
    for (let i = 0; i < n; i++) pos[i] = states[head * n + i];
    grid.fill(0);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < len[i]; k++) {
        if (isHoriz[i]) grid[fixed[i] * gridSize + pos[i] + k] = 1;
        else grid[(pos[i] + k) * gridSize + fixed[i]] = 1;
      }
    }

    for (let vi = 0; vi < n && finalIndex === -1; vi++) {
      const curP = pos[vi];

      // Try sliding in both directions
      for (let dir = -1; dir <= 1 && finalIndex === -1; dir += 2) {
        for (let step = 1; ; step++) {
          const np = curP + dir * step;
          if (np < 0 || np + len[vi] > gridSize) break;

          // The cell the vehicle moves into (never one of its own)
          const lead = dir === -1 ? np : np + len[vi] - 1;
          if (grid[isHoriz[vi] ? fixed[vi] * gridSize + lead : lead * gridSize + fixed[vi]]) break;

          // Valid move! Create next state
          next.set(pos);
          next[vi] = np;
          const slot = slotOf(next);
          if (table[slot] === 0) {
            const index = add(next, slot, head, vi, np, depth + 1);
            if (isWinState(next)) {
              finalIndex = index;
              break;
            }
          }
        }
      }
    }
  }

  if (finalIndex !== -1) {
    const path: Move[] = [];
    for (let curr = finalIndex; curr !== 0; curr = parent[curr]) {
      const vi = movedVehicle[curr];
      const np = movedTo[curr];
      path.push({
        vehicleId: ids[vi],
        toRow: isHoriz[vi] ? fixed[vi] : np,
        toCol: isHoriz[vi] ? np : fixed[vi],
      });
    }
    path.reverse();
    return { solvable: true, minMoves: path.length, moves: path };
  }

  return { solvable: false, minMoves: -1, moves: [] };
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
