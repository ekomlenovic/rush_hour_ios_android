import type { MultiGame } from '../../store/multiStore';
import type { StartResult } from './api';
import { checkWin } from '../collision';
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

/** Time since the start, on the clock of the server */
export const elapsedMs = (game: MultiGame, now: number): number => Math.max(0, now + game.clockOffset - game.startedAt);

/** The game after a move on the board, and whether the red car is out; null if the vehicle did not move */
export function playMove(game: MultiGame, vehicleId: string, row: number, col: number, now: number): { game: MultiGame; won: boolean } | null {
  const vehicle = game.vehicles.find(v => v.id === vehicleId);
  const last = game.moveLog[game.moveLog.length - 1];
  // Never back in time, even if the phone clock is changed
  const record = vehicle && toMoveRecord(vehicle, row, col, Math.max(last?.t ?? 0, Math.round(elapsedMs(game, now))));
  if (!record) return null;
  const vehicles = game.vehicles.map(v => (v.id === vehicleId ? { ...v, row, col } : v));
  return {
    game: { ...game, vehicles, moveLog: [...game.moveLog, record] },
    won: checkWin(vehicles, game.level.exitRow, game.level.exitCol, game.level.gridSize),
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
