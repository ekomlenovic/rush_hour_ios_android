import { randomInt } from 'node:crypto';
import { applyMoves, type Level, type MoveRecord, type Vehicle } from './core';
import { DIFFICULTIES, type Difficulty } from './config';
import type { PuzzleSource } from './puzzlePool';

/**
 * Duels 1v1 in real time: two players of the server on the same generated puzzle,
 * each one sees the board of the other move. The server is the referee: it replays
 * every move with the rules of the app, the first win it sees is the one that counts.
 * Nothing is stored: a duel lives in memory, for as long as it is played.
 */

/** Code to join a duel: no 0/O nor 1/I, easy to read out loud */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
/** Countdown before the first move, once the puzzle is ready */
export const COUNTDOWN_MS = 3000;
/** A player who lost the connection during a game: after this, they lose */
export const RECONNECT_GRACE_MS = 60_000;
/** A room nobody joined is closed */
export const WAITING_TTL_MS = 15 * 60_000;
/** A game nobody won is over (a draw) */
export const MAX_DUEL_MS = 30 * 60_000;
/** A finished duel stays open this long for a rematch */
export const OVER_TTL_MS = 5 * 60_000;
/** Time to say who you are after connecting */
export const AUTH_TIMEOUT_MS = 10_000;
/** Wrong codes of a player in WRONG_CODES_WINDOW_MS before their connection is closed (guessing a private code) */
export const MAX_WRONG_CODES = 10;
export const WRONG_CODES_WINDOW_MS = 15 * 60_000;
/** Messages of a connection in one second before it is closed (flooding) */
export const MAX_MESSAGES_PER_SECOND = 20;
/** Duels a player can create in CREATES_WINDOW_MS: each one takes a puzzle, which takes seconds to generate again */
export const MAX_CREATES = 5;
export const CREATES_WINDOW_MS = 60_000;
export const MAX_DUEL_MOVES = 1000;

export interface DuelIdentity { id: number; pseudo: string }

/** A finished duel, to keep */
export interface DuelRecord {
  difficulty: Difficulty;
  level: Level;
  startedAt: number;
  endedAt: number;
  reason: EndReason;
  winnerId: number | null;
  players: { id: number; moves: MoveRecord[] }[];
}

/** Wins of each of two players against the other, and their draws */
export interface HeadToHead { wins: { playerId: number; count: number }[]; draws: number }

/** What the duels need of the rest of the server */
export interface DuelDeps {
  /** The puzzles of the duels: ready ahead (pool), else generated */
  puzzles: PuzzleSource;
  /** Keeps a finished duel: its id (for its replay) and the score of the two players since they first met */
  save?: (record: DuelRecord) => { id: number; score: HeadToHead } | null;
  now: () => number;
  /** The player of a token; 'banned' for a player excluded by the admin */
  authenticate: (token: string) => DuelIdentity | 'banned' | null;
  log?: { error: (obj: object, msg: string) => void };
}

/** One connection of a player (a WebSocket) */
export interface DuelConnection {
  send: (message: ServerMessage) => void;
  close: (code: number, reason: string) => void;
}

export type ClientMessage =
  | { type: 'auth'; token: string }
  /** private: only who has the code can join; otherwise the duel is listed for everyone on the server */
  | { type: 'create'; difficulty?: Difficulty; private?: boolean }
  | { type: 'join'; code: string }
  | { type: 'move'; vehicleId: string; delta: number }
  | { type: 'leave' }
  | { type: 'rematch' };

export type EndReason = 'won' | 'forfeit' | 'disconnected' | 'timeout';

export interface DuelPlayerView { id: number; pseudo: string; connected: boolean; moves: MoveRecord[]; wantsRematch: boolean }

/** The whole duel as one player sees it: sent at the start and when they come back */
export interface DuelView {
  code: string;
  difficulty: Difficulty;
  private: boolean;
  status: 'waiting' | 'preparing' | 'playing' | 'over';
  /** The start position; its optimum stays hidden until the end */
  level: Level | null;
  startsAt: number | null;
  serverNow: number;
  me: DuelPlayerView;
  opponent: DuelPlayerView | null;
  result: DuelResult | null;
}

/** A duel in the list of the server: the open ones to join, the ones being played */
export interface DuelListing {
  /** To join it: open public duels and my own; null otherwise */
  code: string | null;
  difficulty: Difficulty;
  status: 'waiting' | 'preparing' | 'playing';
  private: boolean;
  players: DuelIdentity[];
  createdAt: number;
  startsAt: number | null;
  mine: boolean;
}

export interface DuelResult {
  /** null: a draw (nobody won in time) */
  winnerId: number | null;
  reason: EndReason;
  /** Time of the winner, from the start */
  timeMs: number | null;
  minMoves: number;
  /** The duel kept on the server (replay); null if it could not be */
  duelId: number | null;
  /** All the duels of these two players, this one included */
  score: HeadToHead | null;
}

export type ServerMessage =
  /** After auth, with the duel the player is in: they find it again where it was */
  | { type: 'ready'; player: DuelIdentity; duel: DuelView | null }
  | { type: 'duel'; duel: DuelView }
  | { type: 'move'; playerId: number; move: MoveRecord }
  | { type: 'presence'; playerId: number; connected: boolean }
  | { type: 'rematch'; playerId: number }
  | { type: 'end'; result: DuelResult; level: Level }
  | { type: 'closed' }
  | { type: 'error'; error: string };

interface Seat {
  player: DuelIdentity;
  connection: DuelConnection | null;
  disconnectedAt: number | null;
  vehicles: Vehicle[];
  moves: MoveRecord[];
  wantsRematch: boolean;
}

interface Duel {
  code: string;
  difficulty: Difficulty;
  isPrivate: boolean;
  status: DuelView['status'];
  seats: Seat[];
  level: Level | null;
  startsAt: number | null;
  createdAt: number;
  endedAt: number | null;
  result: DuelResult | null;
  /** Bumped at each new game: a puzzle generated for an earlier one is dropped */
  round: number;
}

/** Counts events by key in a sliding window: too many, and the next one is refused */
class WindowLimiter {
  private readonly hits = new Map<number, number[]>();
  constructor(private readonly max: number, private readonly windowMs: number) {}

  /** Records an event; false once there were `max` of them in the window */
  hit(key: number, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter(at => now - at < this.windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length <= this.max;
  }

  /** Forgets the keys with nothing recent (memory) */
  prune(now: number) {
    for (const [key, times] of this.hits) if (times.every(at => now - at >= this.windowMs)) this.hits.delete(key);
  }
}

export function newDuelCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** 'ab-c d3' → 'ABCD3': what a player typed */
export const normalizeDuelCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

function parseMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case 'auth': return typeof m.token === 'string' && m.token.length <= 200 ? { type: 'auth', token: m.token } : null;
    case 'create':
      if (m.difficulty !== undefined && !DIFFICULTIES.includes(m.difficulty as Difficulty)) return null;
      if (m.private !== undefined && typeof m.private !== 'boolean') return null;
      return { type: 'create', difficulty: m.difficulty as Difficulty | undefined, private: m.private as boolean | undefined };
    case 'join': return typeof m.code === 'string' && m.code.length <= 20 ? { type: 'join', code: m.code } : null;
    case 'move':
      return typeof m.vehicleId === 'string' && m.vehicleId.length <= 32 && Number.isInteger(m.delta)
        ? { type: 'move', vehicleId: m.vehicleId, delta: m.delta as number } : null;
    case 'leave': return { type: 'leave' };
    case 'rematch': return { type: 'rematch' };
    default: return null;
  }
}

export class Duels {
  private readonly duels = new Map<string, Duel>();
  private readonly byPlayer = new Map<number, Duel>();
  private readonly connections = new Map<number, DuelConnection>();
  private readonly wrongCodes = new WindowLimiter(MAX_WRONG_CODES - 1, WRONG_CODES_WINDOW_MS);
  private readonly creates = new WindowLimiter(MAX_CREATES, CREATES_WINDOW_MS);

  constructor(private readonly deps: DuelDeps) {}

  /** A new connection: it must say who it is first ({ type: 'auth' }) */
  connect(connection: DuelConnection) {
    let player: DuelIdentity | null = null;
    let closed = false;
    let second = 0;
    let messages = 0;

    const refuse = (code: number, reason: string) => {
      connection.send({ type: 'error', error: reason });
      closed = true;
      connection.close(code, reason);
    };

    const onMessage = (raw: string) => {
      if (closed) return;
      // Flooding, whoever it comes from
      const now = this.deps.now();
      if (Math.floor(now / 1000) !== second) {
        second = Math.floor(now / 1000);
        messages = 0;
      }
      if (++messages > MAX_MESSAGES_PER_SECOND) return refuse(4029, 'rate_limited');
      const message = parseMessage(raw);
      if (!message) return connection.send({ type: 'error', error: 'invalid_request' });

      if (!player) {
        if (message.type !== 'auth') return connection.send({ type: 'error', error: 'unauthorized' });
        const found = this.deps.authenticate(message.token);
        if (!found || found === 'banned') return refuse(4001, found === 'banned' ? 'banned' : 'unauthorized');
        player = found;
        this.attach(player, connection);
        return;
      }

      if (message.type === 'auth') return;
      if (message.type === 'join') {
        const error = this.join(player, message.code);
        // Counted by player, not by connection: connecting again does not give more tries
        if (error === 'duel_not_found' && !this.wrongCodes.hit(player.id, now)) return refuse(4029, 'rate_limited');
        if (error) connection.send({ type: 'error', error });
        return;
      }
      if (message.type === 'create' && !this.creates.hit(player.id, now)) return connection.send({ type: 'error', error: 'rate_limited' });
      const error = this.handle(player, message);
      if (error) connection.send({ type: 'error', error });
    };

    const onClose = () => {
      closed = true;
      if (player) this.detach(player.id, connection);
    };

    /** Has it said who it is? Otherwise it goes away after AUTH_TIMEOUT_MS */
    const authenticated = () => player !== null;

    return { onMessage, onClose, authenticated };
  }

  /**
   * A player who must not play any more (excluded by the admin, account deleted, signed
   * in on another phone): out of their duel at once, and their connection closed.
   */
  kick(playerId: number, reason: string) {
    const duel = this.byPlayer.get(playerId);
    if (duel) this.leave(duel, playerId);
    const connection = this.connections.get(playerId);
    this.connections.delete(playerId);
    connection?.close(4003, reason);
  }

  /** The duel of a player, for tests and logs */
  duelOf(playerId: number): DuelView | null {
    const duel = this.byPlayer.get(playerId);
    return duel ? this.view(duel, playerId) : null;
  }

  /** The duels of the server as a player sees them: public ones and their own; newest open ones first */
  list(playerId: number): DuelListing[] {
    const order = { waiting: 0, preparing: 1, playing: 1, over: 2 };
    return [...this.duels.values()]
      .filter(d => d.status !== 'over' && (!d.isPrivate || d.seats.some(s => s.player.id === playerId)))
      .sort((a, b) => order[a.status] - order[b.status] || b.createdAt - a.createdAt)
      .map(d => {
        const mine = d.seats.some(s => s.player.id === playerId);
        return {
          code: mine || d.status === 'waiting' ? d.code : null,
          difficulty: d.difficulty,
          status: d.status as DuelListing['status'],
          private: d.isPrivate,
          players: d.seats.map(s => s.player),
          createdAt: d.createdAt,
          startsAt: d.startsAt,
          mine,
        };
      });
  }

  get size() {
    return this.duels.size;
  }

  /** Deadlines: a player who did not come back, a room nobody joined, a game too long */
  sweep() {
    const now = this.deps.now();
    this.wrongCodes.prune(now);
    this.creates.prune(now);
    for (const duel of [...this.duels.values()]) {
      if (duel.status === 'waiting' && now - duel.createdAt > WAITING_TTL_MS) {
        this.close(duel);
      } else if (duel.status === 'playing') {
        const gone = duel.seats.find(s => s.disconnectedAt !== null && now - s.disconnectedAt > RECONNECT_GRACE_MS);
        if (gone) this.end(duel, duel.seats.find(s => s !== gone)!, 'disconnected');
        else if (duel.startsAt !== null && now - duel.startsAt > MAX_DUEL_MS) this.end(duel, null, 'timeout');
      } else if (duel.status === 'over' && duel.endedAt !== null && now - duel.endedAt > OVER_TTL_MS) {
        this.close(duel);
      }
    }
  }

  /** Every duel ends (the server stops) */
  closeAll() {
    for (const duel of [...this.duels.values()]) this.close(duel);
    for (const connection of this.connections.values()) connection.close(1001, 'shutdown');
    this.connections.clear();
  }

  // ── Connections ────────────────────────────────────────────────────────────

  private attach(player: DuelIdentity, connection: DuelConnection) {
    // The same player on another phone (or a reconnection): the old connection goes
    const previous = this.connections.get(player.id);
    if (previous && previous !== connection) previous.close(4000, 'replaced');
    this.connections.set(player.id, connection);

    const duel = this.byPlayer.get(player.id);
    if (!duel) return connection.send({ type: 'ready', player, duel: null });
    const seat = this.seat(duel, player.id)!;
    seat.connection = connection;
    // The pseudo may have changed in the meantime
    seat.player = player;
    const wasAway = seat.disconnectedAt !== null;
    seat.disconnectedAt = null;
    connection.send({ type: 'ready', player, duel: this.view(duel, player.id) });
    if (wasAway) this.broadcast(duel, { type: 'presence', playerId: player.id, connected: true }, player.id);
  }

  private detach(playerId: number, connection: DuelConnection) {
    if (this.connections.get(playerId) !== connection) return;
    this.connections.delete(playerId);
    const duel = this.byPlayer.get(playerId);
    if (!duel) return;
    const seat = this.seat(duel, playerId)!;
    seat.connection = null;
    // Nobody to wait for in a room not started yet, nor after the end
    if (duel.status === 'waiting' || duel.status === 'over') return this.leave(duel, playerId);
    seat.disconnectedAt = this.deps.now();
    this.broadcast(duel, { type: 'presence', playerId, connected: false }, playerId);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  private handle(player: DuelIdentity, message: Exclude<ClientMessage, { type: 'auth' | 'join' }>): string | null {
    const duel = this.byPlayer.get(player.id);
    switch (message.type) {
      case 'create': {
        if (duel) {
          if (duel.status === 'preparing' || duel.status === 'playing') return 'already_in_duel';
          this.leave(duel, player.id);
        }
        let code = newDuelCode();
        while (this.duels.has(code)) code = newDuelCode();
        const created: Duel = {
          code, difficulty: message.difficulty ?? 'NORMAL', isPrivate: message.private ?? false, status: 'waiting',
          seats: [this.newSeat(player)], level: null, startsAt: null,
          createdAt: this.deps.now(), endedAt: null, result: null, round: 0,
        };
        this.duels.set(code, created);
        this.byPlayer.set(player.id, created);
        this.sendTo(created, player.id, { type: 'duel', duel: this.view(created, player.id) });
        return null;
      }

      case 'move': {
        if (!duel || duel.status !== 'playing' || duel.startsAt === null) return 'no_duel';
        const now = this.deps.now();
        if (now < duel.startsAt) return 'not_started';
        const seat = this.seat(duel, player.id)!;
        if (seat.moves.length >= MAX_DUEL_MOVES) return 'invalid_moves';
        // The time is the one of the server, from the start
        const move: MoveRecord = { vehicleId: message.vehicleId, delta: message.delta, t: now - duel.startsAt };
        const replay = applyMoves({ ...duel.level!, vehicles: seat.vehicles }, [move]);
        if (!replay.ok) {
          // Out of step with the server (a move lost on the way): the phone gets the real position back
          this.sendTo(duel, player.id, { type: 'duel', duel: this.view(duel, player.id) });
          return 'invalid_moves';
        }
        seat.vehicles = replay.vehicles;
        seat.moves.push(move);
        this.broadcast(duel, { type: 'move', playerId: player.id, move });
        if (replay.won) this.end(duel, seat, 'won');
        return null;
      }

      case 'leave':
        if (duel) this.leave(duel, player.id);
        return null;

      case 'rematch': {
        if (!duel || duel.status !== 'over') return 'no_duel';
        if (duel.seats.length < 2) return 'opponent_left';
        const seat = this.seat(duel, player.id)!;
        if (seat.wantsRematch) return null;
        seat.wantsRematch = true;
        this.broadcast(duel, { type: 'rematch', playerId: player.id });
        if (duel.seats.every(s => s.wantsRematch)) this.prepare(duel);
        return null;
      }
    }
  }

  private join(player: DuelIdentity, input: string): string | null {
    const duel = this.duels.get(normalizeDuelCode(input));
    if (!duel) return 'duel_not_found';
    const current = this.byPlayer.get(player.id);
    if (current === duel) {
      this.sendTo(duel, player.id, { type: 'duel', duel: this.view(duel, player.id) });
      return null;
    }
    if (duel.status !== 'waiting') return 'duel_full';
    if (current) {
      if (current.status === 'preparing' || current.status === 'playing') return 'already_in_duel';
      this.leave(current, player.id);
    }
    duel.seats.push(this.newSeat(player));
    this.byPlayer.set(player.id, duel);
    this.prepare(duel);
    return null;
  }

  // ── A game ─────────────────────────────────────────────────────────────────

  private newSeat(player: DuelIdentity): Seat {
    return { player, connection: this.connections.get(player.id) ?? null, disconnectedAt: null, vehicles: [], moves: [], wantsRematch: false };
  }

  /** A new puzzle for both players, then the countdown */
  private prepare(duel: Duel) {
    const round = ++duel.round;
    duel.status = 'preparing';
    duel.level = null;
    duel.startsAt = null;
    duel.result = null;
    duel.endedAt = null;
    for (const seat of duel.seats) Object.assign(seat, { vehicles: [], moves: [], wantsRematch: false });
    this.sendViews(duel);

    // From the pool of puzzles generated ahead: at once, nearly always
    void this.deps.puzzles.take(duel.difficulty).catch(() => null).then(level => {
      // Left, or a newer game, while the puzzle was generated
      if (duel.round !== round || duel.status !== 'preparing' || !this.duels.has(duel.code)) return;
      if (!level) {
        // None ready, and too long to generate now (master)
        this.broadcast(duel, { type: 'error', error: 'puzzle_unavailable' });
        return this.close(duel);
      }
      duel.level = level;
      duel.status = 'playing';
      duel.startsAt = this.deps.now() + COUNTDOWN_MS;
      for (const seat of duel.seats) seat.vehicles = level.vehicles.map(v => ({ ...v }));
      this.sendViews(duel);
    });
  }

  private end(duel: Duel, winner: Seat | null, reason: EndReason) {
    const now = this.deps.now();
    duel.status = 'over';
    duel.endedAt = now;
    const last = winner?.moves[winner.moves.length - 1];
    const winnerId = winner?.player.id ?? null;
    let saved: { id: number; score: HeadToHead } | null = null;
    if (duel.level && duel.startsAt !== null && duel.seats.length === 2) {
      try {
        saved = this.deps.save?.({
          difficulty: duel.difficulty, level: duel.level, startedAt: duel.startsAt, endedAt: now, reason, winnerId,
          players: duel.seats.map(s => ({ id: s.player.id, moves: s.moves })),
        }) ?? null;
      } catch (err) {
        this.deps.log?.error({ err }, 'duel not saved');
      }
    }
    duel.result = {
      winnerId,
      reason,
      timeMs: reason === 'won' && last ? last.t : null,
      minMoves: duel.level?.minMoves ?? 0,
      duelId: saved?.id ?? null,
      score: saved?.score ?? null,
    };
    for (const seat of duel.seats) seat.disconnectedAt = null;
    this.broadcast(duel, { type: 'end', result: duel.result, level: duel.level! });
    // Who is gone for good has nothing to come back to
    for (const seat of [...duel.seats]) if (!seat.connection) this.leave(duel, seat.player.id);
  }

  private leave(duel: Duel, playerId: number) {
    const seat = this.seat(duel, playerId);
    if (!seat) return;
    // Leaving a game is losing it
    const other = duel.seats.find(s => s !== seat);
    if (duel.status === 'playing' && other) this.end(duel, other, 'forfeit');
    // A room not started yet goes with the player; after the end, the other one has nobody left for a rematch
    duel.seats = duel.seats.filter(s => s !== seat);
    if (this.byPlayer.get(playerId) === duel) this.byPlayer.delete(playerId);
    this.close(duel);
  }

  /** The duel is gone: whoever is still in it is told */
  private close(duel: Duel) {
    if (!this.duels.has(duel.code)) return;
    this.duels.delete(duel.code);
    duel.round++;
    for (const seat of duel.seats) {
      if (this.byPlayer.get(seat.player.id) === duel) this.byPlayer.delete(seat.player.id);
    }
    this.broadcast(duel, { type: 'closed' });
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  private seat(duel: Duel, playerId: number) {
    return duel.seats.find(s => s.player.id === playerId);
  }

  private playerView(seat: Seat): DuelPlayerView {
    return { ...seat.player, connected: seat.connection !== null, moves: seat.moves, wantsRematch: seat.wantsRematch };
  }

  private view(duel: Duel, playerId: number): DuelView {
    const me = this.seat(duel, playerId)!;
    const opponent = duel.seats.find(s => s !== me);
    const over = duel.status === 'over';
    return {
      code: duel.code,
      difficulty: duel.difficulty,
      private: duel.isPrivate,
      status: duel.status,
      level: duel.level && { ...duel.level, minMoves: over ? duel.level.minMoves : 0 },
      startsAt: duel.startsAt,
      serverNow: this.deps.now(),
      me: this.playerView(me),
      opponent: opponent ? this.playerView(opponent) : null,
      result: duel.result,
    };
  }

  private sendTo(duel: Duel, playerId: number, message: ServerMessage) {
    this.seat(duel, playerId)?.connection?.send(message);
  }

  private sendViews(duel: Duel) {
    for (const seat of duel.seats) seat.connection?.send({ type: 'duel', duel: this.view(duel, seat.player.id) });
  }

  private broadcast(duel: Duel, message: ServerMessage, exceptId?: number) {
    for (const seat of duel.seats) if (seat.player.id !== exceptId) seat.connection?.send(message);
  }
}
