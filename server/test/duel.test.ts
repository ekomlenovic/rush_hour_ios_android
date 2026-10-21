import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS, CREATES_WINDOW_MS, Duels, MAX_CREATES, MAX_DUEL_MS, MAX_DUEL_REACTIONS_PER_SECOND, MAX_MESSAGES_PER_SECOND, MAX_SPECTATORS,
  MAX_WRONG_CODES, OVER_TTL_MS, RECONNECT_GRACE_MS, RESULT_TTL_MS, WAITING_TTL_MS,
  normalizeDuelCode, type DuelConnection, type ServerMessage,
} from '../src/duel';
import { ENCOURAGE_COOLDOWN_MS, MAX_REACTIONS, REACTION_IDS, REACTIONS_WINDOW_MS } from '../src/core';
import type { PuzzleGenerator } from '../src/generation';
import { PuzzlePool } from '../src/puzzlePool';
import { openDatabase } from '../src/db';
import { LEVEL, LONG_SOLUTION, fakeGenerator, testServer } from './helpers';

const PLAYERS: Record<string, { id: number; pseudo: string }> = {
  'token-leo': { id: 1, pseudo: 'Léo' },
  'token-emma': { id: 2, pseudo: 'Emma' },
  'token-sam': { id: 3, pseudo: 'Sam' },
  'token-zoe': { id: 4, pseudo: 'Zoé' },
  'token-noa': { id: 5, pseudo: 'Noa' },
  // A crowd, to watch a busy duel
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`token-fan${i}`, { id: 200 + i, pseudo: `Fan${i}` }])),
};

/** Lets the generation of the puzzle (a promise) finish */
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup(generator: PuzzleGenerator = fakeGenerator().generator) {
  const clock = { now: 1_000_000 };
  // An empty pool, not filled: each duel generates its puzzle (the pool has its own tests)
  const duels = new Duels({
    puzzles: new PuzzlePool({ db: openDatabase(':memory:'), generator }),
    now: () => clock.now,
    authenticate: (token) => (token === 'token-banned' ? 'banned' : PLAYERS[token] ?? null),
  });

  /** A phone connected to the duels: what it received, and how it talks; an app that knows the reactions, unless `older` */
  const connect = (token?: string, { older = false } = {}) => {
    const received: ServerMessage[] = [];
    const closed: { code: number; reason: string }[] = [];
    const connection: DuelConnection = {
      send: (m) => received.push(JSON.parse(JSON.stringify(m))),
      close: (code, reason) => { closed.push({ code, reason }); handlers.onClose(); },
    };
    const handlers = duels.connect(connection);
    const send = (message: object) => handlers.onMessage(JSON.stringify(message));
    if (token) send(older ? { type: 'auth', token } : { type: 'auth', token, features: ['reactions'] });
    const last = <T extends ServerMessage['type']>(type: T) =>
      [...received].reverse().find(m => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;
    return { received, closed, send, last, handlers, disconnect: () => handlers.onClose() };
  };

  /** Léo creates a duel, Emma joins it, the countdown is over */
  const started = async (metric?: 'time' | 'moves') => {
    const leo = connect('token-leo');
    const emma = connect('token-emma');
    leo.send({ type: 'create', difficulty: 'HARD', metric });
    emma.send({ type: 'join', code: leo.last('duel')!.duel.code });
    await settle();
    clock.now += COUNTDOWN_MS;
    return { leo, emma };
  };

  return { duels, clock, connect, started };
}

describe('duels', () => {
  it('needs a known player first', () => {
    const { connect } = setup();
    const nobody = connect();
    nobody.send({ type: 'create' });
    expect(nobody.last('error')).toEqual({ type: 'error', error: 'unauthorized' });

    const stranger = connect('token-unknown');
    expect(stranger.closed).toEqual([{ code: 4001, reason: 'unauthorized' }]);
    const banned = connect('token-banned');
    expect(banned.last('error')).toEqual({ type: 'error', error: 'banned' });
    expect(connect('token-leo').last('ready')).toEqual({ type: 'ready', player: { id: 1, pseudo: 'Léo' }, duel: null });
  });

  it('creates a room with a code to give to a friend', () => {
    const { connect } = setup();
    const leo = connect('token-leo');
    leo.send({ type: 'create', difficulty: 'EXPERT' });
    const { duel } = leo.last('duel')!;
    expect(duel).toMatchObject({ status: 'waiting', difficulty: 'EXPERT', level: null, opponent: null, me: { id: 1, pseudo: 'Léo' } });
    expect(duel.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  });

  it('a friend joins: both get the same puzzle, after a countdown, without its optimum', async () => {
    const { connect, clock, calls } = (() => { const fake = fakeGenerator(); return { ...setup(fake.generator), calls: fake.calls }; })();
    const leo = connect('token-leo');
    const emma = connect('token-emma');
    leo.send({ type: 'create', difficulty: 'HARD' });
    expect(calls).toEqual([]);
    const code = leo.last('duel')!.duel.code;
    emma.send({ type: 'join', code: ` ${code.toLowerCase().slice(0, 2)}-${code.slice(2)} ` });
    expect(leo.last('duel')!.duel.status).toBe('preparing');

    await settle();
    expect(calls).toEqual([{ seed: expect.stringMatching(/^duel:[0-9a-f]{32}$/), difficulty: 'HARD' }]);
    const forLeo = leo.last('duel')!.duel;
    const forEmma = emma.last('duel')!.duel;
    expect(forLeo).toMatchObject({ status: 'playing', startsAt: clock.now + COUNTDOWN_MS, serverNow: clock.now, opponent: { pseudo: 'Emma', connected: true } });
    expect(forEmma.opponent).toMatchObject({ pseudo: 'Léo' });
    expect(forLeo.level).toEqual({ ...LEVEL, minMoves: 0 });
    expect(forEmma.level).toEqual(forLeo.level);
  });

  it('refuses a wrong code, a full room, and moves before the start', async () => {
    const { connect, clock } = setup();
    const leo = connect('token-leo');
    const emma = connect('token-emma');
    const sam = connect('token-sam');
    emma.send({ type: 'join', code: 'ZZZZZ' });
    expect(emma.last('error')).toEqual({ type: 'error', error: 'duel_not_found' });

    leo.send({ type: 'create' });
    const code = leo.last('duel')!.duel.code;
    emma.send({ type: 'join', code });
    sam.send({ type: 'join', code });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'duel_full' });

    await settle();
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'not_started' });
    clock.now += COUNTDOWN_MS;
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    expect(leo.last('move')).toBeDefined();
  });

  it('closes the connection of who guesses codes', () => {
    const { connect } = setup();
    const sam = connect('token-sam');
    for (let i = 0; i < MAX_WRONG_CODES; i++) sam.send({ type: 'join', code: `GUES${i}` });
    expect(sam.closed).toEqual([{ code: 4029, reason: 'rate_limited' }]);
  });

  it('each move is checked and shown to both, with the time of the server', async () => {
    const { started, clock } = setup();
    const { leo, emma } = await started();
    clock.now += 1500;
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    const move = { type: 'move', playerId: 1, move: { vehicleId: 'v1', delta: 2, t: 1500 } };
    expect(leo.last('move')).toEqual(move);
    expect(emma.last('move')).toEqual(move);

    // Through another vehicle: refused, and the phone gets the position of the server back
    const before = emma.received.length;
    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(emma.last('error')).toEqual({ type: 'error', error: 'invalid_moves' });
    expect(emma.last('duel')!.duel.me.moves).toEqual([]);
    expect(leo.received.filter(m => m.type === 'move')).toHaveLength(1);
    expect(emma.received.length).toBe(before + 2);
  });

  it('the first win seen by the server wins the duel, and the optimum is shown', async () => {
    const { started, clock } = setup();
    const { leo, emma } = await started();
    clock.now += 2000;
    emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    clock.now += 3000;
    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    const end = { type: 'end', result: { winnerId: 2, reason: 'won', timeMs: 5000, minMoves: 2, duelId: null, score: null }, level: LEVEL };
    expect(leo.last('end')).toEqual(end);
    expect(emma.last('end')).toEqual(end);

    // Too late for Léo
    leo.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'no_duel' });
  });

  it('a duel on moves: who got out first waits, the fewest moves wins', async () => {
    const { started, clock } = setup();
    const { leo, emma } = await started('moves');
    expect(leo.last('duel')!.duel.metric).toBe('moves');
    // Léo out first, in 4 moves: Emma may still do better
    for (const move of LONG_SOLUTION) {
      clock.now += 1000;
      leo.send({ type: 'move', vehicleId: move.vehicleId, delta: move.delta });
    }
    expect(leo.last('end')).toBeUndefined();
    // Nothing more to play for Léo
    leo.send({ type: 'move', vehicleId: 'v2', delta: 1 });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'invalid_moves' });

    // Emma, slower but in 2 moves, wins
    clock.now += 5000;
    emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(leo.last('end')!.result).toMatchObject({ winnerId: 2, reason: 'won', timeMs: 9000, minMoves: 2 });
  });

  it('a duel on moves ends once the other can no longer do as well', async () => {
    const { started, clock } = setup();
    // Léo out in 4 moves, Emma at 3 already: she may still tie
    const { leo, emma } = await started('moves');
    emma.send({ type: 'move', vehicleId: 'v2', delta: 1 });
    emma.send({ type: 'move', vehicleId: 'v2', delta: -1 });
    emma.send({ type: 'move', vehicleId: 'v2', delta: 1 });
    for (const move of LONG_SOLUTION) leo.send({ type: 'move', vehicleId: move.vehicleId, delta: move.delta });
    expect(leo.last('end')).toBeUndefined();
    // At 4 moves, still in: 5 at least, she cannot do as well
    clock.now += 1000;
    emma.send({ type: 'move', vehicleId: 'v2', delta: -1 });
    expect(emma.last('end')!.result).toMatchObject({ winnerId: 1, reason: 'won' });
  });

  it('a duel on moves: the same count is a draw, whoever was faster', async () => {
    const { started, clock } = setup();
    // Léo at the optimum, at once: Emma may still tie it
    const first = await started('moves');
    first.leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    first.leo.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(first.emma.last('end')).toBeUndefined();
    clock.now += 20_000;
    first.emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    first.emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    const end = first.leo.last('end')!.result;
    expect(end).toMatchObject({ winnerId: null, reason: 'won', minMoves: 2 });
    expect(first.emma.last('end')!.result).toEqual(end);
  });

  it('a duel on moves: who got out may leave, and finds the result when coming back', async () => {
    const { started, connect, clock, duels } = setup();
    const { leo, emma } = await started('moves');
    for (const move of LONG_SOLUTION) leo.send({ type: 'move', vehicleId: move.vehicleId, delta: move.delta });
    // Léo leaves the screen: not a forfeit, the duel goes on for Emma
    leo.send({ type: 'leave' });
    leo.disconnect();
    expect(emma.last('end')).toBeUndefined();
    expect(emma.last('presence')).toEqual({ type: 'presence', playerId: 1, connected: false });
    clock.now += RECONNECT_GRACE_MS + 1;
    duels.sweep();
    expect(emma.last('end')).toBeUndefined();
    // His duel, under way, in his list
    expect(duels.list(1)).toMatchObject([{ status: 'playing', mine: true }]);
    // Still in it: no other duel meanwhile
    const away = connect('token-leo');
    away.send({ type: 'create' });
    expect(away.last('error')).toEqual({ type: 'error', error: 'already_in_duel' });
    away.disconnect();

    // Emma finishes, in 2 moves: she wins; no rematch with nobody
    emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(emma.last('end')!.result).toMatchObject({ winnerId: 2, reason: 'won' });
    emma.send({ type: 'rematch' });
    expect(emma.last('error')).toEqual({ type: 'error', error: 'opponent_left' });
    // Emma goes: the result still waits for Léo, and is in his list only
    emma.send({ type: 'leave' });
    expect(duels.list(2)).toEqual([]);
    expect(duels.list(1)).toMatchObject([{ status: 'over', mine: true }]);

    clock.now += OVER_TTL_MS + 1;
    duels.sweep();
    const back = connect('token-leo');
    expect(back.last('ready')!.duel).toMatchObject({
      status: 'over', result: { winnerId: 2, reason: 'won' }, me: { moves: LONG_SOLUTION.map(m => ({ vehicleId: m.vehicleId, delta: m.delta })) },
      opponent: { id: 2, connected: false, moves: [{ vehicleId: 'v1' }, { vehicleId: 'target' }] },
    });
    // Seen: gone once he leaves
    back.disconnect();
    expect(duels.size).toBe(0);
  });

  it('a finished duel on moves waits a day at most for who got out and left', async () => {
    const { started, clock, duels } = setup();
    const { leo, emma } = await started('moves');
    for (const move of LONG_SOLUTION) leo.send({ type: 'move', vehicleId: move.vehicleId, delta: move.delta });
    leo.disconnect();
    emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    emma.disconnect();
    clock.now += RESULT_TTL_MS - 1;
    duels.sweep();
    expect(duels.size).toBe(1);
    clock.now += 2;
    duels.sweep();
    expect(duels.size).toBe(0);
    expect(duels.duelOf(1)).toBeNull();
  });

  it('a duel on moves: who got out may lose the connection, the time limit goes to them', async () => {
    const { started, clock, duels } = setup();
    const { leo, emma } = await started('moves');
    for (const move of LONG_SOLUTION) leo.send({ type: 'move', vehicleId: move.vehicleId, delta: move.delta });
    leo.disconnect();
    clock.now += RECONNECT_GRACE_MS + 1;
    duels.sweep();
    expect(emma.last('end')).toBeUndefined();
    clock.now = 1_000_000 + COUNTDOWN_MS + MAX_DUEL_MS + 1;
    duels.sweep();
    expect(emma.last('end')!.result).toMatchObject({ winnerId: 1, reason: 'won' });
  });

  it('each board has the look of its player, for the opponent and the spectators', async () => {
    const { connect, clock } = setup();
    const leo = connect();
    leo.send({ type: 'auth', token: 'token-leo', look: { board: 'neon', skin: 'taxi', palette: 'ocean' } });
    // Not a look: the player still plays, drawn as the viewer's own board
    const emma = connect();
    emma.send({ type: 'auth', token: 'token-emma', look: { board: 'NEON!', skin: 'taxi', palette: 'ocean' } });
    expect(emma.last('ready')).toBeDefined();
    leo.send({ type: 'create', metric: 'time' });
    emma.send({ type: 'join', code: leo.last('duel')!.duel.code });
    await settle();
    clock.now += COUNTDOWN_MS;
    expect(emma.last('duel')!.duel.opponent).toMatchObject({ id: 1, look: { board: 'neon', skin: 'taxi', palette: 'ocean' } });
    expect(leo.last('duel')!.duel.opponent).toMatchObject({ id: 2, look: null });

    const sam = connect('token-sam');
    sam.send({ type: 'watch', code: leo.last('duel')!.duel.code });
    expect(sam.last('duel')!.duel).toMatchObject({ me: { id: 1, look: { skin: 'taxi' } }, opponent: { id: 2, look: null } });

    // Back with another look: the new one
    leo.disconnect();
    const back = connect();
    back.send({ type: 'auth', token: 'token-leo', look: { board: 'wood', skin: 'bus', palette: 'classic' } });
    expect(back.last('ready')!.duel!.me.look).toEqual({ board: 'wood', skin: 'bus', palette: 'classic' });
  });

  it('refuses an unknown metric', () => {
    const { connect } = setup();
    const leo = connect('token-leo');
    leo.send({ type: 'create', metric: 'luck' });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'invalid_request' });
    leo.send({ type: 'create' });
    expect(leo.last('duel')!.duel.metric).toBe('time');
  });

  it('a rematch when both want it: a new puzzle', async () => {
    const fake = fakeGenerator();
    const { started, clock } = setup(fake.generator);
    const { leo, emma } = await started();
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    leo.send({ type: 'move', vehicleId: 'target', delta: 4 });

    leo.send({ type: 'rematch' });
    expect(emma.last('rematch')).toEqual({ type: 'rematch', playerId: 1 });
    expect(emma.last('duel')!.duel.status).toBe('playing');
    expect(fake.calls).toHaveLength(1);
    emma.send({ type: 'rematch' });
    await settle();
    // A new puzzle
    expect(fake.calls).toHaveLength(2);
    const duel = leo.last('duel')!.duel;
    expect(duel).toMatchObject({ status: 'playing', result: null, startsAt: clock.now + COUNTDOWN_MS, me: { moves: [], wantsRematch: false } });
  });

  it('leaving a game is losing it', async () => {
    const { started, duels } = setup();
    const { leo, emma } = await started();
    leo.send({ type: 'leave' });
    expect(emma.last('end')!.result).toMatchObject({ winnerId: 2, reason: 'forfeit' });
    // No rematch with nobody
    expect(emma.last('closed')).toEqual({ type: 'closed' });
    expect(duels.size).toBe(0);
  });

  it('a player who lost the connection comes back to the duel where it was', async () => {
    const { started, connect, clock } = setup();
    const { leo, emma } = await started();
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    leo.disconnect();
    expect(emma.last('presence')).toEqual({ type: 'presence', playerId: 1, connected: false });

    clock.now += RECONNECT_GRACE_MS - 1000;
    const back = connect('token-leo');
    expect(back.last('ready')!.duel).toMatchObject({ status: 'playing', me: { moves: [{ vehicleId: 'v1', delta: 2 }] } });
    expect(emma.last('presence')).toEqual({ type: 'presence', playerId: 1, connected: true, seesReactions: true });
    back.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(emma.last('end')!.result.winnerId).toBe(1);
  });

  it('a player who does not come back in time loses', async () => {
    const { started, duels, clock } = setup();
    const { leo, emma } = await started();
    leo.disconnect();
    clock.now += RECONNECT_GRACE_MS + 1;
    duels.sweep();
    expect(emma.last('end')!.result).toMatchObject({ winnerId: 2, reason: 'disconnected' });
    expect(duels.duelOf(1)).toBeNull();
  });

  it('a second phone of the same player replaces the first one', () => {
    const { connect } = setup();
    const first = connect('token-leo');
    connect('token-leo');
    expect(first.closed).toEqual([{ code: 4000, reason: 'replaced' }]);
  });

  it('closes rooms nobody joined, games too long, and finished duels', async () => {
    const { connect, started, duels, clock } = setup();
    const sam = connect('token-sam');
    sam.send({ type: 'create' });
    clock.now += WAITING_TTL_MS + 1;
    duels.sweep();
    expect(sam.last('closed')).toEqual({ type: 'closed' });

    const { leo } = await started();
    clock.now += MAX_DUEL_MS + 1;
    duels.sweep();
    expect(leo.last('end')!.result).toMatchObject({ winnerId: null, reason: 'timeout' });
    clock.now += OVER_TTL_MS + 1;
    duels.sweep();
    expect(duels.size).toBe(0);
  });

  it('a puzzle that cannot be generated closes the duel', async () => {
    const { connect } = setup(fakeGenerator(null).generator);
    const leo = connect('token-leo');
    const emma = connect('token-emma');
    leo.send({ type: 'create' });
    emma.send({ type: 'join', code: leo.last('duel')!.duel.code });
    await settle();
    expect(emma.last('error')).toEqual({ type: 'error', error: 'puzzle_unavailable' });
    expect(emma.last('closed')).toEqual({ type: 'closed' });
  });

  it('lists the public duels of the server: open ones to join first, then the ones being played', async () => {
    const { connect, duels, clock } = setup();
    const leo = connect('token-leo');
    const emma = connect('token-emma');
    const sam = connect('token-sam');
    leo.send({ type: 'create', difficulty: 'HARD' });
    clock.now += 1000;
    emma.send({ type: 'create', difficulty: 'EASY', private: true });
    expect(emma.last('duel')!.duel.private).toBe(true);

    // Sam sees Léo's duel only, with its code: no need to be given it
    const forSam = duels.list(3);
    expect(forSam).toEqual([{
      code: leo.last('duel')!.duel.code, difficulty: 'HARD', metric: 'time', status: 'waiting', private: false,
      players: [{ id: 1, pseudo: 'Léo' }], createdAt: 1_000_000, startsAt: null, mine: false, spectators: 0,
    }]);
    // Emma sees her private duel too
    expect(duels.list(2).map(d => [d.players[0].pseudo, d.mine])).toEqual([['Emma', true], ['Léo', false]]);

    sam.send({ type: 'join', code: forSam[0].code! });
    await settle();
    const playing = duels.list(2).find(d => d.status === 'playing')!;
    // With its code, to watch it
    expect(playing).toMatchObject({ code: forSam[0].code, players: [{ pseudo: 'Léo' }, { pseudo: 'Sam' }], mine: false });
  });

  it('a spectator sees both boards live, and the players see how many watch', async () => {
    const { connect, started, duels } = setup();
    const { leo, emma } = await started();
    const code = leo.last('duel')!.duel.code;
    leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });

    const sam = connect('token-sam');
    sam.send({ type: 'watch', code: code.toLowerCase() });
    // From where the game is, as seen by Léo, without the optimum
    expect(sam.last('duel')!.duel).toMatchObject({
      code, status: 'playing', spectating: true, spectators: 1,
      me: { id: 1, moves: [{ vehicleId: 'v1', delta: 2 }] }, opponent: { id: 2, moves: [] }, level: { minMoves: 0 },
    });
    expect(leo.last('spectators')).toEqual({ type: 'spectators', count: 1 });
    expect(emma.last('spectators')).toEqual({ type: 'spectators', count: 1 });
    expect(duels.list(1)[0].spectators).toBe(1);

    emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    expect(sam.last('move')).toMatchObject({ playerId: 2, move: { vehicleId: 'v1', delta: 2 } });
    // Nothing to play
    sam.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'no_duel' });
    sam.send({ type: 'rematch' });
    expect(leo.last('rematch')).toBeUndefined();

    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(sam.last('end')!.result).toMatchObject({ winnerId: 2, reason: 'won' });

    // A rematch: the spectator sees the new game
    leo.send({ type: 'rematch' });
    emma.send({ type: 'rematch' });
    await settle();
    expect(sam.last('duel')!.duel).toMatchObject({ status: 'playing', spectating: true, me: { moves: [] } });

    // Gone: the players are told
    sam.send({ type: 'leave' });
    expect(leo.last('spectators')).toEqual({ type: 'spectators', count: 0 });
    expect(duels.duelOf(1)!.spectators).toBe(0);
  });

  it('watching: a wrong code, a private duel with its code, my own duel, and leaving a room to watch', async () => {
    const { connect, duels } = setup();
    const leo = connect('token-leo');
    const emma = connect('token-emma');
    const sam = connect('token-sam');
    sam.send({ type: 'watch', code: 'ZZZZZ' });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'duel_not_found' });

    // A private duel: whoever has the code watches it, even before an opponent comes
    leo.send({ type: 'create', private: true });
    const code = leo.last('duel')!.duel.code;
    sam.send({ type: 'watch', code });
    expect(sam.last('duel')!.duel).toMatchObject({ status: 'waiting', spectating: true, me: { id: 1 }, opponent: null });
    // Léo, watching his own duel: he is its player
    leo.send({ type: 'watch', code });
    expect(leo.last('duel')!.duel).toMatchObject({ spectating: false, spectators: 1 });

    // Emma leaves her open room to watch
    emma.send({ type: 'create' });
    const emmaCode = emma.last('duel')!.duel.code;
    emma.send({ type: 'watch', code });
    expect(duels.duelOf(2)).toBeNull();
    expect(duels.list(3).map(d => d.code)).not.toContain(emmaCode);
    expect(leo.last('spectators')).toEqual({ type: 'spectators', count: 2 });

    // Sam stops watching to play it, Emma still watches
    sam.send({ type: 'join', code });
    await settle();
    expect(emma.last('duel')!.duel).toMatchObject({ status: 'playing', spectators: 1, me: { id: 1 }, opponent: { id: 3 } });

    // The duel is gone: the spectators are told
    leo.send({ type: 'leave' });
    sam.send({ type: 'leave' });
    expect(emma.last('closed')).toEqual({ type: 'closed' });
  });

  it('a spectator who loses the connection no longer counts, and a duel has a limit of spectators', async () => {
    const { connect, started, duels } = setup();
    const { leo } = await started();
    const code = leo.last('duel')!.duel.code;
    const sam = connect('token-sam');
    sam.send({ type: 'watch', code });
    sam.disconnect();
    expect(leo.last('spectators')).toEqual({ type: 'spectators', count: 0 });

    // A player of the duel can not watch another one
    const zoe = connect('token-zoe');
    zoe.send({ type: 'create' });
    leo.send({ type: 'watch', code: zoe.last('duel')!.duel.code });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'already_in_duel' });

    const full = duels as unknown as { duels: Map<string, { spectators: Set<number> }> };
    const spectators = full.duels.get(code)!.spectators;
    for (let id = 100; spectators.size < MAX_SPECTATORS; id++) spectators.add(id);
    zoe.send({ type: 'watch', code });
    expect(zoe.last('error')).toEqual({ type: 'error', error: 'too_many_spectators' });
  });

  it('a spectator teases, cheers or encourages a player: everyone in the duel sees it', async () => {
    const { connect, started } = setup();
    const { leo, emma } = await started();
    const code = leo.last('duel')!.duel.code;
    const sam = connect('token-sam');
    const zoe = connect('token-zoe');
    sam.send({ type: 'watch', code });
    zoe.send({ type: 'watch', code });
    // The server says which reactions it relays: the app offers only those
    expect(sam.last('duel')!.duel.reactions).toEqual(REACTION_IDS);
    expect(leo.last('duel')!.duel.reactions).toEqual(REACTION_IDS);

    sam.send({ type: 'react', playerId: 2, reaction: 'snail' });
    const snail = { type: 'reaction', from: { id: 3, pseudo: 'Sam' }, playerId: 2, reaction: 'snail' };
    // The two players and every spectator, Sam too: it shows over the board of Emma
    for (const phone of [leo, emma, sam, zoe]) expect(phone.last('reaction')).toEqual(snail);
    zoe.send({ type: 'react', playerId: 1, reaction: 'encourage' });
    expect(leo.last('reaction')).toEqual({ type: 'reaction', from: { id: 4, pseudo: 'Zoé' }, playerId: 1, reaction: 'encourage' });

    // Someone who does not watch it sees nothing
    const noa = connect('token-noa');
    sam.send({ type: 'react', playerId: 1, reaction: 'popcorn' });
    expect(noa.last('reaction')).toBeUndefined();
  });

  it('a player teases or encourages the other one, seen by the spectators too', async () => {
    const { connect, started } = setup();
    const { leo, emma } = await started();
    const sam = connect('token-sam');
    sam.send({ type: 'watch', code: leo.last('duel')!.duel.code });
    emma.send({ type: 'react', playerId: 1, reaction: 'popcorn' });
    const popcorn = { type: 'reaction', from: { id: 2, pseudo: 'Emma' }, playerId: 1, reaction: 'popcorn' };
    for (const phone of [leo, emma, sam]) expect(phone.last('reaction')).toEqual(popcorn);
    // Who has finished (duel on moves) may still tease the other one: covered by the same rule, the game goes on
    leo.send({ type: 'react', playerId: 2, reaction: 'encourage' });
    expect(emma.last('reaction')).toMatchObject({ from: { id: 1 }, playerId: 2, reaction: 'encourage' });
  });

  it('an app older than the reactions is never sent one: it would break on it', async () => {
    const { connect, clock, duels } = setup();
    // Léo has the old app, Emma the new one
    const leo = connect('token-leo', { older: true });
    const emma = connect('token-emma');
    leo.send({ type: 'create', difficulty: 'HARD' });
    const code = leo.last('duel')!.duel.code;
    emma.send({ type: 'join', code });
    await settle();
    clock.now += COUNTDOWN_MS;
    const oldSam = connect('token-sam', { older: true });
    const zoe = connect('token-zoe');
    oldSam.send({ type: 'watch', code });
    zoe.send({ type: 'watch', code });
    // The others know whose app shows the reactions
    expect(zoe.last('duel')!.duel).toMatchObject({ me: { id: 1, seesReactions: false }, opponent: { id: 2, seesReactions: true } });
    expect(duels.duelOf(2)).toMatchObject({ opponent: { seesReactions: false } });

    zoe.send({ type: 'react', playerId: 1, reaction: 'snail' });
    emma.send({ type: 'react', playerId: 1, reaction: 'yawn' });
    zoe.send({ type: 'react', playerId: 2, reaction: 'clap' });
    for (const phone of [leo, oldSam]) expect(phone.received.map(m => m.type)).not.toContain('reaction');
    expect(emma.received.filter(m => m.type === 'reaction')).toHaveLength(3);
    expect(zoe.received.filter(m => m.type === 'reaction')).toHaveLength(3);

    // Back with the new app: sent again, and the others know it
    leo.disconnect();
    const back = connect('token-leo');
    expect(back.last('ready')!.duel).toMatchObject({ me: { seesReactions: true } });
    expect(emma.last('presence')).toEqual({ type: 'presence', playerId: 1, connected: true, seesReactions: true });
    zoe.send({ type: 'react', playerId: 1, reaction: 'fire' });
    expect(back.last('reaction')).toMatchObject({ reaction: 'fire' });
    // The old app again, on another phone, replacing the connection at once: said too
    const oldPhone = connect('token-leo', { older: true });
    expect(emma.last('presence')).toEqual({ type: 'presence', playerId: 1, connected: true, seesReactions: false });
    emma.send({ type: 'react', playerId: 1, reaction: 'snail' });
    expect(oldPhone.received.map(m => m.type)).not.toContain('reaction');
    // Features it does not know, or a list that is not one, are not a reason to refuse the app
    const newer = connect();
    newer.send({ type: 'auth', token: 'token-noa', features: ['reactions', 'holograms'] });
    expect(newer.last('ready')).toMatchObject({ player: { id: 5 } });
    const odd = connect();
    odd.send({ type: 'auth', token: 'token-noa', features: 'reactions' });
    expect(odd.last('ready')).toMatchObject({ player: { id: 5 } });
  });

  it('a reaction goes during the game, to a player of the duel, from the list only', async () => {
    const { connect, started } = setup();
    const { leo, emma } = await started();
    const code = leo.last('duel')!.duel.code;
    const sam = connect('token-sam');
    sam.send({ type: 'watch', code });

    // A player does not react to themselves
    leo.send({ type: 'react', playerId: 1, reaction: 'muscle' });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'reaction_refused' });
    expect(emma.last('reaction')).toBeUndefined();
    // Nobody of the duel, no free text
    sam.send({ type: 'react', playerId: 4, reaction: 'snail' });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'reaction_refused' });
    for (const bad of [{ playerId: 2, reaction: 'Tu es nul' }, { playerId: '2', reaction: 'snail' }, { playerId: 2 }]) {
      sam.received.length = 0;
      sam.send({ type: 'react', ...bad });
      expect(sam.last('error')).toEqual({ type: 'error', error: 'invalid_request' });
    }
    expect(leo.last('reaction')).toBeUndefined();

    // After the end: the result, nothing more
    emma.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    emma.send({ type: 'move', vehicleId: 'target', delta: 4 });
    sam.send({ type: 'react', playerId: 2, reaction: 'clap' });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'reaction_refused' });

    // Nor before the game: an open room has no board to react to
    const zoe = connect('token-zoe');
    zoe.send({ type: 'create', private: true });
    const noa = connect('token-noa');
    noa.send({ type: 'watch', code: zoe.last('duel')!.duel.code });
    noa.send({ type: 'react', playerId: 4, reaction: 'yawn' });
    expect(noa.last('error')).toEqual({ type: 'error', error: 'reaction_refused' });
    expect(zoe.last('reaction')).toBeUndefined();
  });

  it('a few reactions at most: by spectator, by duel, and one encouragement to a player in a while', async () => {
    const { connect, started, clock } = setup();
    const { leo } = await started();
    const code = leo.last('duel')!.duel.code;
    const [sam, zoe, noa] = ['token-sam', 'token-zoe', 'token-noa'].map(token => connect(token));
    for (const spectator of [sam, zoe, noa]) spectator.send({ type: 'watch', code });
    const relayed = () => leo.received.filter(m => m.type === 'reaction').length;

    for (let i = 0; i < MAX_REACTIONS; i++) sam.send({ type: 'react', playerId: 1, reaction: 'yawn' });
    expect(relayed()).toBe(MAX_REACTIONS);
    // One more is dropped, and the connection stays
    sam.send({ type: 'react', playerId: 1, reaction: 'yawn' });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'too_many_reactions' });
    expect(relayed()).toBe(MAX_REACTIONS);
    expect(sam.closed).toEqual([]);

    // A whole duel: a few in a second, whoever sends them
    for (let i = 0; i < MAX_DUEL_REACTIONS_PER_SECOND - MAX_REACTIONS; i++) zoe.send({ type: 'react', playerId: 2, reaction: 'fire' });
    expect(relayed()).toBe(MAX_DUEL_REACTIONS_PER_SECOND);
    noa.send({ type: 'react', playerId: 2, reaction: 'fire' });
    expect(noa.last('error')).toEqual({ type: 'error', error: 'too_many_reactions' });
    clock.now += 1000;
    noa.send({ type: 'react', playerId: 2, reaction: 'fire' });
    expect(relayed()).toBe(MAX_DUEL_REACTIONS_PER_SECOND + 1);

    // A busy duel goes on relaying a few each second: the reactions dropped do not count
    clock.now += REACTIONS_WINDOW_MS;
    const fans = Array.from({ length: 10 }, (_, i) => connect(`token-fan${i}`));
    for (const fan of fans) fan.send({ type: 'watch', code });
    for (let second = 0; second < 3; second++) {
      const start = relayed();
      for (let k = 0; k < MAX_DUEL_REACTIONS_PER_SECOND + 2; k++) fans[(second * 12 + k) % fans.length].send({ type: 'react', playerId: 1, reaction: 'popcorn' });
      expect(relayed() - start).toBe(MAX_DUEL_REACTIONS_PER_SECOND);
      clock.now += 1000;
    }

    // Later, Sam reacts again; one encouragement to each player, not two to the same one
    clock.now += REACTIONS_WINDOW_MS;
    const before = relayed();
    sam.send({ type: 'react', playerId: 1, reaction: 'encourage' });
    sam.send({ type: 'react', playerId: 2, reaction: 'encourage' });
    sam.send({ type: 'react', playerId: 1, reaction: 'encourage' });
    expect(sam.last('error')).toEqual({ type: 'error', error: 'too_many_reactions' });
    expect(relayed()).toBe(before + 2);
    clock.now += ENCOURAGE_COOLDOWN_MS;
    sam.send({ type: 'react', playerId: 1, reaction: 'encourage' });
    expect(relayed()).toBe(before + 3);
  });


  it('closes a connection that floods the server, even before saying who it is', () => {
    const { connect, clock } = setup();
    const leo = connect('token-leo');
    clock.now += 1000;
    for (let i = 0; i < MAX_MESSAGES_PER_SECOND; i++) leo.send({ type: 'leave' });
    expect(leo.closed).toEqual([]);
    leo.send({ type: 'leave' });
    expect(leo.closed).toEqual([{ code: 4029, reason: 'rate_limited' }]);

    const stranger = connect();
    for (let i = 0; i <= MAX_MESSAGES_PER_SECOND; i++) stranger.send({ type: 'create' });
    expect(stranger.closed).toEqual([{ code: 4029, reason: 'rate_limited' }]);
  });

  it('limits the duels a player creates: each one takes a puzzle of the pool', () => {
    const { connect, clock } = setup();
    const leo = connect('token-leo');
    for (let i = 0; i < MAX_CREATES; i++) {
      leo.send({ type: 'create', difficulty: 'MASTER' });
      clock.now += 1000;
    }
    expect(leo.last('error')).toBeUndefined();
    leo.send({ type: 'create', difficulty: 'MASTER' });
    expect(leo.last('error')).toEqual({ type: 'error', error: 'rate_limited' });
    clock.now += CREATES_WINDOW_MS;
    leo.send({ type: 'create' });
    expect(leo.last('duel')!.duel.difficulty).toBe('NORMAL');
  });

  it('a create refused during a duel does not count in the limit', async () => {
    const { started, clock, duels } = setup();
    const { leo } = await started();
    for (let i = 0; i <= MAX_CREATES; i++) {
      leo.send({ type: 'create' });
      clock.now += 1000;
    }
    expect(leo.received.filter(m => m.type === 'error').map(m => (m as { error: string }).error))
      .toEqual(Array(MAX_CREATES + 1).fill('already_in_duel'));
    // Once the duel is over, the player can create the next one
    duels.kick(2, 'banned');
    leo.send({ type: 'create' });
    expect(leo.last('duel')!.duel.status).toBe('waiting');
  });

  it('counts the wrong codes by player: connecting again gives no more tries', () => {
    const { connect, clock } = setup();
    const first = connect('token-sam');
    for (let i = 0; i < MAX_WRONG_CODES / 2; i++) first.send({ type: 'join', code: `GUES${i}` });
    first.disconnect();
    clock.now += 2000;
    const second = connect('token-sam');
    for (let i = 0; i < MAX_WRONG_CODES / 2; i++) second.send({ type: 'join', code: `GUSS${i}` });
    expect(second.closed).toEqual([{ code: 4029, reason: 'rate_limited' }]);
  });

  it('a kicked player (excluded, deleted, signed in elsewhere) loses their game at once', async () => {
    const { started, duels } = setup();
    const { leo, emma } = await started();
    duels.kick(1, 'banned');
    expect(emma.last('end')!.result).toMatchObject({ winnerId: 2, reason: 'forfeit' });
    expect(leo.closed).toEqual([{ code: 4003, reason: 'banned' }]);
    expect(duels.duelOf(1)).toBeNull();
  });

  it('normalizes the codes typed by the players', () => {
    expect(normalizeDuelCode(' ab-c d3 ')).toBe('ABCD3');
  });
});

describe('duels over a WebSocket', () => {
  let server: ReturnType<typeof testServer>;
  afterEach(async () => { await server?.app.close(); });

  it('/duels lists the duels for a player of the server', async () => {
    server = testServer();
    const leo = await server.join('Léo');
    expect(await server.request('GET', '/duels', leo.token)).toEqual({
      status: 200, body: { duels: [], ready: { EASY: 0, NORMAL: 0, HARD: 0, EXPERT: 0, MASTER: 0 }, metrics: ['time', 'moves'] },
    });
    expect((await server.request('GET', '/duels')).status).toBe(401);
  });

  /** A WebSocket to the server of the test, and how it ended */
  const socketTo = async () => {
    if (!server.app.server.listening) await server.app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = server.app.server.address() as AddressInfo;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/duel`);
    const closed = new Promise<{ code: number; reason: string }>(resolve => { ws.onclose = (e) => resolve({ code: e.code, reason: e.reason }); });
    await new Promise(resolve => { ws.onopen = resolve; ws.onerror = resolve; });
    return { ws, closed };
  };

  it('closes a connection that never says who it is', async () => {
    server = testServer({ duelLimits: { authTimeoutMs: 100 } });
    const { closed } = await socketTo();
    expect(await closed).toEqual({ code: 4001, reason: 'unauthorized' });
  });

  it('a few connections per address at most', async () => {
    server = testServer({ duelLimits: { socketsPerIp: 2 } });
    const a = await socketTo();
    const b = await socketTo();
    const c = await socketTo();
    expect(await c.closed).toEqual({ code: 4029, reason: 'rate_limited' });
    // A closed one frees its place
    a.ws.close();
    await a.closed;
    const d = await socketTo();
    expect(d.ws.readyState).toBe(WebSocket.OPEN);
    b.ws.close();
    d.ws.close();
  });

  it('a message too big closes the connection, the server goes on', async () => {
    server = testServer();
    const { ws, closed } = await socketTo();
    ws.send('x'.repeat(10_000));
    expect((await closed).code).toBe(1009);
    expect((await server.request('GET', '/info')).status).toBe(200);
  });

  it('excluding a player closes their duel connection', async () => {
    server = testServer();
    const leo = await server.join('Léo');
    const admin = await server.joinAdmin();
    const { ws, closed } = await socketTo();
    ws.send(JSON.stringify({ type: 'auth', token: leo.token }));
    await new Promise(resolve => { ws.onmessage = resolve; });
    await server.request('PATCH', `/admin/players/${leo.player.id}`, admin.token, { banned: true });
    expect(await closed).toEqual({ code: 4003, reason: 'banned' });
  });

  it('deleting an account from the web page closes its duel connection', async () => {
    server = testServer();
    const leo = await server.join('Léo');
    const { ws, closed } = await socketTo();
    ws.send(JSON.stringify({ type: 'auth', token: leo.token }));
    await new Promise(resolve => { ws.onmessage = resolve; });
    const res = await server.app.inject({
      method: 'POST', url: '/delete-account',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `code=${encodeURIComponent(leo.recoveryCode)}`,
    });
    expect(res.statusCode).toBe(200);
    expect(await closed).toEqual({ code: 4003, reason: 'deleted' });
  });

  it('/info tells the app the server has duels', async () => {
    server = testServer();
    expect((await server.request('GET', '/info')).body.features).toEqual(['duel', 'ranking_range', 'reactions']);
  });

  it('two players of the server play a duel', async () => {
    server = testServer();
    const { app, join } = server;
    const [leo, emma] = [await join('Léo'), await join('Emma')];
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;

    const open = async (token: string) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/duel`);
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      const messages: ServerMessage[] = [];
      const waiters: (() => void)[] = [];
      ws.onmessage = (event) => {
        messages.push(JSON.parse(String(event.data)));
        waiters.splice(0).forEach(w => w());
      };
      const next = async <T extends ServerMessage['type']>(type: T, check: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true) => {
        for (;;) {
          const found = messages.find(m => m.type === type && check(m as Extract<ServerMessage, { type: T }>));
          if (found) return found as Extract<ServerMessage, { type: T }>;
          await new Promise<void>(resolve => waiters.push(resolve));
        }
      };
      ws.send(JSON.stringify({ type: 'auth', token }));
      await next('ready');
      return { ws, next, send: (m: object) => ws.send(JSON.stringify(m)) };
    };

    const a = await open(leo.token);
    const b = await open(emma.token);
    a.send({ type: 'create', difficulty: 'EASY' });
    const { duel } = await a.next('duel');
    b.send({ type: 'join', code: duel.code });
    const playing = await b.next('duel', m => m.duel.status === 'playing');
    expect(playing.duel.opponent).toMatchObject({ pseudo: 'Léo' });

    server.clock.now += COUNTDOWN_MS;
    b.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    b.send({ type: 'move', vehicleId: 'target', delta: 4 });
    const end = await a.next('end');
    expect(end.result).toMatchObject({ winnerId: emma.player.id, reason: 'won' });
    expect((await a.next('move')).move).toMatchObject({ vehicleId: 'v1', delta: 2 });
    a.ws.close();
    b.ws.close();
  });
});
