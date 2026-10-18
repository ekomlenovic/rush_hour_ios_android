import { afterEach, describe, expect, it } from 'vitest';
import { INVITE, LONG_SOLUTION, SOLUTION, paris, testConfig, testServer } from './helpers';
import { loadSettings, scheduleOf } from '../src/settings';
import { releaseAt } from '../src/time';
import { getSetting } from '../src/db';

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

  it('the admin deletes the account of a player, with their games and reports', async () => {
    const { join, joinAdmin, play, request, db } = open();
    const admin = await joinAdmin();
    const troll = await join('Troll');
    await play(troll.token);
    await request('POST', '/reports', troll.token, { playerId: admin.player.id, reason: 'pseudo' });
    expect((await request('DELETE', `/admin/players/${troll.player.id}`, admin.token)).status).toBe(204);
    expect((await request('GET', '/me', troll.token)).status).toBe(401);
    expect((await request('POST', '/recover', undefined, { recoveryCode: troll.recoveryCode })).status).toBe(403);
    expect(db.prepare('SELECT COUNT(*) AS n FROM attempts').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM reports').get()).toEqual({ n: 0 });
    expect((await request('DELETE', `/admin/players/${troll.player.id}`, admin.token)).body).toEqual({ error: 'not_found' });
  });

  it('an admin cannot be deleted by an admin, and a player cannot delete anyone', async () => {
    const { join, joinAdmin, request } = open();
    const admin = await joinAdmin();
    const leo = await join('Léo');
    expect((await request('DELETE', `/admin/players/${admin.player.id}`, admin.token)).body).toEqual({ error: 'cannot_delete_admin' });
    expect((await request('DELETE', `/admin/players/${admin.player.id}`, leo.token)).status).toBe(403);
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
      serverName: 'Rush Hours', releaseTime: '12:00', timeZone: 'Europe/Paris',
      gracePeriodMs: 3_600_000, pregenerateAheadMs: 48 * 3_600_000, nextReleaseAt: paris('2026-10-17', '12:00'),
    });
    expect((await request('GET', '/admin/settings', admin.token)).body).not.toHaveProperty('releaseChanges');
  });

  it.each([
    [{ joinOpen: 'yes' }, 'joinOpen'],
    [{ difficultyByWeekday: ['HARD'] }, 'difficultyByWeekday'],
    [{ difficultyByWeekday: Array(7).fill('IMPOSSIBLE') }, 'difficultyByWeekday'],
    [{ replayRetentionDays: -1 }, 'replayRetentionDays'],
    [{ thresholds: { minMsPerMove: -5 } }, 'thresholds.minMsPerMove'],
    [{ thresholds: { unknown: 1 } }, 'thresholds.unknown'],
    [{ serverName: '   ' }, 'serverName'],
    [{ serverName: 'x'.repeat(41) }, 'serverName'],
    [{ serverName: 'Rush\nHours' }, 'serverName'],
    [{ serverName: 'Rush \u202eHours' }, 'serverName'],
    [{ releaseTime: '24:00' }, 'releaseTime'],
    [{ releaseTime: '9:00' }, 'releaseTime'],
    [{ gracePeriodMs: -1 }, 'gracePeriodMs'],
    [{ gracePeriodMs: 25 * 3_600_000 }, 'gracePeriodMs'],
    [{ pregenerateAheadMs: 0 }, 'pregenerateAheadMs'],
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

describe('release time', () => {
  const setTime = async (server: ReturnType<typeof testServer>, token: string, releaseTime: string) =>
    server.request('PATCH', '/admin/settings', token, { releaseTime });
  const today = async (server: ReturnType<typeof testServer>, token: string) =>
    (await server.request('GET', '/challenge/today', token)).body as { date: string; releasedAt: number; closesAt: number };

  it('applies from the next challenge on: the one being played stays out', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    // 15:00, the challenge of the 16th came out at 12:00
    const res = await setTime(s, admin.token, '18:00');
    expect(res.body).toMatchObject({ releaseTime: '18:00', nextReleaseAt: paris('2026-10-17', '18:00') });
    expect(await today(s, admin.token)).toMatchObject({
      date: '2026-10-16', releasedAt: paris('2026-10-16', '12:00'), closesAt: paris('2026-10-17', '18:00'),
    });
    s.clock.now = paris('2026-10-17', '13:00');
    expect((await today(s, admin.token)).date).toBe('2026-10-16');
    s.clock.now = paris('2026-10-17', '18:00');
    expect(await today(s, admin.token)).toMatchObject({ date: '2026-10-17', closesAt: paris('2026-10-18', '18:00') });
  });

  it('an earlier time shortens the challenge being played', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await setTime(s, admin.token, '08:00');
    expect((await today(s, admin.token)).closesAt).toBe(paris('2026-10-17', '08:00'));
    s.clock.now = paris('2026-10-17', '08:00');
    expect((await today(s, admin.token)).date).toBe('2026-10-17');
  });

  it('before the release of the day, moves that release', async () => {
    const s = open({ at: paris('2026-10-16', '10:00') });
    const admin = await s.joinAdmin();
    expect((await today(s, admin.token)).date).toBe('2026-10-15');
    await setTime(s, admin.token, '14:00');
    s.clock.now = paris('2026-10-16', '13:00');
    expect((await today(s, admin.token)).date).toBe('2026-10-15');
    s.clock.now = paris('2026-10-16', '14:00');
    expect((await today(s, admin.token)).date).toBe('2026-10-16');
  });

  it.each([
    ['2026-10-16', '23:30', '00:15'],
    ['2026-10-16', '10:00', '10:30'],
    ['2026-10-16', '10:00', '09:00'],
  ])('refuses a next challenge less than 1 h away (%s %s → %s)', async (date, time, releaseTime) => {
    const s = open({ at: paris(date, time) });
    const admin = await s.joinAdmin();
    expect((await setTime(s, admin.token, releaseTime)).body).toEqual({ error: 'release_too_soon', field: 'releaseTime' });
    expect((await s.request('GET', '/admin/settings', admin.token)).body.releaseTime).toBe('12:00');
  });

  it('accepts a next challenge just over 1 h away', async () => {
    const s = open({ at: paris('2026-10-16', '23:30') });
    const admin = await s.joinAdmin();
    expect((await setTime(s, admin.token, '00:45')).status).toBe(200);
  });

  it('the challenges already out never move', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await setTime(s, admin.token, '18:00');
    // Changed again the same day: replaces the first change
    await setTime(s, admin.token, '19:00');
    s.clock.now = paris('2026-10-18', '20:00');
    await setTime(s, admin.token, '09:00');
    expect(['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'].map(d => s.challenges.releaseAt(d))).toEqual([
      paris('2026-10-16', '12:00'), paris('2026-10-17', '19:00'), paris('2026-10-18', '19:00'),
      paris('2026-10-19', '09:00'), paris('2026-10-20', '09:00'),
    ]);
    // Back to the time of today: nothing to change
    s.clock.now = paris('2026-10-19', '10:00');
    expect((await setTime(s, admin.token, '09:00')).body.nextReleaseAt).toBe(paris('2026-10-20', '09:00'));
  });

  it('keeps the past when RELEASE_TIME changes after a change in the app', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await setTime(s, admin.token, '18:00');
    // Restarted with another RELEASE_TIME, on the same database
    const config = testConfig({ RELEASE_TIME: '07:00' });
    const schedule = scheduleOf(config, loadSettings(s.db, config));
    expect(releaseAt('2026-10-10', schedule)).toBe(paris('2026-10-10', '12:00'));
    expect(releaseAt('2026-10-16', schedule)).toBe(paris('2026-10-16', '12:00'));
    expect(releaseAt('2026-10-17', schedule)).toBe(paris('2026-10-17', '18:00'));
  });
});

describe('server, grace period and pregeneration', () => {
  it('only saves the settings it knows', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await s.request('PATCH', '/admin/settings', admin.token, { constructor: 1, toString: 'x', unknown: true, joinOpen: false });
    expect(JSON.parse(getSetting(s.db, 'admin_settings')!)).toEqual({ joinOpen: false });
  });

  it('what the admin did not change keeps following the environment', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await s.request('PATCH', '/admin/settings', admin.token, { joinOpen: false, gracePeriodMs: 0 });
    const config = testConfig({ SERVER_NAME: 'Renamed', GRACE_PERIOD: '2h', PREGENERATE_AHEAD: '12h' });
    expect(loadSettings(s.db, config)).toMatchObject({
      joinOpen: false, gracePeriodMs: 0, serverName: 'Renamed', pregenerateAheadMs: 12 * 3_600_000, releaseTime: '12:00',
    });
  });

  it('a new name is shown at once', async () => {
    const { joinAdmin, request } = open();
    const admin = await joinAdmin();
    expect((await request('PATCH', '/admin/settings', admin.token, { serverName: '  Les copains  ' })).body.serverName).toBe('Les copains');
    expect((await request('GET', '/info')).body.name).toBe('Les copains');
    const page = await server.app.inject({ method: 'GET', url: '/delete-account' });
    expect(page.body).toContain('Les copains');
  });

  it('a new grace period moves the deadlines', async () => {
    const { joinAdmin, request, challenges } = open();
    const admin = await joinAdmin();
    await request('PATCH', '/admin/settings', admin.token, { gracePeriodMs: 0 });
    expect(challenges.deadline('2026-10-16')).toBe(paris('2026-10-17', '12:00'));
    await request('PATCH', '/admin/settings', admin.token, { gracePeriodMs: 2 * 3_600_000 });
    expect(challenges.deadline('2026-10-16')).toBe(paris('2026-10-17', '14:00'));
  });

  it('a longer pregeneration generates more puzzles ahead', async () => {
    const { joinAdmin, request, challenges } = open({ env: { PREGENERATE_AHEAD: '24h' } });
    const admin = await joinAdmin();
    await challenges.pregenerate();
    expect(challenges.get('2026-10-18')).toBeUndefined();
    await request('PATCH', '/admin/settings', admin.token, { pregenerateAheadMs: 72 * 3_600_000 });
    await challenges.pregenerate();
    expect(challenges.get('2026-10-18')).toBeDefined();
    expect(challenges.get('2026-10-19')).toBeDefined();
    expect(challenges.get('2026-10-20')).toBeUndefined();
  });
});

describe('reset', () => {
  it('everything goes back to the environment, but the invite code', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    const code = (await s.request('POST', '/admin/invite', admin.token)).body.inviteCode;
    await s.request('PATCH', '/admin/settings', admin.token, {
      joinOpen: false, serverName: 'Copains', gracePeriodMs: 0, pregenerateAheadMs: 3_600_000,
      difficultyByWeekday: Array(7).fill('EXPERT'), replayRetentionDays: 30, thresholds: { minMsPerMove: 100 },
    });
    const res = await s.request('POST', '/admin/settings/reset', admin.token);
    expect(res.body).toMatchObject({
      joinOpen: true, invitesAdminOnly: false, serverName: 'Rush Hours', gracePeriodMs: 3_600_000,
      pregenerateAheadMs: 48 * 3_600_000, replayRetentionDays: 7, releaseTime: '12:00',
      difficultyByWeekday: ['NORMAL', 'HARD', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL'],
      thresholds: { minMsPerMove: 600 },
    });
    expect((await s.request('GET', '/invite', admin.token)).body.inviteCode).toBe(code);
  });

  it('the release time goes back from the next challenge on, and follows RELEASE_TIME again', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await s.request('PATCH', '/admin/settings', admin.token, { releaseTime: '18:00' });
    s.clock.now = paris('2026-10-18', '20:00');
    const res = await s.request('POST', '/admin/settings/reset', admin.token);
    expect(res.body).toMatchObject({ releaseTime: '12:00', nextReleaseAt: paris('2026-10-19', '12:00') });
    expect(s.challenges.releaseAt('2026-10-17')).toBe(paris('2026-10-17', '18:00'));
    expect(s.challenges.closesAt('2026-10-18')).toBe(paris('2026-10-19', '12:00'));
    // Restarted with another RELEASE_TIME: the coming challenges follow it, the past stays
    const config = testConfig({ RELEASE_TIME: '07:00' });
    const schedule = scheduleOf(config, loadSettings(s.db, config));
    expect(releaseAt('2026-10-16', schedule)).toBe(paris('2026-10-16', '12:00'));
    expect(releaseAt('2026-10-17', schedule)).toBe(paris('2026-10-17', '18:00'));
    expect(releaseAt('2026-10-19', schedule)).toBe(paris('2026-10-19', '07:00'));
  });

  it('is refused when the next challenge would come out in less than 1 h', async () => {
    const s = open();
    const admin = await s.joinAdmin();
    await s.request('PATCH', '/admin/settings', admin.token, { releaseTime: '18:00', joinOpen: false });
    s.clock.now = paris('2026-10-18', '11:30');
    expect((await s.request('POST', '/admin/settings/reset', admin.token)).body).toEqual({ error: 'release_too_soon', field: 'releaseTime' });
    expect((await s.request('GET', '/admin/settings', admin.token)).body).toMatchObject({ joinOpen: false, releaseTime: '18:00' });
  });

  it('is for the admin only', async () => {
    const { join, request } = open();
    const leo = await join('Léo');
    expect((await request('POST', '/admin/settings/reset', leo.token)).body).toEqual({ error: 'forbidden' });
  });
});
