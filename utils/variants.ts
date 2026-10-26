import type { Level, Vehicle } from '../store/types';
import { createPRNG, shuffleWith, transformLevel, type DifficultyConfig } from './generator.core';

/**
 * Variants of hand-checked hard levels (the levels of the app), for the hardest duels:
 * generating a master puzzle from scratch can take very long, variants are ready at once.
 *
 * Every position reachable from the start of a level is explored, with its exact
 * distance to the win (a breadth-first search from all the winning positions): the
 * hard ones are as many different start positions of the same board, each with its
 * own solution. A variant is one of them, turned or mirrored (8 symmetries of the
 * square, same difficulty), with its colors shuffled.
 */

/** Positions explored at most for one level (memory, time): beyond, the level gives no variant */
export const MAX_STATES = 500_000;
/** A variant may be this much easier than its level, no more */
export const MAX_EASIER = 2;

/** The levels of a difficulty: their optimum in its range */
export function variantSources(levels: readonly Level[], config: DifficultyConfig): Level[] {
  return levels.filter(l => l.minMoves >= config.minMovesRequired && l.minMoves <= config.maxMovesRequired);
}

/** A start position of a level and its exact optimum */
export interface HardStart { vehicles: Vehicle[]; minMoves: number }

/**
 * The positions of the board of a level reachable from its start whose optimum is
 * between `lowest` and `highest` (the start itself included when it is): how many there
 * are, and all of them, or `pick.count` of them drawn at random. null when the board has
 * too many positions to explore.
 */
export function hardStarts(
  level: Level, lowest: number, highest: number, pick?: { count: number; random: () => number },
): { total: number; starts: HardStart[] } | null {
  const n = level.gridSize;
  const vehicles = level.vehicles;
  const count = vehicles.length;
  const horizontal = vehicles.map(v => v.orientation === 'horizontal');
  // The row of a horizontal vehicle, the column of a vertical one: it never changes
  const line = vehicles.map(v => (v.orientation === 'horizontal' ? v.row : v.col));
  const length = vehicles.map(v => v.length);
  const target = vehicles.findIndex(v => v.isTarget);
  const exitRow = level.exitRow === 255 ? -1 : level.exitRow;
  const exitCol = level.exitCol === 255 ? -1 : level.exitCol;
  // Position of the red car that wins (it touches the side of the exit)
  const winAt = horizontal[target]
    ? (exitCol >= n ? n - length[target] : 0)
    : (exitRow >= n ? n - length[target] : 0);

  // Positions in one flat array (count bytes each), indexed by their key: little memory per position
  let flat = new Uint8Array(count * 1024);
  let size = 0;
  const index = new Map<string, number>();
  const at = (s: number) => flat.subarray(s * count, s * count + count);
  const add = (pos: Uint8Array): number => {
    const key = String.fromCharCode(...pos);
    let s = index.get(key);
    if (s === undefined) {
      if ((size + 1) * count > flat.length) {
        const bigger = new Uint8Array(flat.length * 2);
        bigger.set(flat);
        flat = bigger;
      }
      flat.set(pos, size * count);
      s = size++;
      index.set(key, s);
    }
    return s;
  };

  // The positions one move away (moves are computed again rather than kept: memory)
  const grid = new Uint8Array(n * n);
  const moved = new Uint8Array(count);
  const forEachNeighbor = (s: number, visit: (pos: Uint8Array) => void) => {
    const pos = at(s);
    grid.fill(0);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < length[i]; k++) {
        grid[horizontal[i] ? line[i] * n + pos[i] + k : (pos[i] + k) * n + line[i]] = 1;
      }
    }
    const free = (i: number, p: number) => (horizontal[i] ? grid[line[i] * n + p] === 0 : grid[p * n + line[i]] === 0);
    for (let i = 0; i < count; i++) {
      const tryAt = (p: number) => {
        moved.set(at(s));
        moved[i] = p;
        visit(moved);
      };
      for (let p = pos[i] - 1; p >= 0 && free(i, p); p--) tryAt(p);
      for (let p = pos[i] + 1; p + length[i] <= n && free(i, p + length[i] - 1); p++) tryAt(p);
    }
  };

  // 1. Every position reachable from the start
  add(Uint8Array.from(vehicles, v => (v.orientation === 'horizontal' ? v.col : v.row)));
  for (let s = 0; s < size; s++) {
    forEachNeighbor(s, add);
    if (size > MAX_STATES) return null;
  }

  // 2. Distance to the win of every position: from all the winning ones at once (moves can be undone)
  const distance = new Int32Array(size).fill(-1);
  let frontier: number[] = [];
  for (let s = 0; s < size; s++) {
    if (at(s)[target] === winAt) {
      distance[s] = 0;
      frontier.push(s);
    }
  }
  for (let d = 1; frontier.length > 0; d++) {
    const following: number[] = [];
    for (const s of frontier) {
      forEachNeighbor(s, (pos) => {
        const t = index.get(String.fromCharCode(...pos))!;
        if (distance[t] === -1) {
          distance[t] = d;
          following.push(t);
        }
      });
    }
    frontier = following;
  }

  // The hard ones; only those drawn become positions (there can be 100 000 of them)
  const hard: number[] = [];
  for (let s = 0; s < size; s++) if (distance[s] >= lowest && distance[s] <= highest) hard.push(s);
  if (pick) {
    const count = Math.min(pick.count, hard.length);
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(pick.random() * (hard.length - i));
      [hard[i], hard[j]] = [hard[j], hard[i]];
    }
    hard.length = count;
  }
  const starts = hard.map(s => {
    const pos = at(s);
    return { minMoves: distance[s], vehicles: vehicles.map((v, i) => (horizontal[i] ? { ...v, col: pos[i] } : { ...v, row: pos[i] })) };
  });
  return { total: distance.reduce((sum, d) => sum + (d >= lowest && d <= highest ? 1 : 0), 0), starts };
}

/**
 * Up to `count` variants of a level for a difficulty, all with a different start
 * position: as hard as the level or nearly (at most MAX_EASIER moves easier), each
 * turned or mirrored, its colors shuffled. The same seed gives the same variants.
 */
export function levelVariants(level: Level, config: DifficultyConfig, count: number, seed: string): Level[] {
  const lowest = Math.max(config.minMovesRequired, level.minMoves - MAX_EASIER);
  const random = createPRNG(seed);
  const found = hardStarts(level, lowest, config.maxMovesRequired, { count, random });
  if (!found) return [];
  return found.starts.map(start => dressVariant({ ...level, vehicles: start.vehicles, minMoves: start.minMoves, updatedAt: 0 }, random));
}

/**
 * Up to `count` start positions of the board of a level whose optimum is exactly
 * `minMoves`, drawn at random (the daily challenge of a server, when its admin chose
 * how many moves). None when the board has none, or too many positions to explore.
 */
export function exactStarts(level: Level, minMoves: number, count: number, random: () => number): Level[] {
  const found = hardStarts(level, minMoves, minMoves, { count, random });
  return (found?.starts ?? []).map(start => ({ ...level, vehicles: start.vehicles, minMoves: start.minMoves }));
}

/** The same puzzle turned or mirrored (one of the 8 symmetries), its colors shuffled: it does not look the same */
export function dressVariant(level: Level, random: () => number): Level {
  const turned = transformLevel(level, Math.floor(random() * 8));
  const colors = shuffleWith(turned.vehicles.filter(v => !v.isTarget).map(v => v.color), random);
  let next = 0;
  return { ...turned, vehicles: turned.vehicles.map(v => (v.isTarget ? v : { ...v, color: colors[next++] })) };
}
