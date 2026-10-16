import { afterEach, describe, expect, it } from 'vitest';
import { LEVEL, LONG_SOLUTION, SOLUTION, paris, testServer } from './helpers';
import { MAX_MOVES } from '../src/app';

let server: ReturnType<typeof testServer>;
const open = (options?: Parameters<typeof testServer>[0]) => (server = testServer(options));
afterEach(async () => { await server?.app.close(); });

describe('joining a server', () => {
  it('/info is public and tells the API version', async () => {
    const { request } = open();
    expect(await request('GET', '/info')).toEqual({
      status: 200, body: { name: 'Rush Hours', apiVersion: 1, minAppVersion: '1.1.6' },
    });
  });

  it('needs the invite code', async () => {
    const { request } = open();
    const res = await request('POST', '/join', undefined, { inviteCode: 'wrong-code', pseudo: 'Léo' });
    expect(res).toEqual({ status: 403, body: { error: 'invalid_invite' } });
  });

  it('gives a token and a recovery code', async () => {
    const { join, request } = open();
    const { token, recoveryCode, player } = await join('  Émilien  ');
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(recoveryCode).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    expect(player.pseudo).toBe('Émilien');
    expect((await request('GET', '/me', token)).body).toMatchObject({ pseudo: 'Émilien' });
  });

  it.each(['a', 'x'.repeat(21), 'bad<script>', ' ', '-dash', 'zero​width'])('refuses the nickname %j', async (pseudo) => {
    const { request } = open();
    expect((await request('POST', '/join', undefined, { inviteCode: 'invite-code-for-tests', pseudo })).body).toEqual({ error: 'invalid_pseudo' });
  });

  it('nicknames are unique, whatever the case and the accents', async () => {
    const { join, request } = open();
    await join('Léo');
    for (const pseudo of ['LÉO', 'leo', 'Leo']) {
      expect((await request('POST', '/join', undefined, { inviteCode: 'invite-code-for-tests', pseudo })).body).toEqual({ error: 'pseudo_taken' });
    }
  });

  it('a member can get the invite code to invite a friend', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    expect((await request('GET', '/invite', token)).body).toEqual({ inviteCode: 'invite-code-for-tests' });
    expect((await request('GET', '/invite')).status).toBe(401);
  });

  it('everything else needs a valid token', async () => {
    const { request } = open();
    for (const url of ['/me', '/challenge/today', '/leaderboard']) {
      expect(await request('GET', url)).toEqual({ status: 401, body: { error: 'unauthorized' } });
      expect((await request('GET', url, 'not-a-token')).status).toBe(401);
    }
  });

  it('stores no token nor recovery code in clear', async () => {
    const { join, db } = open();
    const { token, recoveryCode } = await join('Léo');
    const dump = JSON.stringify(db.prepare('SELECT * FROM players').all());
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(recoveryCode);
  });

  it('limits the attempts to join', async () => {
    const { request } = open();
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await request('POST', '/join', undefined, { inviteCode: `guess-${i}`, pseudo: 'Léo' })).status);
    expect(statuses.slice(0, 10).every(s => s === 403)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe('my account', () => {
  it('changes the nickname', async () => {
    const { join, request } = open();
    const leo = await join('Léo');
    await join('Mia');
    expect((await request('PATCH', '/me', leo.token, { pseudo: 'Mia' })).status).toBe(409);
    expect((await request('PATCH', '/me', leo.token, { pseudo: 'Léon' })).body).toMatchObject({ pseudo: 'Léon' });
  });

  it('the recovery code moves the account to a new phone and signs out the old one', async () => {
    const { join, request } = open();
    const { token, recoveryCode, player } = await join('Léo');
    // Typed by hand: lower case, no dashes
    const res = await request('POST', '/recover', undefined, { recoveryCode: recoveryCode.toLowerCase().replace(/-/g, '') });
    expect(res.body.player).toMatchObject({ id: player.id, pseudo: 'Léo' });
    expect((await request('GET', '/me', token)).status).toBe(401);
    expect((await request('GET', '/me', res.body.token)).status).toBe(200);
  });

  it('a wrong recovery code is refused', async () => {
    const { request } = open();
    expect((await request('POST', '/recover', undefined, { recoveryCode: 'AAAA-BBBB-CCCC-DDDD' })).body).toEqual({ error: 'invalid_recovery_code' });
  });

  it('a new recovery code cancels the previous one', async () => {
    const { join, request } = open();
    const { token, recoveryCode } = await join('Léo');
    const renewed = await request('POST', '/me/recovery', token);
    expect(renewed.body.recoveryCode).not.toBe(recoveryCode);
    expect((await request('POST', '/recover', undefined, { recoveryCode })).status).toBe(403);
    expect((await request('POST', '/recover', undefined, { recoveryCode: renewed.body.recoveryCode })).status).toBe(200);
  });

  it('deleting the account deletes its games', async () => {
    const { join, request, play, db } = open();
    const { token } = await join('Léo');
    await play(token);
    expect((await request('DELETE', '/me', token)).status).toBe(204);
    expect((await request('GET', '/me', token)).status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) AS n FROM attempts').get()).toEqual({ n: 0 });
  });
});

describe('the daily challenge', () => {
  it('is announced without its puzzle', async () => {
    const { join, request, challenges } = open();
    await challenges.ensure(challenges.currentDate());
    const { token } = await join('Léo');
    const today = await request('GET', '/challenge/today', token);
    expect(today.body).toMatchObject({
      date: '2026-10-16', number: 1, status: 'ready', me: null, pending: null, results: [],
      releasedAt: paris('2026-10-16', '12:00'), closesAt: paris('2026-10-17', '12:00'),
    });
    expect(JSON.stringify(today.body)).not.toContain('vehicles');
  });

  it('says when its puzzle is still being prepared', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    expect((await request('GET', '/challenge/today', token)).body.status).toBe('preparing');
  });

  it('start gives the puzzle, without its optimum', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    const start = await request('POST', '/challenge/start', token, {});
    expect(start.status).toBe(200);
    expect(start.body.level.vehicles).toEqual(LEVEL.vehicles);
    expect(start.body.level.minMoves).toBe(0);
    expect(start.body).toMatchObject({ date: '2026-10-16', number: 1, deadline: paris('2026-10-17', '13:00') });
  });

  it('a single try: starting again resumes the same game, the clock keeps running', async () => {
    const { join, request, clock } = open();
    const { token } = await join('Léo');
    const first = await request('POST', '/challenge/start', token, {});
    clock.now += 60_000;
    const again = await request('POST', '/challenge/start', token, {});
    expect(again.body.startedAt).toBe(first.body.startedAt);
  });

  it('a win is checked by replaying its moves, the time is the time of the server', async () => {
    const { join, request, play } = open();
    const { token } = await join('Léo');
    const res = await play(token, SOLUTION, 42_000);
    expect(res.body).toEqual({ status: 'won', moves: 2, timeMs: 42_000, minMoves: 2, rank: 1, points: 10 });
    expect((await request('POST', '/challenge/start', token, {})).body).toEqual({ error: 'already_finished' });
    expect((await request('GET', '/challenge/today', token)).body.me).toMatchObject({ status: 'won', moves: 2, timeMs: 42_000, minMoves: 2 });
  });

  it('refuses a false win', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    await request('POST', '/challenge/start', token, {});
    const submit = (moves: object[]) => request('POST', '/challenge/submit', token, { date: '2026-10-16', moves });
    expect((await submit([{ vehicleId: 'target', delta: 4, t: 1000 }])).body).toEqual({ error: 'invalid_moves', reason: 'blocked', index: 0 });
    expect((await submit(SOLUTION.slice(0, 1))).body).toEqual({ error: 'not_won' });
    expect((await submit([{ vehicleId: 'v1', delta: 'two', t: 1 }])).body).toEqual({ error: 'invalid_request' });
    expect((await submit(Array(MAX_MOVES + 1).fill(SOLUTION[0]))).body).toEqual({ error: 'invalid_request' });
    // Still playing: a real win goes through
    expect((await submit(SOLUTION)).body.status).toBe('won');
  });

  it('cannot submit without starting', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    expect((await request('POST', '/challenge/submit', token, { date: '2026-10-16', moves: SOLUTION })).body).toEqual({ error: 'no_game' });
  });

  it('abandoning ends the game and shows the optimum', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    await request('POST', '/challenge/start', token, {});
    expect((await request('POST', '/challenge/abandon', token, { date: '2026-10-16' })).body).toEqual({ status: 'abandoned', minMoves: 2 });
    expect((await request('POST', '/challenge/submit', token, { date: '2026-10-16', moves: SOLUTION })).body).toEqual({ error: 'already_finished' });
  });
});

describe('grace period', () => {
  it('a game started before the next release can be finished within the grace period', async () => {
    const { join, request, clock } = open({ at: paris('2026-10-17', '11:50') });
    const { token } = await join('Léo');
    expect((await request('POST', '/challenge/start', token, {})).body.date).toBe('2026-10-16');
    clock.now = paris('2026-10-17', '12:30');
    const today = await request('GET', '/challenge/today', token);
    expect(today.body.date).toBe('2026-10-17');
    expect(today.body.pending).toEqual({ date: '2026-10-16', deadline: paris('2026-10-17', '13:00') });
    // Resumed by its date
    expect((await request('POST', '/challenge/start', token, { date: '2026-10-16' })).status).toBe(200);
    const res = await request('POST', '/challenge/submit', token, { date: '2026-10-16', moves: SOLUTION });
    expect(res.body).toMatchObject({ status: 'won', timeMs: 40 * 60_000 });
  });

  it('after the grace period the game is unfinished', async () => {
    const { join, request, clock } = open({ at: paris('2026-10-17', '11:50') });
    const { token } = await join('Léo');
    await request('POST', '/challenge/start', token, {});
    clock.now = paris('2026-10-17', '13:01');
    expect((await request('POST', '/challenge/submit', token, { date: '2026-10-16', moves: SOLUTION })).body).toEqual({ error: 'too_late' });
    const day = await request('GET', '/leaderboard?period=day&date=2026-10-16', token);
    expect(day.body.rows[0]).toMatchObject({ status: 'unfinished', points: 0 });
    expect((await request('GET', '/challenge/today', token)).body.pending).toBeNull();
  });

  it('a closed challenge cannot be started', async () => {
    const { join, request } = open({ at: paris('2026-10-17', '12:30') });
    const { token } = await join('Léo');
    expect((await request('POST', '/challenge/start', token, { date: '2026-10-16' })).body).toEqual({ error: 'challenge_closed' });
    expect((await request('POST', '/challenge/start', token, { date: '2026-10-18' })).body).toEqual({ error: 'challenge_closed' });
  });
});

describe('leaderboards', () => {
  it('the results of the day: moves, then time, then the others', async () => {
    const { join, request, play } = open();
    const [leo, mia, zoe, max] = await Promise.all(['Léo', 'Mia', 'Zoé', 'Max'].map(join));
    await play(leo.token, LONG_SOLUTION, 20_000);
    await play(mia.token, SOLUTION, 50_000);
    await play(zoe.token, SOLUTION, 30_000);
    await request('POST', '/challenge/start', max.token, {});

    const today = await request('GET', '/challenge/today', leo.token);
    expect(today.body.results.map((r: { pseudo: string; rank: number | null; moves: number | null; timeMs: number | null; status: string }) =>
      [r.pseudo, r.rank, r.moves, r.timeMs, r.status])).toEqual([
      ['Zoé', 1, 2, 30_000, 'won'], ['Mia', 2, 2, 50_000, 'won'], ['Léo', 3, 4, 20_000, 'won'], ['Max', null, null, null, 'playing'],
    ]);
  });

  it('week and month add up the points of each day', async () => {
    const { join, request, play, clock } = open({ at: paris('2026-10-16', '13:00') });
    const leo = await join('Léo');
    const mia = await join('Mia');
    await play(leo.token, SOLUTION, 10_000);  // Léo 10, Mia 8
    await play(mia.token, SOLUTION, 20_000);
    clock.now = paris('2026-10-17', '13:00');
    await play(mia.token, SOLUTION, 10_000);  // Mia 10, Léo 0
    clock.now = paris('2026-10-19', '13:00'); // next week
    await play(leo.token, SOLUTION, 10_000);

    const week = await request('GET', '/leaderboard?period=week&date=2026-10-16', leo.token);
    expect(week.body).toMatchObject({ period: 'week', from: '2026-10-12', to: '2026-10-18' });
    expect(week.body.rows.map((r: { pseudo: string; points: number; rank: number }) => [r.pseudo, r.rank, r.points])).toEqual([['Mia', 1, 18], ['Léo', 2, 10]]);

    const month = await request('GET', '/leaderboard?period=month', leo.token);
    expect(month.body).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(month.body.rows.map((r: { pseudo: string; points: number }) => [r.pseudo, r.points])).toEqual([['Léo', 20], ['Mia', 18]]);
  });

  it('refuses a bad period or date', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    expect((await request('GET', '/leaderboard?period=year', token)).status).toBe(400);
    expect((await request('GET', '/leaderboard?date=2026-13-01', token)).status).toBe(400);
  });
});

describe('errors', () => {
  it('unknown routes and malformed bodies get a clean error', async () => {
    const { request, app } = open();
    expect(await request('GET', '/nope')).toEqual({ status: 404, body: { error: 'not_found' } });
    const res = await app.inject({ method: 'POST', url: '/api/v1/join', payload: '{oops', headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_request' });
  });
});

describe('robustness', () => {
  it('a failed generation does not bring the server down', async () => {
    const crashing = { generate: async () => { throw new Error('worker crashed'); }, close: async () => {} };
    const { join, request } = open({ generator: crashing });
    const { token } = await join('Léo');
    expect((await request('GET', '/challenge/today', token)).body.status).toBe('preparing');
    await new Promise(r => setTimeout(r, 10));
    expect((await request('POST', '/challenge/start', token, {})).body).toEqual({ error: 'internal' });
    expect((await request('GET', '/info')).status).toBe(200);
  });
});
