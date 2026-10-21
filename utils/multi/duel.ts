import type { Level, MoveRecord, Vehicle } from '../../store/types';
import { applyMoves, toMoveRecord } from '../moveLog';
import { checkWin } from '../collision';

/**
 * Duel 1v1 in real time (server/src/duel.ts): the messages of the WebSocket, and the
 * duel as the phone sees it. A move of mine shows at once on my board; the server
 * checks it and sends it to both phones. Who wins is chosen at the creation: the first
 * red car out (time), or the fewest moves (moves; the same count is a draw).
 * A spectator gets the same messages, and plays nothing. Each board is drawn with the
 * look of its player (board theme, car skin, palette), said when connecting.
 */

export type DuelDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER';
export const DUEL_DIFFICULTIES: readonly DuelDifficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];

export type DuelMetric = 'time' | 'moves';
export const DUEL_METRICS: readonly DuelMetric[] = ['time', 'moves'];

export type EndReason = 'won' | 'forfeit' | 'disconnected' | 'timeout';

/** Wins of each of the two players against the other, and their draws */
export interface HeadToHead { wins: { playerId: number; count: number }[]; draws: number }

export interface DuelResult {
  winnerId: number | null;
  reason: EndReason;
  timeMs: number | null;
  minMoves: number;
  /** The duel kept on the server, for its replay */
  duelId: number | null;
  /** All the duels of the two players, this one included */
  score: HeadToHead | null;
}

/** How a player's board looks in their app: ids of their cosmetics */
export interface DuelLook { board: string; skin: string; palette: string }

interface PlayerView {
  id: number; pseudo: string; connected: boolean; moves: MoveRecord[]; wantsRematch: boolean;
  /** Absent from a server older than the looks, null for an app older than them */
  look?: DuelLook | null;
}

export interface DuelView {
  code: string;
  difficulty: DuelDifficulty;
  /** Absent on older servers: the time */
  metric?: DuelMetric;
  private: boolean;
  status: 'waiting' | 'preparing' | 'playing' | 'over';
  level: Level | null;
  startsAt: number | null;
  serverNow: number;
  me: PlayerView;
  opponent: PlayerView | null;
  result: DuelResult | null;
  /** Absent from a server older than the spectators */
  spectating?: boolean;
  spectators?: number;
}

export type DuelServerMessage =
  | { type: 'ready'; player: { id: number; pseudo: string }; duel: DuelView | null }
  | { type: 'duel'; duel: DuelView }
  | { type: 'move'; playerId: number; move: MoveRecord }
  | { type: 'presence'; playerId: number; connected: boolean }
  | { type: 'rematch'; playerId: number }
  | { type: 'spectators'; count: number }
  | { type: 'end'; result: DuelResult; level: Level }
  | { type: 'closed' }
  | { type: 'error'; error: string };

export type DuelClientMessage =
  | { type: 'auth'; token: string; look: DuelLook }
  | { type: 'create'; difficulty: DuelDifficulty; metric: DuelMetric; private: boolean }
  | { type: 'join'; code: string }
  | { type: 'watch'; code: string }
  | { type: 'move'; vehicleId: string; delta: number }
  | { type: 'leave' }
  | { type: 'rematch' };

/** One player of the duel on the phone, with the position of their board */
export interface DuelSide {
  id: number;
  pseudo: string;
  connected: boolean;
  /** Moves checked by the server */
  moves: MoveRecord[];
  vehicles: Vehicle[];
  wantsRematch: boolean;
  /** Their look; null: drawn as my own board */
  look: DuelLook | null;
}

export interface Duel {
  code: string;
  difficulty: DuelDifficulty;
  /** What decides the winner */
  metric: DuelMetric;
  /** Only who has the code can join it (not in the list of the server) */
  private: boolean;
  status: DuelView['status'];
  level: Level | null;
  /** Start of the game, server clock */
  startsAt: number | null;
  /** Server clock minus phone clock */
  clockOffset: number;
  me: DuelSide;
  opponent: DuelSide | null;
  /** My moves played on the board, not yet seen back from the server */
  pending: MoveRecord[];
  result: DuelResult | null;
  /** The opponent left after the end: no rematch */
  opponentLeft: boolean;
  /** Watched, not played: `me` is then the first player, `opponent` the second one */
  spectating: boolean;
  /** How many watch it */
  spectators: number;
}

export interface DuelState {
  connection: 'connecting' | 'online' | 'offline';
  player: { id: number; pseudo: string } | null;
  duel: Duel | null;
  /** The last error of the server, e.g. a wrong code */
  error: string | null;
}

export const initialDuelState: DuelState = { connection: 'connecting', player: null, duel: null, error: null };

export type DuelAction =
  | { type: 'connection'; status: DuelState['connection'] }
  | { type: 'message'; message: DuelServerMessage; now: number }
  | { type: 'local_move'; move: MoveRecord }
  | { type: 'left' }
  | { type: 'clear_error' }
  /** The server closed the connection on purpose (WebSocket code 4000-4999): not coming back */
  | { type: 'refused'; reason: string };

/** Why the server closed the connection, as an error code of the app */
export function refusalError(reason: string): string {
  switch (reason) {
    case 'banned': case 'rate_limited': case 'unauthorized': return reason;
    case 'deleted': return 'unauthorized';
    // The same account on another phone, or signed in again elsewhere
    default: return 'duel_replaced';
  }
}

/** wss://… address of the duels of a server (https://…) */
export const duelSocketUrl = (serverUrl: string) => `${serverUrl.replace(/^https:/, 'wss:')}/api/v1/duel`;

/** 'ab-c d3' → 'ABCD3': a code as typed */
export const normalizeDuelCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The position after some moves from the start; the start position if they do not fit */
function positionAfter(level: Level | null, moves: MoveRecord[]): Vehicle[] {
  if (!level) return [];
  const replay = applyMoves(level, moves);
  return replay.ok ? replay.vehicles : level.vehicles.map(v => ({ ...v }));
}

function side(view: PlayerView, level: Level | null): DuelSide {
  return { ...view, look: view.look ?? null, vehicles: positionAfter(level, view.moves) };
}

function fromView(view: DuelView, now: number, previous: Duel | null): Duel {
  return {
    code: view.code,
    difficulty: view.difficulty,
    metric: view.metric ?? 'time',
    private: view.private,
    status: view.status,
    level: view.level,
    startsAt: view.startsAt,
    clockOffset: view.serverNow - now,
    me: side(view.me, view.level),
    opponent: view.opponent && side(view.opponent, view.level),
    // The whole duel from the server: what it did not see yet is lost
    pending: [],
    result: view.result,
    opponentLeft: previous?.code === view.code && view.status === 'over' ? previous.opponentLeft : false,
    spectating: view.spectating ?? false,
    spectators: view.spectators ?? 0,
  };
}

/** A move checked by the server, on one board */
function withMove(player: DuelSide, level: Level, move: MoveRecord): DuelSide {
  const replay = applyMoves({ ...level, vehicles: player.vehicles }, [move]);
  return { ...player, moves: [...player.moves, move], vehicles: replay.ok ? replay.vehicles : player.vehicles };
}

export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'connection':
      return { ...state, connection: action.status };

    case 'left':
      return { ...state, duel: null, error: null };

    case 'clear_error':
      return { ...state, error: null };

    case 'refused':
      // A result on screen stays; a duel being played is lost
      return {
        ...state,
        connection: 'offline',
        duel: state.duel?.status === 'over' ? state.duel : null,
        error: refusalError(action.reason),
      };

    case 'local_move': {
      const duel = state.duel;
      if (!duel?.level || duel.status !== 'playing') return state;
      const replay = applyMoves({ ...duel.level, vehicles: duel.me.vehicles }, [action.move]);
      if (!replay.ok) return state;
      return { ...state, duel: { ...duel, me: { ...duel.me, vehicles: replay.vehicles }, pending: [...duel.pending, action.move] } };
    }

    case 'message': {
      const { message, now } = action;
      const duel = state.duel;
      switch (message.type) {
        case 'ready': {
          // Connected again: the duel as the server has it. One that ended meanwhile keeps its result on screen.
          // A watched duel stays until the server sends it again (the app asks to watch it again)
          const next = message.duel ? fromView(message.duel, now, duel)
            : duel?.status === 'over' ? { ...duel, opponentLeft: true }
              : duel?.spectating ? duel : null;
          return { ...state, connection: 'online', player: message.player, duel: next };
        }

        case 'duel':
          return { ...state, duel: fromView(message.duel, now, duel), error: null };

        case 'move': {
          if (!duel?.level) return state;
          if (message.playerId === duel.me.id && !duel.spectating) {
            // My move, seen back: already on my board
            const [, ...pending] = duel.pending;
            return { ...state, duel: { ...duel, me: { ...duel.me, moves: [...duel.me.moves, message.move] }, pending } };
          }
          if (message.playerId === duel.me.id) return { ...state, duel: { ...duel, me: withMove(duel.me, duel.level, message.move) } };
          if (duel.opponent?.id !== message.playerId) return state;
          return { ...state, duel: { ...duel, opponent: withMove(duel.opponent, duel.level, message.move) } };
        }

        case 'presence': {
          if (!duel) return state;
          const mark = (player: DuelSide) => (player.id === message.playerId ? { ...player, connected: message.connected } : player);
          return { ...state, duel: { ...duel, me: mark(duel.me), opponent: duel.opponent && mark(duel.opponent) } };
        }

        case 'spectators':
          return duel ? { ...state, duel: { ...duel, spectators: message.count } } : state;

        case 'rematch': {
          if (!duel) return state;
          const mark = (player: DuelSide) => (player.id === message.playerId ? { ...player, wantsRematch: true } : player);
          return { ...state, duel: { ...duel, me: mark(duel.me), opponent: duel.opponent && mark(duel.opponent) } };
        }

        case 'end':
          if (!duel) return state;
          // The optimum comes with the end; my moves the server did not take stay on my board
          return { ...state, duel: { ...duel, status: 'over', result: message.result, level: message.level, pending: [] } };

        case 'closed':
          if (!duel) return state;
          // After the end the result stays on screen; otherwise the room is gone (the opponent left before the start)
          // (an error just told, e.g. no puzzle, is the reason)
          return duel.status === 'over' ? { ...state, duel: { ...duel, opponentLeft: true } } : { ...state, duel: null, error: state.error ?? 'opponent_left' };

        case 'error':
          // A move out of step: the server sends the real position, nothing to tell the player
          if (message.error === 'invalid_moves' || message.error === 'not_started') return state;
          // The watched duel is gone while the connection was lost
          if (duel?.spectating && duel.status !== 'over' && message.error === 'duel_not_found') return { ...state, duel: null, error: message.error };
          return { ...state, error: message.error };
      }
    }
  }
}

/** The move of a drag on my board, or null if nothing moved */
export function myMove(duel: Duel, vehicleId: string, row: number, col: number, now: number): MoveRecord | null {
  const vehicle = duel.me.vehicles.find(v => v.id === vehicleId);
  return vehicle ? toMoveRecord(vehicle, row, col, Math.max(0, Math.round(serverTime(duel, now) - (duel.startsAt ?? 0)))) : null;
}

/** Now on the clock of the server */
export const serverTime = (duel: Duel, now: number) => now + duel.clockOffset;

/** Time before the first move (0: it started) */
export const countdownMs = (duel: Duel, now: number) =>
  duel.startsAt === null ? 0 : Math.max(0, duel.startsAt - serverTime(duel, now));

/** Time since the start, frozen at the end */
export function duelElapsedMs(duel: Duel, now: number): number {
  if (duel.startsAt === null) return 0;
  if (duel.status === 'over') {
    const last = Math.max(0, ...[duel.me, duel.opponent].flatMap(p => p?.moves.map(m => m.t) ?? []));
    return duel.result?.timeMs ?? last;
  }
  return Math.max(0, serverTime(duel, now) - duel.startsAt);
}

/** Is my red car out? (the server has the last word) */
export const iHaveWon = (duel: Duel) =>
  !!duel.level && checkWin(duel.me.vehicles, duel.level.exitRow, duel.level.exitCol, duel.level.gridSize);

/** Is the red car of the opponent out? (a duel on moves goes on until both are out) */
export const opponentHasWon = (duel: Duel) =>
  !!duel.level && !!duel.opponent && checkWin(duel.opponent.vehicles, duel.level.exitRow, duel.level.exitCol, duel.level.gridSize);

/** The winner of a finished duel; null for a draw (or not over yet) */
export function winnerOf(duel: Duel): DuelSide | null {
  const id = duel.result?.winnerId;
  return [duel.me, duel.opponent].find(p => p && p.id === id) ?? null;
}

/** How the duel ended for me (for a spectator: for the first player) */
export function outcome(duel: Duel): 'win' | 'loss' | 'draw' | null {
  if (!duel.result) return null;
  if (duel.result.winnerId === null) return 'draw';
  return duel.result.winnerId === duel.me.id ? 'win' : 'loss';
}
