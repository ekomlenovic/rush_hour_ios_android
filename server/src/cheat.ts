import type { MoveRecord } from './core';

/**
 * Suspicion signals of a win (#50). They only raise a suspicion (⚠️, visible with
 * its reason): only the admin, after watching the replay, can call a game cheating.
 * Some cheating can never be caught (a friend who gives the solution): these
 * signals catch the obvious cases, with thresholds the admin can adjust.
 */

export interface Thresholds {
  /** Average time per move below which a game is too fast for a human, in ms */
  minMsPerMove: number;
  /** 'Copied' profile: only for perfect games of at least this many moves */
  copyMinMoves: number;
  /** 'Copied' profile: the pause before the first move is at least this share of the game */
  copyPauseRatio: number;
  /** 'Copied' profile: the moves after that pause are this regular (coefficient of variation of their intervals) */
  copyMaxRhythmVariation: number;
  /** Time measured by the phone and by the server may differ by this much (network), in ms … */
  clockToleranceMs: number;
  /** … or by this share of the game, whichever is larger */
  clockToleranceRatio: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minMsPerMove: 600,
  copyMinMoves: 8,
  copyPauseRatio: 0.6,
  copyMaxRhythmVariation: 0.3,
  clockToleranceMs: 15_000,
  clockToleranceRatio: 0.1,
};

export type FlagCode = 'too_fast' | 'copied' | 'clock_mismatch';

export interface Flag {
  code: FlagCode;
  /** The numbers behind the signal, shown with it */
  values: Record<string, number>;
}

export interface GameFacts {
  moves: MoveRecord[];
  minMoves: number;
  /** Official time, measured by the server */
  serverMs: number;
  /** Time measured by the phone, if it sent it */
  clientMs: number | null;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Spread of values relative to their mean (0: perfectly regular) */
export function variation(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  if (m <= 0) return 0;
  const sd = Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
  return sd / m;
}

export function analyzeGame({ moves, minMoves, serverMs, clientMs }: GameFacts, th: Thresholds): Flag[] {
  const flags: Flag[] = [];
  const count = moves.length;
  if (count === 0) return flags;

  const msPerMove = Math.round(serverMs / count);
  if (msPerMove < th.minMsPerMove) flags.push({ code: 'too_fast', values: { msPerMove, threshold: th.minMsPerMove } });

  // Found elsewhere (another phone, the creator with hints), then played back without a mistake
  const firstPause = moves[0].t;
  const intervals = moves.slice(1).map((m, i) => m.t - moves[i].t);
  if (count === minMoves && count >= th.copyMinMoves && serverMs > 0) {
    const pauseRatio = firstPause / serverMs;
    const rhythm = variation(intervals);
    if (pauseRatio >= th.copyPauseRatio && rhythm <= th.copyMaxRhythmVariation) {
      flags.push({ code: 'copied', values: { pausePercent: Math.round(pauseRatio * 100), pauseMs: firstPause } });
    }
  }

  // A modified app: its clock does not match the one of the server
  const tolerance = Math.max(th.clockToleranceMs, th.clockToleranceRatio * serverMs);
  const lastMove = moves[count - 1].t;
  const clientGap = clientMs === null ? 0 : Math.abs(serverMs - clientMs);
  if (clientGap > tolerance || lastMove > serverMs + tolerance) {
    flags.push({ code: 'clock_mismatch', values: { serverMs, clientMs: clientMs ?? -1, lastMoveMs: lastMove } });
  }
  return flags;
}
