import { afterEach, describe, expect, it } from 'vitest';
import { INVITE, LONG_SOLUTION, SOLUTION, paris, testServer } from './helpers';

let server: ReturnType<typeof testServer>;
const open = (options?: Parameters<typeof testServer>[0]) => (server = testServer(options));
afterEach(async () => { await server?.app.close(); });

type Row = { pseudo: string; rank: number | null; points: number; verdict: string | null; reasons: { code: string }[]; attemptId: number };
const dayRows = async (token: string) => (await server.request('GET', '/leaderboard?period=day', token)).body.rows as Row[];

describe('becoming admin', () => {
  it('needs ADMIN_TOKEN', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    expect((await request('POST', '/admin/claim', token, { adminToken: 'wrong-token-xx' })).body).toEqual({ error: 'invalid_admin_token' });
    expect((await request('GET', '/me', token)).body.isAdmin).toBe(false);
    expect((await request('POST', '/admin/claim', token, { adminToken: 'admin-token-for-tests' })).body.isAdmin).toBe(true);
    expect((await request('GET', '/me', token)).body.isAdmin).toBe(true);
  });

  it('every admin route is refused to the other players', async () => {
    const { join, request } = open();
    const { token } = await join('Léo');
    for (const [method, url] of [['GET', '/admin/games'], ['GET', '/admin/players'], ['GET', '/admin/reports'], ['GET', '/admin/settings'], ['POST', '/admin/invite']] as const) {
      expect((await request(method, url, token)).body).toEqual({ error: 'forbidden' });
    }
  });
});

describe('suspicion and verdicts', () => {
  it('a suspect win is shown to everyone with its reason, and keeps its points', async () => {
    const { join, play } = open();
    const leo = await join('Léo');
    // 2 moves in 1 s
    expect((await play(leo.token, SOLUTION.map((m, i) => ({ ...m, t: 400 + i * 300 })), 1000)).body.verdict).toBe('suspect');
    const [row] = await dayRows(leo.token);
    expect(row).toMatchObject({ pseudo: 'Léo', rank: 1, points: 10, verdict: 'suspect' });
    expect(row.reasons.map(r => r.code)).toEqual(['too_fast']);
  });

  it('a confirmed cheater keeps their rank, scores 0, and nobody moves up', async () => {
    const { join, joinAdmin, play, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    const mia = await join('Mia');
    await play(leo.token, SOLUTION, 10_000);
    await play(mia.token, LONG_SOLUTION, 20_000);
    const [leoRow] = await dayRows(admin.token);

    expect((await request('POST', `/admin/games/${leoRow.attemptId}/verdict`, admin.token, { verdict: 'cheater' })).body).toEqual({ verdict: 'cheater' });
    const rows = await dayRows(mia.token);
    expect(rows.map(r => [r.pseudo, r.rank, r.points, r.verdict])).toEqual([['Léo', 1, 0, 'cheater'], ['Mia', 2, 8, null]]);
    const month = (await request('GET', '/leaderboard?period=month', mia.token)).body.rows;
    expect(month.map((r: Row) => [r.pseudo, r.points])).toEqual([['Mia', 8], ['Léo', 0]]);

    // Cancelled: the points come back
    await request('POST', `/admin/games/${leoRow.attemptId}/verdict`, admin.token, { verdict: null });
    expect((await dayRows(mia.token))[0]).toMatchObject({ pseudo: 'Léo', points: 10, verdict: null });
  });

  it('the admin can lift a suspicion', async () => {
    const { join, joinAdmin, play, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    await play(leo.token, SOLUTION.map((m, i) => ({ ...m, t: 100 + i * 100 })), 500);
    const [row] = await dayRows(admin.token);
    const games = (await request('GET', '/admin/games', admin.token)).body.games;
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ pseudo: 'Léo', verdict: 'suspect', adminVerdict: null, hasReplay: true });
    await request('POST', `/admin/games/${row.attemptId}/verdict`, admin.token, { verdict: 'cleared' });
    expect((await dayRows(leo.token))[0]).toMatchObject({ verdict: null, reasons: [] });
  });

  it('time out of the app is shown to the admin only, never a suspicion by itself', async () => {
    const { join, joinAdmin, play, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    await play(leo.token, SOLUTION, 60_000, { clientMs: 60_000, backgroundMs: 45_000 });
    expect((await dayRows(leo.token))[0]).toMatchObject({ verdict: null });
    expect(JSON.stringify(await dayRows(leo.token))).not.toContain('45000');
    const all = (await request('GET', '/admin/games?filter=all', admin.token)).body.games;
    expect(all[0]).toMatchObject({ backgroundMs: 45_000, clientMs: 60_000, flags: [] });
  });

  it('the admin adjusts the thresholds', async () => {
    const { join, joinAdmin, play, request } = open();
    const admin = await joinAdmin();
    const res = await request('PATCH', '/admin/settings', admin.token, { thresholds: { minMsPerMove: 100 } });
    expect(res.body.thresholds.minMsPerMove).toBe(100);
    const leo = await join('Léo');
    expect((await play(leo.token, SOLUTION.map((m, i) => ({ ...m, t: 200 + i * 200 })), 600)).body.verdict).toBeNull();
  });
});

describe('replays', () => {
  it('only once my own game of the day is over, then the moves with their times', async () => {
    const { join, play, request } = open();
    const leo = await join('Léo');
    const mia = await join('Mia');
    await play(leo.token, SOLUTION, 30_000);
    const [row] = await dayRows(mia.token);

    // Mia has not played: no spoiler
    expect((await request('GET', `/replay/${row.attemptId}`, mia.token)).body).toEqual({ error: 'replay_locked' });
    await request('POST', '/challenge/start', mia.token, {});
    expect((await request('GET', `/replay/${row.attemptId}`, mia.token)).body).toEqual({ error: 'replay_locked' });
    await request('POST', '/challenge/abandon', mia.token, { date: '2026-10-16' });

    const replay = (await request('GET', `/replay/${row.attemptId}`, mia.token)).body;
    expect(replay).toMatchObject({ pseudo: 'Léo', date: '2026-10-16', number: 1, moves: SOLUTION, timeMs: 30_000, verdict: null });
    expect(replay.level.minMoves).toBe(2);
  });

  it('everyone can watch once the challenge is closed, the admin always', async () => {
    const { join, joinAdmin, play, request, clock } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    const mia = await join('Mia');
    await play(leo.token, SOLUTION);
    const [row] = await dayRows(leo.token);
    expect((await request('GET', `/replay/${row.attemptId}`, admin.token)).status).toBe(200);
    clock.now = paris('2026-10-17', '12:00');
    expect((await request('GET', `/replay/${row.attemptId}`, mia.token)).status).toBe(200);
  });

  it('gone after REPLAY_RETENTION_DAYS, and nothing to watch for a game given up', async () => {
    const { join, joinAdmin, play, request, clock, challenges } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    await play(leo.token);
    const [row] = await dayRows(leo.token);
    clock.now += 8 * 86_400_000;
    challenges.purgeReplays();
    expect((await request('GET', `/replay/${row.attemptId}`, admin.token)).body).toEqual({ error: 'replay_expired' });

    const mia = await join('Mia');
    await request('POST', '/challenge/start', mia.token, {});
    const miaGame = await request('POST', '/challenge/abandon', mia.token, { date: challenges.currentDate() });
    expect(miaGame.status).toBe(200);
    const miaRow = (await dayRows(admin.token)).find(r => r.pseudo === 'Mia')!;
    expect((await request('GET', `/replay/${miaRow.attemptId}`, admin.token)).body).toEqual({ error: 'replay_unavailable' });
    expect((await request('GET', '/replay/999', admin.token)).body).toEqual({ error: 'replay_unavailable' });
  });

  it('the retention set by the admin is used', async () => {
    const { join, joinAdmin, play, request, clock, challenges } = open();
    const admin = await joinAdmin();
    await request('PATCH', '/admin/settings', admin.token, { replayRetentionDays: 1 });
    const leo = await join('Léo');
    await play(leo.token);
    clock.now += 2 * 86_400_000;
    expect(challenges.purgeReplays()).toBe(1);
  });
});

describe('moderation', () => {
  it('a player reports a nickname; the admin sees it and deletes it', async () => {
    const { join, joinAdmin, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    const troll = await join('Troll');
    expect((await request('POST', '/reports', leo.token, { playerId: troll.player.id, reason: 'pseudo insultant' })).status).toBe(204);
    // Reporting again updates the report
    await request('POST', '/reports', leo.token, { playerId: troll.player.id, reason: 'toujours insultant' });
    expect((await request('POST', '/reports', leo.token, { playerId: leo.player.id })).status).toBe(400);
    expect((await request('POST', '/reports', leo.token, { playerId: 999 })).status).toBe(404);

    const { reports } = (await request('GET', '/admin/reports', admin.token)).body;
    expect(reports).toEqual([expect.objectContaining({ reason: 'toujours insultant', player: { id: troll.player.id, pseudo: 'Troll' }, reporter: { id: leo.player.id, pseudo: 'Léo' } })]);
    const players = (await request('GET', '/admin/players', admin.token)).body.players;
    expect(players.find((p: { pseudo: string }) => p.pseudo === 'Troll')).toMatchObject({ reports: 1, banned: false });

    expect((await request('DELETE', `/admin/reports/${reports[0].id}`, admin.token)).status).toBe(204);
    expect((await request('GET', '/admin/reports', admin.token)).body.reports).toEqual([]);
  });

  it('the admin renames a player', async () => {
    const { join, joinAdmin, request } = open();
    const admin = await joinAdmin();
    const troll = await join('Troll');
    await join('Mia');
    expect((await request('PATCH', `/admin/players/${troll.player.id}`, admin.token, { pseudo: 'Mia' })).status).toBe(409);
    expect((await request('PATCH', `/admin/players/${troll.player.id}`, admin.token, { pseudo: 'Joueur 3' })).body.pseudo).toBe('Joueur 3');
    expect((await request('GET', '/me', troll.token)).body.pseudo).toBe('Joueur 3');
  });

  it('an excluded player can do nothing and leaves the rankings', async () => {
    const { join, joinAdmin, play, request } = open();
    const admin = await joinAdmin();
    const troll = await join('Troll');
    await play(troll.token);
    await request('PATCH', `/admin/players/${troll.player.id}`, admin.token, { banned: true });
    expect((await request('GET', '/challenge/today', troll.token)).body).toEqual({ error: 'banned' });
    expect((await request('POST', '/recover', undefined, { recoveryCode: troll.recoveryCode })).body).toEqual({ error: 'banned' });
    expect(await dayRows(admin.token)).toEqual([]);
    // Back in
    await request('PATCH', `/admin/players/${troll.player.id}`, admin.token, { banned: false });
    expect((await dayRows(admin.token)).map(r => r.pseudo)).toEqual(['Troll']);
  });

  it('an admin cannot be excluded', async () => {
    const { joinAdmin, request } = open();
    const admin = await joinAdmin();
    expect((await request('PATCH', `/admin/players/${admin.player.id}`, admin.token, { banned: true })).body).toEqual({ error: 'cannot_ban_admin' });
  });

  it('a transfer code for a player who lost their recovery code', async () => {
    const { join, joinAdmin, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    const { recoveryCode } = (await request('POST', `/admin/players/${leo.player.id}/transfer`, admin.token)).body;
    expect((await request('POST', '/recover', undefined, { recoveryCode: leo.recoveryCode })).status).toBe(403);
    expect((await request('POST', '/recover', undefined, { recoveryCode })).body.player.pseudo).toBe('Léo');
  });
});

describe('invitations', () => {
  it('a new invite code: the old links stop working', async () => {
    const { joinAdmin, request } = open();
    const admin = await joinAdmin();
    const { inviteCode } = (await request('POST', '/admin/invite', admin.token)).body;
    expect(inviteCode).not.toBe(INVITE);
    expect((await request('POST', '/join', undefined, { inviteCode: INVITE, pseudo: 'Léo' })).body).toEqual({ error: 'invalid_invite' });
    expect((await request('POST', '/join', undefined, { inviteCode, pseudo: 'Léo' })).status).toBe(201);
    expect((await request('GET', '/invite', admin.token)).body).toEqual({ inviteCode });
  });

  it('closed: nobody can join anymore', async () => {
    const { joinAdmin, request } = open();
    const admin = await joinAdmin();
    await request('PATCH', '/admin/settings', admin.token, { joinOpen: false });
    expect((await request('POST', '/join', undefined, { inviteCode: INVITE, pseudo: 'Léo' })).body).toEqual({ error: 'join_closed' });
  });

  it('invitations kept to the admin', async () => {
    const { join, joinAdmin, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    await request('PATCH', '/admin/settings', admin.token, { invitesAdminOnly: true });
    expect((await request('GET', '/invite', leo.token)).body).toEqual({ error: 'invites_admin_only' });
    expect((await request('GET', '/invite', admin.token)).body).toEqual({ inviteCode: INVITE });
  });
});

describe('settings', () => {
  it('starts from the environment', async () => {
    const { joinAdmin, request } = open();
    const admin = await joinAdmin();
    expect((await request('GET', '/admin/settings', admin.token)).body).toMatchObject({
      joinOpen: true, invitesAdminOnly: false, replayRetentionDays: 7,
      difficultyByWeekday: ['NORMAL', 'HARD', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL'],
    });
  });

  it.each([
    [{ joinOpen: 'yes' }, 'joinOpen'],
    [{ difficultyByWeekday: ['HARD'] }, 'difficultyByWeekday'],
    [{ difficultyByWeekday: Array(7).fill('IMPOSSIBLE') }, 'difficultyByWeekday'],
    [{ replayRetentionDays: -1 }, 'replayRetentionDays'],
    [{ thresholds: { minMsPerMove: -5 } }, 'thresholds.minMsPerMove'],
    [{ thresholds: { unknown: 1 } }, 'thresholds.unknown'],
  ])('refuses %o', async (patch, field) => {
    const { joinAdmin, request } = open();
    const admin = await joinAdmin();
    expect((await request('PATCH', '/admin/settings', admin.token, patch)).body).toEqual({ error: 'invalid_settings', field });
  });

  it('a new difficulty regenerates the puzzles not released yet', async () => {
    const { joinAdmin, request, challenges, calls } = open({ env: { PREGENERATE_AHEAD: '24h' } });
    const admin = await joinAdmin();
    await challenges.pregenerate();
    expect(calls.map(c => c.difficulty)).toEqual(['NORMAL', 'NORMAL']);
    await request('PATCH', '/admin/settings', admin.token, { difficultyByWeekday: Array(7).fill('EXPERT') });
    await challenges.tick();
    expect(challenges.get('2026-10-16')!.difficulty).toBe('NORMAL');
    expect(challenges.get('2026-10-17')!.difficulty).toBe('EXPERT');
  });
});
