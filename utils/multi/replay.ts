import type { Level, MoveRecord, Vehicle } from '../../store/types';
import { applyMoves } from '../moveLog';

/**
 * Replay of a multiplayer game at its real pace (#50): the moves come at the times
 * they were played, faster with a speed, and a long pause is shortened (and shown)
 * so that nobody waits two minutes in front of a still board.
 */

/** A pause longer than this is shortened, and shown ('⏸ 1:20') */
export const LONG_PAUSE_MS = 5000;
/** How long a shortened pause lasts on screen */
export const SHORT_PAUSE_MS = 1500;

export const REPLAY_SPEEDS = [1, 2, 4] as const;
export type ReplaySpeed = typeof REPLAY_SPEEDS[number];

/** Positions of the vehicles after the first `step` moves (0: the start) */
export function vehiclesAfter(level: Level, moves: MoveRecord[], step: number): Vehicle[] {
  const result = applyMoves(level, moves.slice(0, Math.max(0, Math.min(step, moves.length))));
  return result.ok ? result.vehicles : level.vehicles;
}

/** Real time between the move `step` (1-based) and the one before it (the start for the first) */
export function gapBefore(moves: MoveRecord[], step: number): number {
  if (step < 1 || step > moves.length) return 0;
  return moves[step - 1].t - (step > 1 ? moves[step - 2].t : 0);
}

export const isLongPause = (gap: number): boolean => gap > LONG_PAUSE_MS;

/** How long to wait on screen before showing the move `step` */
export function playbackDelay(moves: MoveRecord[], step: number, speed: ReplaySpeed): number {
  const gap = gapBefore(moves, step);
  return (isLongPause(gap) ? SHORT_PAUSE_MS : gap) / speed;
}

/** Game time shown after `step` moves */
export const timeAt = (moves: MoveRecord[], step: number): number => (step > 0 ? moves[Math.min(step, moves.length) - 1].t : 0);
