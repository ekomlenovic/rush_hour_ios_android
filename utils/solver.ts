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
 * High-performance BFS Solver.
 * Finds the shortest sequence of moves to solve the puzzle.
 */
export function solvePuzzle(
  vehicles: Vehicle[],
  gridSize: number,
  exitRow: number,
  exitCol: number,
  depthLimit: number = 200
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

  const encodeState = (pos: Uint8Array): bigint => {
    let key = 0n;
    // Each position is at most 6, which fits in 3 bits. 4 bits for safety/simplicity.
    for (let i = 0; i < n; i++) key = (key << 4n) | BigInt(pos[i]);
    return key;
  };

  const cellOccupied = (pos: Uint8Array, r: number, c: number, skipIdx: number): boolean => {
    for (let i = 0; i < n; i++) {
      if (i === skipIdx) continue;
      const p = pos[i];
      if (isHoriz[i]) {
        if (fixed[i] === r && c >= p && c < p + len[i]) return true;
      } else {
        if (fixed[i] === c && r >= p && r < p + len[i]) return true;
      }
    }
    return false;
  };

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

  const visited = new Map<bigint, { parentKey: bigint; move: Move } | null>();
  const queue: bigint[] = [];
  const posQueue: Uint8Array[] = [];

  const startKey = encodeState(initialPos);
  visited.set(startKey, null);
  queue.push(startKey);
  posQueue.push(initialPos);

  let head = 0;
  let finalKey: bigint | null = null;
  let depthAtKey = new Map<bigint, number>();
  depthAtKey.set(startKey, 0);

  while (head < queue.length) {
    const curKey = queue[head];
    const pos = posQueue[head];
    const depth = depthAtKey.get(curKey)!;
    head++;

    if (depth >= depthLimit) continue;

    for (let vi = 0; vi < n; vi++) {
      const curP = pos[vi];

      // Try sliding in both directions
      const directions = [-1, 1];
      for (const dir of directions) {
        for (let step = 1; ; step++) {
          const np = curP + dir * step;
          if (np < 0 || np + len[vi] > gridSize) break;

          // Check collision
          let obstructed = false;
          if (dir === -1) {
            if (cellOccupied(pos, isHoriz[vi] ? fixed[vi] : np, isHoriz[vi] ? np : fixed[vi], vi)) obstructed = true;
          } else {
            const checkP = np + len[vi] - 1;
            if (cellOccupied(pos, isHoriz[vi] ? fixed[vi] : checkP, isHoriz[vi] ? checkP : fixed[vi], vi)) obstructed = true;
          }
          if (obstructed) break;

          // Valid move! Create next state
          const nextPos = new Uint8Array(pos);
          nextPos[vi] = np;
          const nextKey = encodeState(nextPos);

          if (!visited.has(nextKey)) {
            const move: Move = {
              vehicleId: ids[vi],
              toRow: isHoriz[vi] ? fixed[vi] : np,
              toCol: isHoriz[vi] ? np : fixed[vi],
            };
            visited.set(nextKey, { parentKey: curKey, move });
            depthAtKey.set(nextKey, depth + 1);

            if (isWinState(nextPos)) {
              finalKey = nextKey;
              break;
            }

            queue.push(nextKey);
            posQueue.push(nextPos);
          }
        }
        if (finalKey !== null) break;
      }
      if (finalKey !== null) break;
    }
    if (finalKey !== null) break;
  }

  if (finalKey !== null) {
    const path: Move[] = [];
    let curr = finalKey;
    while (curr !== startKey) {
      const entry = visited.get(curr)!;
      path.unshift(entry.move);
      curr = entry.parentKey;
    }
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
