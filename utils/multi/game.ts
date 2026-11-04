import type { MultiGame } from '../../store/multiStore';
import type { StartResult, SubmitResult, Today } from './api';
import { checkWin, isLegalMove } from '../collision';
import { toMoveRecord } from '../moveLog';

/**
 * A multiplayer game on the phone (#46): the board, the timed move log sent to the
 * server, and the clock of the server (the official time is the one of the server).
 */

/** Two starts of the same game: same day, same start, same puzzle */
function isSameGame(saved: MultiGame, start: StartResult): boolean {
  const ids = (vehicles: { id: string }[]) => vehicles.map(v => v.id).sort().join(',');
  return saved.date === start.date && saved.startedAt === start.startedAt && ids(saved.level.vehicles) === ids(start.level.vehicles);
}

/**
 * The game after a start: resumed where it was left on this phone, or from the start
 * position (first start, or a game begun on another phone: the clock keeps running).
 */
export function gameFromStart(serverUrl: string, start: StartResult, saved: MultiGame | undefined, now: number): MultiGame {
  const clockOffset = start.serverNow - now;
  if (saved && isSameGame(saved, start)) return { ...saved, clockOffset, deadline: start.deadline };
  return {
    serverUrl,
    date: start.date,
    number: start.number,
    level: start.level,
    vehicles: start.level.vehicles.map(v => ({ ...v })),
    moveLog: [],
    startedAt: start.startedAt,
    clockOffset,
    // On the phone clock, when the server started the game
    localStartedAt: start.startedAt - clockOffset,
    deadline: start.deadline,
    backgroundMs: 0,
  };
}

/** Kept past its deadline, for a phone clock a little off: the server refuses the game anyway after it */
export const PRUNE_MARGIN_MS = 60 * 60 * 1000;

/**
 * The games still playable (issue 177): a game left without a win nor a give-up stayed forever, while
 * the server refuses it once its deadline is past. Deadlines are read on the server clock of each game.
 */
export function pruneGames(games: Record<string, MultiGame>, now: number): Record<string, MultiGame> {
  const kept = Object.entries(games).filter(([, g]) => !(now + (g.clockOffset ?? 0) > g.deadline + PRUNE_MARGIN_MS));
  return kept.length === Object.keys(games).length ? games : Object.fromEntries(kept);
}

/** Time since the start, on the clock of the server */
export const elapsedMs = (game: MultiGame, now: number): number => Math.max(0, now + game.clockOffset - game.startedAt);

/** The game after a move on the board, and whether the red car is out; null if the vehicle did not move */
/**
 * `mergeWithLast`: a screen reader step that follows a step of the same vehicle, nothing else played since:
 * merged into the last move, as a drag of that length (issue 158); back where it started, the move is taken back
 */
export function playMove(game: MultiGame, vehicleId: string, row: number, col: number, now: number, mergeWithLast = false): { game: MultiGame; won: boolean } | null {
  const vehicle = game.vehicles.find(v => v.id === vehicleId);
  const last = game.moveLog[game.moveLog.length - 1];
  // Never back in time, even if the phone clock is changed
  const record = vehicle && toMoveRecord(vehicle, row, col, Math.max(last?.t ?? 0, Math.round(elapsedMs(game, now))));
  // The red car is out: the game is over, a move after it would make the server refuse the win.
  // A move through a vehicle (two dragged at once) would make it refuse the win too
  if (!record || isWon(game) || !isLegalMove(game.vehicles, vehicleId, row, col, game.level.gridSize)) return null;
  const vehicles = game.vehicles.map(v => (v.id === vehicleId ? { ...v, row, col } : v));
  let moveLog = [...game.moveLog, record];
  if (mergeWithLast && last?.vehicleId === vehicleId) {
    const delta = last.delta + record.delta;
    moveLog = delta === 0 ? game.moveLog.slice(0, -1) : [...game.moveLog.slice(0, -1), { ...last, delta, t: record.t }];
  }
  return {
    game: { ...game, vehicles, moveLog },
    won: checkWin(vehicles, game.level.exitRow, game.level.exitCol, game.level.gridSize),
  };
}

/** Is the red car out? A game won but not sent yet (network, app closed) is sent again, never played on */
export const isWon = (game: MultiGame): boolean =>
  checkWin(game.vehicles, game.level.exitRow, game.level.exitCol, game.level.gridSize);

/**
 * My win as the server has it, from the challenge of the day: a win it took whose answer
 * was lost on the way (sent again, it answers "already finished"). Null if it has none.
 */
export function wonResult(today: Today, date: string, playerId: number): SubmitResult | null {
  if (today.date !== date || today.me?.status !== 'won' || today.me.moves === null || today.me.timeMs === null) return null;
  const row = today.results.find(r => r.playerId === playerId);
  if (!row || row.rank === null) return null;
  return {
    status: 'won', moves: today.me.moves, timeMs: today.me.timeMs, minMoves: today.me.minMoves ?? 0,
    rank: row.rank, points: row.points, verdict: row.verdict,
  };
}

/** What is sent with a win: the moves, the time measured by the phone, the time spent out of the app */
export function submission(game: MultiGame, now: number) {
  return {
    moves: game.moveLog,
    clientMs: Math.max(0, now - game.localStartedAt),
    backgroundMs: game.backgroundMs,
  };
}

/** Errors of a win sent to the server that come from the way, not from the win: it is kept to send again */
export const RETRYABLE_SUBMIT_ERRORS = ['network', 'timeout', 'internal', 'rate_limited', 'bad_response'] as const;

/**
 * What a failed send of a win leads to (issue 117, tested since issue 203): `recover` when the server
 * already has the game (its answer was lost: the result is read back), `send_failed` for trouble on the
 * way (the win is kept, it can be sent again), `error` when the server refused it.
 */
export function submitFailure(code: string): 'recover' | 'send_failed' | 'error' {
  if (code === 'already_finished') return 'recover';
  return (RETRYABLE_SUBMIT_ERRORS as readonly string[]).includes(code) ? 'send_failed' : 'error';
}
