import { buildInviteLink, buildRecoveryLink, normalizeServerUrl, parseInviteLink, parseRecoveryLink, serverHost } from '../utils/multi/serverUrl';
import { checkCompatibility, isOlderVersion, multiApi, MultiApiError } from '../utils/multi/api';
import { gameKey, selectActiveAccount, useMultiStore, type MultiGame, type ServerAccount } from '../store/multiStore';
import { useGameStore } from '../store/gameStore';
import { exportProgress, parseSave } from '../utils/saveTransfer';
import { sampleLevels } from '../data/sampleLevels';
import { mondayOf, showsWeekRecap, weekCells } from '../utils/multi/week';

describe('server address', () => {
  it.each([
    ['monserveur.duckdns.org', 'https://monserveur.duckdns.org'],
    ['  https://MonServeur.DuckDNS.org/  ', 'https://monserveur.duckdns.org'],
    ['https://monserveur.duckdns.org/api/v1', 'https://monserveur.duckdns.org'],
    ['https://monserveur.duckdns.org/api/v1/', 'https://monserveur.duckdns.org'],
    ['https://example.com:8443/rush', 'https://example.com:8443/rush'],
    ['https://192.168.1.20:3000', 'https://192.168.1.20:3000'],
    ['https://localhost:3000', 'https://localhost:3000'],
  ])('%j → %s', (input, url) => {
    expect(normalizeServerUrl(input)).toEqual({ ok: true, url });
  });

  it('refuses http: phones block it', () => {
    expect(normalizeServerUrl('http://monserveur.duckdns.org')).toEqual({ ok: false, error: 'not_https' });
  });

  it.each(['', '   ', 'ftp://example.com', 'https://', 'not a server', 'https://user@example.com', 'https://example.com/a b', 'justaword'])(
    'refuses %j',
    (input) => {
      expect(normalizeServerUrl(input)).toEqual({ ok: false, error: 'invalid_url' });
    },
  );

  it('shows the host only', () => {
    expect(serverHost('https://monserveur.duckdns.org')).toBe('monserveur.duckdns.org');
  });
});

describe('invitation link', () => {
  it('carries the server and its invite code', () => {
    const link = buildInviteLink('https://monserveur.duckdns.org', 'AB33BAVJ11YYPVGK');
    expect(link).toBe('rush-hours://multi/join?server=https%3A%2F%2Fmonserveur.duckdns.org&code=AB33BAVJ11YYPVGK');
    expect(parseInviteLink(link)).toEqual({ server: 'https://monserveur.duckdns.org', code: 'AB33BAVJ11YYPVGK' });
  });

  it('opens the join screen: the route app/multi/join.tsx', () => {
    expect(require('fs').existsSync(require('path').join(__dirname, '../app/multi/join.tsx'))).toBe(true);
  });

  it('accepts the variants of the scheme and parameter order', () => {
    expect(parseInviteLink('rush-hours:///multi/join?code=XYZ12345&server=monserveur.duckdns.org'))
      .toEqual({ server: 'https://monserveur.duckdns.org', code: 'XYZ12345' });
  });

  it.each([
    'rush-hours://game?data=abc',
    'rush-hours://multi/join?server=https%3A%2F%2Fexample.com',
    'rush-hours://multi/join?code=ABC',
    'rush-hours://multi/join?server=http%3A%2F%2Fexample.com&code=ABC',
    'https://example.com/multi/join?server=x&code=y',
    'rush-hours://multi/join?server=%E0%A4%A&code=ABC',
  ])('is not %s', (link) => {
    expect(parseInviteLink(link)).toBeNull();
  });
});

describe('recovery link', () => {
  it('carries the server and the recovery code', () => {
    const link = buildRecoveryLink('https://monserveur.duckdns.org', 'K7QM-3XPA-9TRB-V2HD');
    expect(parseRecoveryLink(link)).toEqual({ server: 'https://monserveur.duckdns.org', code: 'K7QM-3XPA-9TRB-V2HD' });
    expect(parseInviteLink(link)).toBeNull();
    expect(parseRecoveryLink(buildInviteLink('https://monserveur.duckdns.org', 'X'))).toBeNull();
  });
});

describe('versions', () => {
  it('compares versions', () => {
    expect(isOlderVersion('1.1.6', '1.2.0')).toBe(true);
    expect(isOlderVersion('1.2.0', '1.2')).toBe(false);
    expect(isOlderVersion('1.10.0', '1.9.9')).toBe(false);
  });

  it('says which side to update', () => {
    expect(checkCompatibility({ name: 'x', apiVersion: 1, minAppVersion: '1.1.6' }, '1.1.6')).toBe('ok');
    expect(checkCompatibility({ name: 'x', apiVersion: 2, minAppVersion: '1.1.6' }, '1.1.6')).toBe('update_app');
    expect(checkCompatibility({ name: 'x', apiVersion: 1, minAppVersion: '1.3.0' }, '1.2.0')).toBe('update_app');
    expect(checkCompatibility({ name: 'x', apiVersion: 0, minAppVersion: '1.0.0' }, '1.2.0')).toBe('update_server');
    expect(checkCompatibility({} as never, '1.2.0')).toBe('update_server');
  });
});

describe('API client', () => {
  const respond = (status: number, body?: unknown) => jest.fn().mockResolvedValue({
    status, ok: status >= 200 && status < 300,
    json: async () => { if (body === undefined) throw new Error('no body'); return body; },
  });

  it('calls /api/v1 with the token', async () => {
    const fetchMock = respond(200, { inviteCode: 'X' });
    await multiApi('https://s.example.com', 'tok', fetchMock as never).invite();
    expect(fetchMock).toHaveBeenCalledWith('https://s.example.com/api/v1/invite', expect.objectContaining({
      method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
    }));
  });

  it('sends JSON bodies, rounds the times, with the look of my board', async () => {
    const fetchMock = respond(200, { status: 'won' });
    const look = { board: 'wood', skin: 'taxi', palette: 'ocean' };
    await multiApi('https://s.example.com', 'tok', fetchMock as never).submit('2026-10-16', [{ vehicleId: 'a', delta: 1, t: 10 }], 1234.6, 0.4, look);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ date: '2026-10-16', moves: [{ vehicleId: 'a', delta: 1, t: 10 }], clientMs: 1235, backgroundMs: 0, look });
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('turns the errors of the server into codes', async () => {
    const api = multiApi('https://s.example.com', undefined, respond(409, { error: 'pseudo_taken' }) as never);
    await expect(api.join('code', 'Léo')).rejects.toEqual(new MultiApiError('pseudo_taken', 409));
    const invalid = multiApi('https://s.example.com', 't', respond(400, { error: 'invalid_moves', reason: 'blocked', index: 3 }) as never);
    await expect(invalid.submit('d', [], 0, 0, { board: 'classic', skin: 'classic', palette: 'classic' })).rejects.toMatchObject({ code: 'invalid_moves', details: { reason: 'blocked', index: 3 } });
  });

  it('a page that is not JSON is not a Rush Hours server', async () => {
    await expect(multiApi('https://s.example.com', undefined, respond(200) as never).info()).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('no answer is a network error', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(multiApi('https://s.example.com', undefined, fetchMock as never).info()).rejects.toMatchObject({ code: 'network', status: 0 });
  });

  it('204 has no body', async () => {
    await expect(multiApi('https://s.example.com', 't', respond(204) as never).deleteAccount()).resolves.toBeUndefined();
  });
});

describe('servers and games of the player', () => {
  const account = (url: string, pseudo = 'Léo'): ServerAccount => ({
    url, name: 'Amis', playerId: 1, pseudo, token: `token-${url}`, recoveryCode: 'AAAA-BBBB-CCCC-DDDD', joinedAt: 0,
  });
  const game = (serverUrl: string, date: string): MultiGame => ({
    serverUrl, date, number: 1, level: sampleLevels[0], vehicles: sampleLevels[0].vehicles, moveLog: [],
    startedAt: 0, clockOffset: 0, localStartedAt: 0, deadline: 0, backgroundMs: 0,
  });
  const store = () => useMultiStore.getState();

  beforeEach(() => {
    useMultiStore.setState({ accounts: [], activeUrl: null, introSeen: false, games: {}, blocked: {} });
  });

  it('a joined server becomes the active one; joining it again replaces the account', () => {
    store().addAccount(account('https://a.example.com'));
    store().addAccount(account('https://b.example.com'));
    expect(selectActiveAccount(store())?.url).toBe('https://b.example.com');
    store().addAccount(account('https://a.example.com', 'Mia'));
    expect(store().accounts.map(a => [a.url, a.pseudo])).toEqual([['https://b.example.com', 'Léo'], ['https://a.example.com', 'Mia']]);
    expect(store().activeUrl).toBe('https://a.example.com');
  });

  it('switches between servers', () => {
    store().addAccount(account('https://a.example.com'));
    store().addAccount(account('https://b.example.com'));
    store().setActive('https://a.example.com');
    expect(selectActiveAccount(store())?.url).toBe('https://a.example.com');
    store().setActive('https://unknown.example.com');
    expect(store().activeUrl).toBe('https://a.example.com');
  });

  it('leaving a server forgets its games and picks another server', () => {
    store().addAccount(account('https://a.example.com'));
    store().addAccount(account('https://b.example.com'));
    store().saveGame(game('https://a.example.com', '2026-10-16'));
    store().saveGame(game('https://b.example.com', '2026-10-16'));
    store().removeAccount('https://b.example.com');
    expect(store().activeUrl).toBe('https://a.example.com');
    expect(Object.keys(store().games)).toEqual([gameKey('https://a.example.com', '2026-10-16')]);
    store().removeAccount('https://a.example.com');
    expect(selectActiveAccount(store())).toBeNull();
  });

  it('updates an account', () => {
    store().addAccount(account('https://a.example.com'));
    store().updateAccount('https://a.example.com', { pseudo: 'Léon', recoveryCode: 'NEW' });
    expect(store().accounts[0]).toMatchObject({ pseudo: 'Léon', recoveryCode: 'NEW', token: 'token-https://a.example.com' });
  });

  it('blocks players per server, and forgets them with the server', () => {
    store().addAccount(account('https://a.example.com'));
    store().setBlocked('https://a.example.com', { playerId: 7, pseudo: 'Troll' }, true);
    store().setBlocked('https://a.example.com', { playerId: 7, pseudo: 'Troll' }, true);
    store().setBlocked('https://a.example.com', { playerId: 8, pseudo: 'Spam' }, true);
    store().setBlocked('https://a.example.com', { playerId: 8, pseudo: 'Spam' }, false);
    expect(store().blocked['https://a.example.com']).toEqual([{ playerId: 7, pseudo: 'Troll' }]);
    store().removeAccount('https://a.example.com');
    expect(store().blocked).toEqual({});
  });

  it('a game is kept per server and per day', () => {
    store().saveGame(game('https://a.example.com', '2026-10-16'));
    store().saveGame(game('https://a.example.com', '2026-10-17'));
    store().removeGame('https://a.example.com', '2026-10-16');
    expect(Object.keys(store().games)).toEqual([gameKey('https://a.example.com', '2026-10-17')]);
  });

  it('identities never go into an exported save', () => {
    store().addAccount(account('https://a.example.com'));
    const result = parseSave(exportProgress());
    if (!result.ok) throw new Error(result.error);
    const save = JSON.stringify(result.state);
    expect(save).not.toContain('token-https://a.example.com');
    expect(save).not.toContain('AAAA-BBBB-CCCC-DDDD');
    expect(useMultiStore.persist.getOptions().name).not.toBe(useGameStore.persist.getOptions().name);
  });
});

describe('a multiplayer game on the phone', () => {
  const { elapsedMs, gameFromStart, isWon, playMove, submission, wonResult } = require('../utils/multi/game') as typeof import('../utils/multi/game');
  const { applyMoves } = require('../utils/moveLog') as typeof import('../utils/moveLog');
  const { solvePuzzle } = require('../utils/solver') as typeof import('../utils/solver');
  const level = { ...sampleLevels[0], minMoves: 0 };
  const start = { date: '2026-10-16', number: 3, startedAt: 1_000_000, deadline: 9_000_000, serverNow: 1_000_500, level };
  const URL = 'https://s.example.com';

  it('a first start begins at the start position, on the clock of the server', () => {
    // The phone is 10 s behind the server
    const game = gameFromStart(URL, start, undefined, 990_500);
    expect(game).toMatchObject({ date: '2026-10-16', number: 3, moveLog: [], clockOffset: 10_000, localStartedAt: 990_000, backgroundMs: 0 });
    expect(game.vehicles).toEqual(level.vehicles);
    expect(elapsedMs(game, 990_500 + 60_000)).toBe(60_500);
  });

  it('moves are timed from the start and replay on the server', () => {
    let game = gameFromStart(URL, start, undefined, 1_000_500);
    let now = 1_000_500;
    let won = false;
    for (const move of solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol).moves) {
      now += 2000;
      const played = playMove(game, move.vehicleId, move.toRow, move.toCol, now)!;
      game = played.game;
      won = played.won;
    }
    expect(won).toBe(true);
    expect(game.moveLog[0].t).toBe(2500);
    expect(applyMoves(level, game.moveLog)).toMatchObject({ ok: true, won: true, moveCount: sampleLevels[0].minMoves });
    expect(submission(game, now)).toEqual({ moves: game.moveLog, clientMs: now - game.localStartedAt, backgroundMs: 0 });
  });

  it('a vehicle dropped where it was is not a move', () => {
    const game = gameFromStart(URL, start, undefined, 1_000_500);
    const v = level.vehicles[1];
    expect(playMove(game, v.id, v.row, v.col, 1_001_000)).toBeNull();
    expect(playMove(game, 'nope', 0, 0, 1_001_000)).toBeNull();
  });

  it('a move through a vehicle is never played: the server would refuse the win', () => {
    const { getMoveBounds } = require('../utils/collision') as typeof import('../utils/collision');
    const game = gameFromStart(URL, start, undefined, 1_000_500);
    const blocked = level.vehicles.find(v => getMoveBounds(v, level.vehicles, level.gridSize).max < level.gridSize - v.length)!;
    const { max } = getMoveBounds(blocked, level.vehicles, level.gridSize);
    const horizontal = blocked.orientation === 'horizontal';
    expect(playMove(game, blocked.id, horizontal ? blocked.row : max + 1, horizontal ? max + 1 : blocked.col, 1_001_000)).toBeNull();
  });

  it('times never go back, even if the phone clock does', () => {
    const v = level.vehicles.find(x => !x.isTarget && x.orientation === 'horizontal')!;
    let game = gameFromStart(URL, start, undefined, 1_000_500);
    const free = [1, -1, 2, -2].find(d => applyMoves(level, [{ vehicleId: v.id, delta: d, t: 0 }]).ok)!;
    game = playMove(game, v.id, v.row, v.col + free, 1_010_000)!.game;
    game = playMove(game, v.id, v.row, v.col, 1_005_000)!.game;
    expect(game.moveLog.map(m => m.t)).toEqual([10_000, 10_000]);
  });

  it('resumes the game saved on this phone, or starts over for another game', () => {
    const v = level.vehicles.find(x => !x.isTarget && x.orientation === 'horizontal')!;
    const free = [1, -1, 2, -2].find(d => applyMoves(level, [{ vehicleId: v.id, delta: d, t: 0 }]).ok)!;
    const saved = { ...playMove(gameFromStart(URL, start, undefined, 1_000_500), v.id, v.row, v.col + free, 1_003_000)!.game, backgroundMs: 4000 };
    const resumed = gameFromStart(URL, { ...start, serverNow: 1_100_000 }, saved, 1_099_000);
    expect(resumed.moveLog).toEqual(saved.moveLog);
    expect(resumed.backgroundMs).toBe(4000);
    expect(resumed.clockOffset).toBe(1000);
    // Another day: the saved game is not this one
    expect(gameFromStart(URL, { ...start, date: '2026-10-17' }, saved, 1_099_000).moveLog).toEqual([]);
  });

  it('a game won but not sent is resumed won, and takes no more moves (#117)', () => {
    let game = gameFromStart(URL, start, undefined, 1_000_500);
    for (const move of solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol).moves) {
      game = playMove(game, move.vehicleId, move.toRow, move.toCol, 1_002_000)!.game;
    }
    // The phone closed before the server answered: the saved game comes back as it was
    const resumed = gameFromStart(URL, { ...start, serverNow: 1_100_000 }, game, 1_100_000);
    expect(isWon(resumed)).toBe(true);
    expect(isWon(gameFromStart(URL, start, undefined, 1_000_500))).toBe(false);
    // A move after the win would make the server refuse the whole game
    const other = level.vehicles.find(v => !v.isTarget)!;
    for (const delta of [-2, -1, 1, 2]) {
      const row = other.orientation === 'vertical' ? resumed.vehicles.find(v => v.id === other.id)!.row + delta : other.row;
      const col = other.orientation === 'horizontal' ? resumed.vehicles.find(v => v.id === other.id)!.col + delta : other.col;
      expect(playMove(resumed, other.id, row, col, 1_101_000)).toBeNull();
    }
    expect(applyMoves(level, resumed.moveLog)).toMatchObject({ ok: true, won: true });
  });

  it('a win the server took but whose answer was lost is read back from the day (#117)', () => {
    const today = {
      date: '2026-10-16', number: 3, status: 'ready' as const, releasedAt: 0, closesAt: 0, serverNow: 0, pending: null,
      me: { status: 'won' as const, startedAt: 0, deadline: 0, moves: 12, timeMs: 42_000, minMoves: 10 },
      results: [{ playerId: 7, pseudo: 'Léa', date: '2026-10-16', status: 'won' as const, rank: 2, moves: 12, timeMs: 42_000, points: 8, attemptId: 1, verdict: null, reasons: [] }],
    };
    expect(wonResult(today, '2026-10-16', 7)).toEqual({ status: 'won', moves: 12, timeMs: 42_000, minMoves: 10, rank: 2, points: 8, verdict: null });
    // Another day, another player, or not won: nothing to show
    expect(wonResult(today, '2026-10-15', 7)).toBeNull();
    expect(wonResult(today, '2026-10-16', 8)).toBeNull();
    expect(wonResult({ ...today, me: { ...today.me, status: 'abandoned' as const } }, '2026-10-16', 7)).toBeNull();
  });
});

describe('translations of the multiplayer mode', () => {
  const { MULTI_ERROR_CODES } = require('../components/multi/errors') as typeof import('../components/multi/errors');
  const { ADMIN_SECTIONS } = require('../components/multi/admin/sections') as typeof import('../components/multi/admin/sections');
  const locales = { en: require('../locales/en.json'), fr: require('../locales/fr.json'), sr: require('../locales/sr.json') };

  it.each(Object.entries(locales))('%s has the keys built at runtime', (_, strings) => {
    const multi = strings.multi;
    expect(MULTI_ERROR_CODES.filter(code => typeof multi.errors[code] !== 'string')).toEqual([]);
    expect(Object.keys(multi.status).sort()).toEqual(['abandoned', 'playing', 'unfinished', 'won']);
    expect(Object.keys(multi.ranking_mode).sort()).toEqual(['all', 'dates', 'month', 'week']);
    expect(Object.keys(multi.ranking_mode_desc).sort()).toEqual(['all', 'dates', 'month', 'week']);
    expect(typeof multi.my_abandoned).toBe('string');
    expect(typeof multi.my_unfinished).toBe('string');
    // A title for each page of the admin panel
    expect(ADMIN_SECTIONS.filter(section => typeof multi.admin_home[section] !== 'string')).toEqual([]);
    expect(['scratch', 'catalog'].filter(kind => typeof multi[`admin_puzzles_working_${kind}`] !== 'string')).toEqual([]);
    expect(Object.keys(multi.admin_reset_preset).sort()).toEqual(['all', 'dates', 'month', 'today', 'week']);
    expect(Object.keys(multi.duel).filter(k => /^(outcome|reason_short)_/.test(k)).sort()).toEqual([
      'outcome_draw', 'outcome_loss', 'outcome_win', 'reason_short_disconnected', 'reason_short_forfeit', 'reason_short_timeout', 'reason_short_won',
    ]);
    expect(Object.keys(multi.threshold).sort()).toEqual(Object.keys(require('../server/src/cheat').DEFAULT_THRESHOLDS).sort());
    expect(Object.keys(multi.report_reason).sort()).toEqual(['cheating', 'other', 'pseudo']);
    expect(Object.keys(multi.flag).sort()).toEqual(['clock_mismatch', 'copied', 'too_fast', 'unknown']);
    expect([multi.admin_filter_suspects, multi.admin_filter_all].every(v => typeof v === 'string')).toBe(true);
    expect(Object.keys(multi.setup_test_fail).sort()).toEqual(['address', 'reach', 'server', 'version']);
  });

  it('every suspicion signal of the server is explained', () => {
    const { flagText, verdictIcon } = require('../components/multi/verdict') as typeof import('../components/multi/verdict');
    const t = ((key: string, values?: Record<string, unknown>) => `${key}${values ? JSON.stringify(values) : ''}`) as never;
    expect(flagText(t, { code: 'too_fast', values: { msPerMove: 350, threshold: 600 } })).toBe('multi.flag.too_fast{"ms":350}');
    expect(flagText(t, { code: 'copied', values: { pausePercent: 93, pauseMs: 180_000 } })).toBe('multi.flag.copied{"percent":93,"pause":"3:00"}');
    expect(flagText(t, { code: 'clock_mismatch', values: {} })).toBe('multi.flag.clock_mismatch');
    expect([verdictIcon('suspect'), verdictIcon('cheater')]).toEqual(['warning', 'ban']);
  });

  it('every server error has a message', () => {
    const server = require('fs').readFileSync(require('path').join(__dirname, '../server/src/app.ts'), 'utf8') as string;
    const codes = [...server.matchAll(/new ApiError\(\d+, '([a-z_]+)'/g)].map(m => m[1]);
    expect(codes.length).toBeGreaterThan(10);
    expect([...new Set(codes)].filter(code => !(MULTI_ERROR_CODES as readonly string[]).includes(code))).toEqual([]);
  });

  it('every error of the duels has a message', () => {
    const server = require('fs').readFileSync(require('path').join(__dirname, '../server/src/duel.ts'), 'utf8') as string;
    const codes = [...server.matchAll(/(?:error: |return )'([a-z_]+)'/g)].map(m => m[1]);
    expect(codes).toContain('duel_not_found');
    expect([...new Set(codes)].filter(code => !(MULTI_ERROR_CODES as readonly string[]).includes(code))).toEqual([]);
  });
});

describe('QR code drawn on the phone', () => {
  it('its runs of dark modules are exactly the QR code', () => {
    const qrcode = require('qrcode-generator');
    const { qrRuns } = require('../components/multi/QrCode') as typeof import('../components/multi/QrCode');
    const value = buildInviteLink('https://monserveur.duckdns.org', 'AB33BAVJ11YYPVGKJDRT0EF4');
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const { size, rows } = qrRuns(value);
    expect(size).toBe(qr.getModuleCount());
    for (let r = 0; r < size; r++) {
      const dark = new Set(rows[r].flatMap(([start, length]) => Array.from({ length }, (_, i) => start + i)));
      for (let c = 0; c < size; c++) expect(dark.has(c)).toBe(qr.isDark(r, c));
    }
  });

  it('its SVG path draws each run inside the quiet zone', () => {
    const { qrPath } = require('../components/multi/QrCode') as typeof import('../components/multi/QrCode');
    expect(qrPath([[[0, 2]], [], [[1, 1], [5, 3]]])).toBe('M4 4h2v1h-2zM5 6h1v1h-1zM9 6h3v1h-3z');
  });
});

describe('replay of a multiplayer game', () => {
  const { gapBefore, isLongPause, playbackDelay, timeAt, vehiclesAfter } = require('../utils/multi/replay') as typeof import('../utils/multi/replay');
  const { toMoveRecord } = require('../utils/moveLog') as typeof import('../utils/moveLog');
  const { solvePuzzle } = require('../utils/solver') as typeof import('../utils/solver');
  const level = sampleLevels[0];
  // The optimal solution, the 3rd move after a long pause
  const times = [2000, 3000, 83_000, 84_500, 86_000, 87_000, 88_000, 89_000, 90_000, 91_000];
  let vehicles = level.vehicles;
  const log = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol).moves.map((m, i) => {
    const v = vehicles.find(x => x.id === m.vehicleId)!;
    vehicles = vehicles.map(x => (x.id === m.vehicleId ? { ...x, row: m.toRow, col: m.toCol } : x));
    return toMoveRecord(v, m.toRow, m.toCol, times[i] ?? 100_000 + i * 1000)!;
  });

  it('positions move by move, from the start to the end', () => {
    expect(vehiclesAfter(level, log, 0)).toEqual(level.vehicles);
    expect(vehiclesAfter(level, log, log.length)).toEqual(vehicles);
    expect(vehiclesAfter(level, log, 99)).toEqual(vehicles);
  });

  it('plays at the real pace, faster with a speed', () => {
    expect(gapBefore(log, 1)).toBe(2000);
    expect(playbackDelay(log, 1, 1)).toBe(2000);
    expect(playbackDelay(log, 2, 2)).toBe(500);
    expect(playbackDelay(log, 4, 4)).toBe(375);
  });

  it('a long pause is shortened, and can be shown', () => {
    expect(gapBefore(log, 3)).toBe(80_000);
    expect(isLongPause(gapBefore(log, 3))).toBe(true);
    expect(playbackDelay(log, 3, 1)).toBe(1500);
    expect(isLongPause(gapBefore(log, 4))).toBe(false);
  });

  it('the clock shows the game time of the last move played', () => {
    expect(timeAt(log, 0)).toBe(0);
    expect(timeAt(log, 3)).toBe(83_000);
  });
});

describe('create my server', () => {
  const { buildCompose, buildNginx, domainOf, SECRET_PLACEHOLDER } = require('../utils/multi/serverSetup') as typeof import('../utils/multi/serverSetup');
  const { testConnection } = require('../utils/multi/connectionTest') as typeof import('../utils/multi/connectionTest');
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const choices = { name: 'Les amis du jeudi', timeZone: 'Europe/Paris', releaseTime: '18:30', difficulty: 'HARD,SUNDAY=EXPERT' };

  const envKeys = (yaml: string) => [...yaml.matchAll(/^ {6}([A-Z_]+):/gm)].map(m => m[1]);

  it('the docker-compose.yml of the guide has the same settings as the one of the server', () => {
    const reference = fs.readFileSync(path.join(__dirname, '../server/docker-compose.yml'), 'utf8');
    expect(envKeys(buildCompose(choices))).toEqual(envKeys(reference));
  });

  it('is filled with the choices of the player, the secrets left to paste', () => {
    const compose = buildCompose(choices);
    expect(compose).toContain('SERVER_NAME: "Les amis du jeudi"');
    expect(compose).toContain('RELEASE_TIME: "18:30"');
    expect(compose).toContain('DIFFICULTY: "HARD,SUNDAY=EXPERT"');
    expect(compose.match(new RegExp(SECRET_PLACEHOLDER, 'g'))).toHaveLength(2);
    // A quote in the name cannot break the file
    expect(buildCompose({ ...choices, name: 'Le "club"' })).toContain('SERVER_NAME: "Le club"');
    expect(buildCompose({ ...choices, name: '  ' })).toContain('SERVER_NAME: "Rush Hours"');
  });

  it('the nginx site uses the domain of the player', () => {
    expect(domainOf(' https://EkRushHours.duckdns.org/api/v1 ')).toBe('ekrushhours.duckdns.org');
    const site = buildNginx('https://ekrushhours.duckdns.org/');
    expect(site).toContain('server_name ekrushhours.duckdns.org;');
    expect(site).toContain('/etc/letsencrypt/live/ekrushhours.duckdns.org/fullchain.pem');
    expect(site).toContain('proxy_pass http://127.0.0.1:3000;');
    // The duels go through a WebSocket
    expect(site).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(site).toContain('proxy_set_header Connection "upgrade";');
  });

  const answer = (status: number, body?: unknown) => jest.fn().mockResolvedValue({
    status, ok: status >= 200 && status < 300,
    json: async () => { if (body === undefined) throw new Error('not json'); return body; },
  });

  it('a working server', async () => {
    const result = await testConnection('ekrushhours.duckdns.org', '1.1.6', answer(200, { name: 'EK', apiVersion: 1, minAppVersion: '1.1.6' }) as never);
    expect(result).toEqual({ ok: true, url: 'https://ekrushhours.duckdns.org', info: { name: 'EK', apiVersion: 1, minAppVersion: '1.1.6' } });
  });

  it.each([
    ['http://ekrushhours.duckdns.org', answer(200, {}), { step: 'address', error: 'not_https' }],
    ['not a server', answer(200, {}), { step: 'address', error: 'invalid_url' }],
    ['ekrushhours.duckdns.org', jest.fn().mockRejectedValue(new TypeError('Network request failed')), { step: 'reach', error: 'network' }],
    ['ekrushhours.duckdns.org', answer(502), { step: 'server', error: 'bad_response' }],
    ['ekrushhours.duckdns.org', answer(404, { error: 'not_found' }), { step: 'server', error: 'not_found' }],
    ['ekrushhours.duckdns.org', answer(200, { hello: 'nginx' }), { step: 'server', error: 'bad_response' }],
    ['ekrushhours.duckdns.org', answer(200, { name: 'EK', apiVersion: 2, minAppVersion: '1.1.6' }), { step: 'version', error: 'update_app' }],
  ])('%s: says which step fails', async (input, fetchMock, expected) => {
    expect(await testConnection(input, '1.1.6', fetchMock as never)).toMatchObject({ ok: false, ...expected });
  });
});

describe('admin reset', () => {
  const { resetRange } = require('../utils/multi/reset') as typeof import('../utils/multi/reset');
  const dates = { from: '2026-10-01', to: '2026-10-05' };

  it('covers the days of a preset', () => {
    // A Saturday
    expect(resetRange('today', '2026-10-17', dates)).toEqual({ from: '2026-10-17', to: '2026-10-17' });
    expect(resetRange('week', '2026-10-17', dates)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(resetRange('week', '2026-10-12', dates)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(resetRange('week', '2026-10-18', dates)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(resetRange('month', '2026-02-10', dates)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(resetRange('month', '2026-12-31', dates)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(resetRange('all', '2026-10-17', dates)).toEqual({ from: null, to: null });
  });

  it('chosen days in any order', () => {
    expect(resetRange('dates', '2026-10-17', dates)).toEqual(dates);
    expect(resetRange('dates', '2026-10-17', { from: '2026-10-05', to: '2026-10-01' })).toEqual(dates);
  });
});

describe('admin panel', () => {
  const { matchesPseudo } = require('../utils/multi/format') as typeof import('../utils/multi/format');
  const { isAdminSection } = require('../components/multi/admin/sections') as typeof import('../components/multi/admin/sections');

  it('finds a player without case nor accents', () => {
    expect(matchesPseudo('Léo', 'leo')).toBe(true);
    expect(matchesPseudo('Léo', 'LÉ')).toBe(true);
    expect(matchesPseudo('Chloé', ' OE ')).toBe(true);
    expect(matchesPseudo('Chloé', 'eo')).toBe(false);
    expect(matchesPseudo('Chloé', 'loé')).toBe(true);
    expect(matchesPseudo('Mia', '')).toBe(true);
    expect(matchesPseudo('Mia', 'léo')).toBe(false);
  });

  it('opens only its own pages', () => {
    expect(isAdminSection('games')).toBe(true);
    expect(isAdminSection('settings')).toBe(false);
    expect(isAdminSection(undefined)).toBe(false);
  });
});

describe('week of the challenges', () => {
  it('starts on Monday', () => {
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
  });

  it('shows the recap of last week from Monday to Wednesday', () => {
    expect(['2026-10-19', '2026-10-20', '2026-10-21'].map(showsWeekRecap)).toEqual([true, true, true]);
    expect(['2026-10-22', '2026-10-25'].map(showsWeekRecap)).toEqual([false, false]);
  });

  it('fills the days of a player up to the challenge being played', () => {
    const days = [
      { date: '2026-10-19', points: 10, status: 'won' as const },
      { date: '2026-10-20', points: 0, status: 'abandoned' as const },
      { date: '2026-10-22', points: 0, status: 'playing' as const },
    ];
    expect(weekCells('2026-10-19', days, '2026-10-22').map(c => (c.kind === 'points' ? c.points : c.kind))).toEqual([
      10, 0, 'missed', 'playing', 'upcoming', 'upcoming', 'upcoming',
    ]);
    // Today's challenge not started yet: still to come
    expect(weekCells('2026-10-19', [], '2026-10-21').map(c => c.kind)).toEqual([
      'missed', 'missed', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
  });
});

describe('weekly rankings period', () => {
  const { rankingQuery, rankingDays, isPeriodOver, shiftMonth, stripOffsets } = require('../utils/multi/rankingPeriod') as typeof import('../utils/multi/rankingPeriod');
  const { rankingParams } = require('../utils/multi/api') as typeof import('../utils/multi/api');
  const dates = { from: '2026-10-05', to: '2026-10-01' };
  const view = (mode: 'week' | 'month' | 'dates' | 'all', offset = 0) => ({ mode, offset, dates });
  // A Monday, early in the month
  const today = '2026-10-19';

  it('asks the server for a week or a month back from this one, or two dates in order', () => {
    expect(rankingQuery(view('week'), today)).toEqual({ period: 'week' });
    expect(rankingQuery(view('week', -1), today)).toEqual({ period: 'week', date: '2026-10-12' });
    expect(rankingQuery(view('week', -3), today)).toEqual({ period: 'week', date: '2026-09-28' });
    expect(rankingQuery(view('month'), today)).toEqual({ period: 'month' });
    expect(rankingQuery(view('month', -1), today)).toEqual({ period: 'month', date: '2026-09-01' });
    expect(rankingQuery(view('month', -1), '2026-01-15')).toEqual({ period: 'month', date: '2025-12-01' });
    expect(rankingQuery(view('dates'), today)).toEqual({ period: 'range', from: '2026-10-01', to: '2026-10-05' });
    expect(rankingQuery(view('all'), today)).toEqual({ period: 'all' });
  });

  it('offers the weeks and the months back from the current one', () => {
    expect(stripOffsets('week').slice(0, 3)).toEqual([0, -1, -2]);
    expect(stripOffsets('week')).toHaveLength(53);
    expect(stripOffsets('month').at(-1)).toBe(-36);
  });

  it('steps months across the years', () => {
    expect(shiftMonth('2026-10-19', 0)).toBe('2026-10-01');
    expect(shiftMonth('2026-01-31', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-03-31', -13)).toBe('2025-02-01');
    expect(shiftMonth('2025-12-01', 1)).toBe('2026-01-01');
  });

  it('shows the days covered', () => {
    expect(rankingDays(view('week'), today)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(rankingDays(view('week', -1), today)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(rankingDays(view('month'), today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(rankingDays(view('month', -1), today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rankingDays(view('dates'), today)).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(rankingDays(view('all'), today)).toBeNull();
  });

  it('a period over has a final ranking', () => {
    expect(isPeriodOver(view('week'), today)).toBe(false);
    expect(isPeriodOver(view('week', -1), today)).toBe(true);
    expect(isPeriodOver(view('month'), today)).toBe(false);
    expect(isPeriodOver(view('month', -1), today)).toBe(true);
    expect(isPeriodOver(view('dates'), today)).toBe(true);
    expect(isPeriodOver({ mode: 'dates', offset: 0, dates: { from: '2026-10-12', to: today } }, today)).toBe(false);
    expect(isPeriodOver(view('all'), today)).toBe(false);
  });

  it('builds the query string of the server', () => {
    expect(rankingParams({ period: 'day' })).toBe('period=day');
    expect(rankingParams({ period: 'week', date: '2026-10-12' })).toBe('period=week&date=2026-10-12');
    expect(rankingParams({ period: 'range', from: '2026-10-01', to: '2026-10-05' })).toBe('period=range&from=2026-10-01&to=2026-10-05');
  });
});
