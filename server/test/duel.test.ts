import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS, CREATES_WINDOW_MS, Duels, MAX_CREATES, MAX_DUEL_MS, MAX_MESSAGES_PER_SECOND, MAX_WRONG_CODES, OVER_TTL_MS,
  RECONNECT_GRACE_MS, WAITING_TTL_MS,
  normalizeDuelCode, type DuelConnection, type ServerMessage,
} from '../src/duel';
import type { PuzzleGenerator } from '../src/generation';
import { PuzzlePool } from '../src/puzzlePool';
import { openDatabase } from '../src/db';
import { LEVEL, LONG_SOLUTION, fakeGenerator, testServer } from './helpers';

const PLAYERS: Record<string, { id: number; pseudo: string }> = {
  'token-leo': { id: 1, pseudo: 'Léo' },
  'token-emma': { id: 2, pseudo: 'Emma' },
  'token-sam': { id: 3, pseudo: 'Sam' },
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

  /** A phone connected to the duels: what it received, and how it talks */
  const connect = (token?: string) => {
    const received: ServerMessage[] = [];
    const closed: { code: number; reason: string }[] = [];
    const connection: DuelConnection = {
      send: (m) => received.push(JSON.parse(JSON.stringify(m))),
      close: (code, reason) => { closed.push({ code, reason }); handlers.onClose(); },
    };
    const handlers = duels.connect(connection);
    const send = (message: object) => handlers.onMessage(JSON.stringify(message));
    if (token) send({ type: 'auth', token });
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

  it('a duel on moves ends once the other can no longer do better', async () => {
    const { started, clock } = setup();
    // The optimum: nobody can beat it
    const first = await started('moves');
    first.leo.send({ type: 'move', vehicleId: 'v1', delta: 2 });
    first.leo.send({ type: 'move', vehicleId: 'target', delta: 4 });
    expect(first.emma.last('end')!.result).toMatchObject({ winnerId: 1, reason: 'won' });
    first.leo.send({ type: 'leave' });

    // Léo out in 4 moves, Emma at 3 already: the same count, slower, would lose
    const second = await started('moves');
    second.emma.send({ type: 'move', vehicleId: 'v2', delta: 1 });
    second.emma.send({ type: 'move', vehicleId: 'v2', delta: -1 });
    for (const move of LONG_SOLUTION) second.leo.send({ type: 'move', vehicleId: move.vehicleId, delta: move.delta });
    expect(second.leo.last('end')).toBeUndefined();
    clock.now += 1000;
    second.emma.send({ type: 'move', vehicleId: 'v2', delta: 1 });
    expect(second.emma.last('end')!.result).toMatchObject({ winnerId: 1, reason: 'won' });
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
    expect(emma.last('presence')).toEqual({ type: 'presence', playerId: 1, connected: true });
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
      players: [{ id: 1, pseudo: 'Léo' }], createdAt: 1_000_000, startsAt: null, mine: false,
    }]);
    // Emma sees her private duel too
    expect(duels.list(2).map(d => [d.players[0].pseudo, d.mine])).toEqual([['Emma', true], ['Léo', false]]);

    sam.send({ type: 'join', code: forSam[0].code! });
    await settle();
    const playing = duels.list(2).find(d => d.status === 'playing')!;
    expect(playing).toMatchObject({ code: null, players: [{ pseudo: 'Léo' }, { pseudo: 'Sam' }], mine: false });
    expect(duels.list(1).find(d => d.status === 'playing')!.code).not.toBeNull();
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

  it('/info tells the app the server has duels', async () => {
    server = testServer();
    expect((await server.request('GET', '/info')).body.features).toEqual(['duel']);
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
