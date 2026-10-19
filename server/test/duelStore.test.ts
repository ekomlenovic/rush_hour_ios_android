import { afterEach, describe, expect, it } from 'vitest';
import { COUNTDOWN_MS, type Duels, type ServerMessage } from '../src/duel';
import { rankDuels } from '../src/duelStore';
import { paris, testServer } from './helpers';

let server: ReturnType<typeof testServer>;
afterEach(async () => { await server?.app.close(); });

const settle = () => new Promise(resolve => setImmediate(resolve));
const DAY_MS = 24 * 3600_000;

/** A phone connected to the duels of the server */
function phone(duels: Duels, token: string) {
  const received: ServerMessage[] = [];
  const handlers = duels.connect({ send: (m) => received.push(JSON.parse(JSON.stringify(m))), close: () => {} });
  const send = (m: object) => handlers.onMessage(JSON.stringify(m));
  send({ type: 'auth', token });
  const last = <T extends ServerMessage['type']>(type: T) =>
    [...received].reverse().find(m => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;
  return { send, last, close: handlers.onClose };
}

/** Two players of the server, and a duel between them won by `winner` (or given up by the other) */
async function setup() {
  server = testServer();
  const { join, joinAdmin, duels, clock } = server;
  const [leo, emma, sam] = [await join('Léo'), await join('Emma'), await join('Sam')];
  const admin = await joinAdmin();
  const phones = { leo: phone(duels, leo.token), emma: phone(duels, emma.token), sam: phone(duels, sam.token) };

  const duel = async (a: keyof typeof phones, b: keyof typeof phones, outcome: 'a_wins' | 'b_gives_up' = 'a_wins') => {
    phones[a].send({ type: 'create', difficulty: 'EASY' });
    phones[b].send({ type: 'join', code: phones[a].last('duel')!.duel.code });
    await settle();
    clock.now += COUNTDOWN_MS + 4000;
    if (outcome === 'b_gives_up') phones[b].send({ type: 'leave' });
    else {
      phones[a].send({ type: 'move', vehicleId: 'v1', delta: 2 });
      phones[a].send({ type: 'move', vehicleId: 'target', delta: 4 });
    }
    // Back to the list: the room of the finished duel is left
    phones[a].send({ type: 'leave' });
    phones[b].send({ type: 'leave' });
    return phones[a].last('end')!.result;
  };
  return { ...server, leo, emma, sam, admin, phones, duel };
}

describe('finished duels', () => {
  it('are kept, with the score of the two players against each other', async () => {
    const { duel, leo, emma } = await setup();
    const first = await duel('leo', 'emma');
    expect(first).toMatchObject({ winnerId: leo.player.id, reason: 'won', duelId: expect.any(Number) });
    expect(first.score).toEqual({ wins: [{ playerId: leo.player.id, count: 1 }, { playerId: emma.player.id, count: 0 }], draws: 0 });
    const second = await duel('emma', 'leo', 'b_gives_up');
    expect(second.reason).toBe('forfeit');
    expect(second.score).toEqual({ wins: [{ playerId: emma.player.id, count: 1 }, { playerId: leo.player.id, count: 1 }], draws: 0 });
  });

  it('make the history of a player and their score against each opponent', async () => {
    const { duel, request, leo, emma, sam } = await setup();
    await duel('leo', 'emma');
    await duel('sam', 'leo');
    await duel('leo', 'emma');
    const { body } = await request('GET', '/duels/history', leo.token);
    expect(body.duels).toHaveLength(3);
    expect(body.duels[0]).toMatchObject({
      winnerId: leo.player.id, reason: 'won', opponent: { id: emma.player.id, pseudo: 'Emma' },
      myMoves: 2, theirMoves: 0, timeMs: 4000, hasReplay: true, difficulty: 'EASY',
    });
    expect(body.records).toEqual([
      { opponent: { id: emma.player.id, pseudo: 'Emma' }, wins: 2, losses: 0, draws: 0 },
      { opponent: { id: sam.player.id, pseudo: 'Sam' }, wins: 0, losses: 1, draws: 0 },
    ]);
  });

  it('rank the players by wins, then fewer losses', async () => {
    const { duel, request, leo } = await setup();
    await duel('leo', 'emma');
    await duel('sam', 'emma');
    await duel('leo', 'sam');
    const { body } = await request('GET', '/duels/leaderboard?period=week', leo.token);
    expect(body.rows.map((r: { pseudo: string; rank: number; wins: number; losses: number }) => [r.rank, r.pseudo, r.wins, r.losses])).toEqual([
      [1, 'Léo', 2, 0], [2, 'Sam', 1, 1], [3, 'Emma', 0, 2],
    ]);
    expect((await request('GET', '/duels/leaderboard?period=all', leo.token)).body.rows).toHaveLength(3);
    expect((await request('GET', '/duels/leaderboard?period=year', leo.token)).status).toBe(400);
  });

  it('of the week count the duels of a Monday before the release of the challenge', async () => {
    server = testServer({ at: paris('2026-10-19', '09:00') });
    const { join, duels, clock, request } = server;
    const [leo, emma] = [await join('Léo'), await join('Emma')];
    const [a, b] = [phone(duels, leo.token), phone(duels, emma.token)];
    a.send({ type: 'create', difficulty: 'EASY' });
    b.send({ type: 'join', code: a.last('duel')!.duel.code });
    await settle();
    clock.now += COUNTDOWN_MS + 4000;
    b.send({ type: 'leave' });
    const week = (await request('GET', '/duels/leaderboard?period=week', leo.token)).body;
    expect(week).toMatchObject({ from: '2026-10-19', to: '2026-10-25' });
    expect(week.rows).toHaveLength(2);
  });

  it('ties share a rank', () => {
    const row = (pseudo: string, wins: number, losses: number) => ({ playerId: 0, pseudo, wins, losses, draws: 0, played: wins + losses });
    expect(rankDuels([row('B', 1, 0), row('A', 1, 0), row('C', 0, 1)]).map(r => [r.pseudo, r.rank])).toEqual([['A', 1], ['B', 1], ['C', 3]]);
  });

  it('a replay with the moves of both, for its players and the admin, until REPLAY_RETENTION_DAYS', async () => {
    const { duel, request, leo, emma, sam, admin, challenges, clock } = await setup();
    const { duelId } = await duel('leo', 'emma');
    const replay = await request('GET', `/duels/${duelId}`, emma.token);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ winnerId: leo.player.id, reason: 'won', metric: 'time', level: { minMoves: 2 } });
    expect(replay.body.players).toEqual([
      { id: leo.player.id, pseudo: 'Léo', moves: [{ vehicleId: 'v1', delta: 2, t: 4000 }, { vehicleId: 'target', delta: 4, t: 4000 }] },
      { id: emma.player.id, pseudo: 'Emma', moves: [] },
    ]);
    expect((await request('GET', `/duels/${duelId}`, sam.token)).body).toEqual({ error: 'forbidden' });
    expect((await request('GET', `/duels/${duelId}`, admin.token)).status).toBe(200);
    expect((await request('GET', '/duels/999', leo.token)).body).toEqual({ error: 'replay_unavailable' });

    clock.now += 8 * DAY_MS;
    challenges.purgeReplays();
    expect((await request('GET', `/duels/${duelId}`, leo.token)).body).toEqual({ error: 'replay_expired' });
    // The results stay
    expect((await request('GET', '/duels/history', leo.token)).body.duels[0].hasReplay).toBe(false);
  });

  it('go with the account of a player', async () => {
    const { duel, request, leo, emma } = await setup();
    await duel('leo', 'emma');
    await request('DELETE', '/me', emma.token);
    expect((await request('GET', '/duels/history', leo.token)).body.duels).toEqual([]);
  });
});

describe('admin reset', () => {
  it('counts first, then deletes the duels and the games of the chosen players and days', async () => {
    const { duel, request, play, leo, emma, sam, admin, clock } = await setup();
    await play(leo.token);
    await play(emma.token);
    await duel('leo', 'emma');
    await duel('sam', 'emma');
    clock.now += DAY_MS;
    await duel('leo', 'sam');

    const today = (await request('GET', '/challenge/today', leo.token)).body.date as string;
    const reset = (body: object) => request('POST', '/admin/reset', admin.token, body);

    // Nothing is deleted on a dry run
    expect((await reset({ challenges: true, duels: true, dryRun: true })).body).toEqual({ dryRun: true, challenges: 2, duels: 3 });
    expect((await request('GET', '/duels/history', emma.token)).body.duels).toHaveLength(2);

    // Emma only, everything: her duels go (for her opponents too), her game of the day too
    expect((await reset({ playerIds: [emma.player.id], challenges: true, duels: true })).body).toEqual({ dryRun: false, challenges: 1, duels: 2 });
    expect((await request('GET', '/duels/history', sam.token)).body.duels).toHaveLength(1);
    // She can play the challenge again
    expect((await request('GET', '/challenge/today', emma.token)).body.me).toBeNull();

    // Everyone, the duels of one day
    expect((await reset({ from: today, to: today, duels: true, dryRun: true })).body.duels).toBe(1);
    expect((await reset({ from: '2020-01-01', to: '2020-12-31', challenges: true, duels: true })).body).toEqual({ dryRun: false, challenges: 0, duels: 0 });
    expect((await reset({ duels: true })).body.duels).toBe(1);
    expect((await request('GET', '/duels/leaderboard?period=all', leo.token)).body.rows).toEqual([]);
  });

  it('is for the admin only, with valid days', async () => {
    const { request, leo, admin } = await setup();
    expect((await request('POST', '/admin/reset', leo.token, { duels: true })).status).toBe(403);
    expect((await request('POST', '/admin/reset', admin.token, { from: '2026-10-20', to: '2026-10-01', duels: true })).body).toEqual({ error: 'invalid_request' });
    expect((await request('POST', '/admin/reset', admin.token, { from: 'yesterday', duels: true })).body).toEqual({ error: 'invalid_request' });
  });
});
