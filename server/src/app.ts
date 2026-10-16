import Fastify, { LogController, type FastifyInstance, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { Config } from './config';
import { getSetting, setSetting, type Database } from './db';
import { Challenges, type ChallengeRow } from './challenges';
import type { PuzzleGenerator } from './generation';
import { applyMoves, type MoveRecord } from './core';
import { cleanPseudo, pseudoKey, PSEUDO_MAX } from './pseudo';
import { rankDay, rankPeriod, type GameResult, type GameStatus } from './leaderboard';
import { newInviteCode, newRecoveryCode, newToken, normalizeRecoveryCode, secretEquals, sha256 } from './secrets';
import { addDays, isValidDate, periodBounds } from './time';

/** Version of this API: the app refuses a server it does not know how to talk to */
export const API_VERSION = 1;
/** Oldest app that can use this server: the version of the app with the multiplayer mode, raised when the API breaks */
export const MIN_APP_VERSION = '1.1.6';
/** A game log longer than this is refused (the hardest puzzles take about 80 moves) */
export const MAX_MOVES = 1000;

export interface AppDeps {
  config: Config;
  db: Database;
  generator: PuzzleGenerator;
  now?: () => number;
  logger?: boolean | object;
}

interface Player { id: number; pseudo: string; created_at: number }

interface AttemptRow {
  id: number;
  player_id: number;
  date: string;
  status: 'playing' | 'won' | 'abandoned';
  started_at: number;
  finished_at: number | null;
  move_count: number | null;
  server_ms: number | null;
}

declare module 'fastify' {
  interface FastifyRequest { player: Player }
}

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly extra: object = {}) {
    super(code);
  }
}

/** The invite code: from INVITE_CODE, or generated once and kept in the database */
export function inviteCode(db: Database, config: Config): { code: string; generated: boolean } {
  if (config.inviteCode) return { code: config.inviteCode, generated: false };
  const stored = getSetting(db, 'invite_code');
  if (stored) return { code: stored, generated: false };
  const code = newInviteCode();
  setSetting(db, 'invite_code', code);
  return { code, generated: true };
}

export function buildApp({ config, db, generator, now = Date.now, logger = false }: AppDeps) {
  const app: FastifyInstance = Fastify({
    logger: logger === true ? { redact: ['req.headers.authorization'] } : logger,
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
    // No log line per request: the server keeps no IP addresses (errors are still logged)
    logController: new LogController({ disableRequestLogging: true }),
  });
  const challenges = new Challenges(db, config, generator, now, app.log);
  const invite = inviteCode(db, config);
  if (invite.generated) app.log.info({ inviteCode: invite.code }, 'invite code generated: share it with your friends');

  app.decorateRequest('player', null as unknown as Player);

  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send({ error: error.code, ...error.extra });
    if (error.validation) return reply.status(400).send({ error: 'invalid_request' });
    if (error.statusCode === 429) return reply.status(429).send({ error: 'rate_limited' });
    if (error.statusCode && error.statusCode < 500) return reply.status(error.statusCode).send({ error: 'invalid_request' });
    request.log.error({ err: error }, 'request failed');
    return reply.status(500).send({ error: 'internal' });
  });
  app.setNotFoundHandler((_, reply) => reply.status(404).send({ error: 'not_found' }));

  // ── Players ────────────────────────────────────────────────────────────────

  const findByToken = db.prepare('SELECT id, pseudo, created_at FROM players WHERE token_hash = ?');

  async function authenticate(request: FastifyRequest) {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const player = token ? findByToken.get(sha256(token)) as Player | undefined : undefined;
    if (!player) throw new ApiError(401, 'unauthorized');
    request.player = player;
  }

  function pseudoOrThrow(input: unknown): string {
    const pseudo = cleanPseudo(input);
    if (!pseudo) throw new ApiError(400, 'invalid_pseudo');
    return pseudo;
  }

  const isPseudoTaken = (pseudo: string, exceptId = 0) =>
    !!db.prepare('SELECT 1 FROM players WHERE pseudo_key = ? AND id != ?').get(pseudoKey(pseudo), exceptId);

  const publicPlayer = (p: Player) => ({ id: p.id, pseudo: p.pseudo, createdAt: p.created_at });

  // ── Games ──────────────────────────────────────────────────────────────────

  const getAttempt = (playerId: number, date: string) =>
    db.prepare('SELECT * FROM attempts WHERE player_id = ? AND date = ?').get(playerId, date) as AttemptRow | undefined;

  /** A game still 'playing' after its deadline is unfinished */
  const statusOf = (a: AttemptRow): GameStatus =>
    a.status === 'playing' && now() > challenges.deadline(a.date) ? 'unfinished' : a.status;

  function resultsOf(from: string, to: string): GameResult[] {
    const rows = db.prepare(`
      SELECT a.*, p.pseudo FROM attempts a JOIN players p ON p.id = a.player_id
      WHERE a.date BETWEEN ? AND ? ORDER BY a.date
    `).all(from, to) as unknown as (AttemptRow & { pseudo: string })[];
    return rows.map(a => {
      const status = statusOf(a);
      return {
        playerId: a.player_id, pseudo: a.pseudo, date: a.date, status,
        moves: status === 'won' ? a.move_count : null,
        timeMs: status === 'won' ? a.server_ms : null,
      };
    });
  }

  const dayRanking = (date: string) => rankDay(resultsOf(date, date));

  /** The puzzle as sent to a player: its optimum stays hidden until the game is over */
  const puzzleFor = (row: ChallengeRow) => ({ ...challenges.level(row), minMoves: 0 });

  function myGame(a: AttemptRow | undefined, row: ChallengeRow | undefined) {
    if (!a) return null;
    const status = statusOf(a);
    const over = status !== 'playing';
    return {
      status,
      startedAt: a.started_at,
      deadline: challenges.deadline(a.date),
      moves: status === 'won' ? a.move_count : null,
      timeMs: status === 'won' ? a.server_ms : null,
      minMoves: over && row ? row.min_moves : null,
    };
  }

  // ── Routes ─────────────────────────────────────────────────────────────────

  app.register(async (api) => {
    await api.register(rateLimit, { max: 120, timeWindow: '1 minute' });
    const strict = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } };

    api.get('/info', async () => ({
      name: config.serverName,
      apiVersion: API_VERSION,
      minAppVersion: MIN_APP_VERSION,
    }));

    api.post<{ Body: { inviteCode: string; pseudo: string } }>('/join', {
      ...strict,
      schema: {
        body: {
          type: 'object', required: ['inviteCode', 'pseudo'],
          properties: { inviteCode: { type: 'string', maxLength: 200 }, pseudo: { type: 'string', maxLength: PSEUDO_MAX * 4 } },
        },
      },
    }, async (request, reply) => {
      if (!secretEquals(request.body.inviteCode.trim(), inviteCode(db, config).code)) throw new ApiError(403, 'invalid_invite');
      const pseudo = pseudoOrThrow(request.body.pseudo);
      if (isPseudoTaken(pseudo)) throw new ApiError(409, 'pseudo_taken');
      const token = newToken();
      const recoveryCode = newRecoveryCode();
      const result = db.prepare('INSERT INTO players (pseudo, pseudo_key, token_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(pseudo, pseudoKey(pseudo), sha256(token), sha256(normalizeRecoveryCode(recoveryCode)), now());
      const player = { id: Number(result.lastInsertRowid), pseudo, created_at: now() };
      return reply.status(201).send({ token, recoveryCode, player: publicPlayer(player), server: { name: config.serverName } });
    });

    api.post<{ Body: { recoveryCode: string } }>('/recover', {
      ...strict,
      schema: {
        body: { type: 'object', required: ['recoveryCode'], properties: { recoveryCode: { type: 'string', maxLength: 100 } } },
      },
    }, async (request) => {
      const hash = sha256(normalizeRecoveryCode(request.body.recoveryCode));
      const player = db.prepare('SELECT id, pseudo, created_at FROM players WHERE recovery_hash = ?').get(hash) as Player | undefined;
      if (!player) throw new ApiError(403, 'invalid_recovery_code');
      // A new token: the previous phone is signed out
      const token = newToken();
      db.prepare('UPDATE players SET token_hash = ? WHERE id = ?').run(sha256(token), player.id);
      return { token, player: publicPlayer(player), server: { name: config.serverName } };
    });

    // Everything else needs a player
    api.register(async (auth) => {
      auth.addHook('onRequest', authenticate);

      auth.get('/me', async (request) => publicPlayer(request.player));

      auth.patch<{ Body: { pseudo: string } }>('/me', {
        schema: { body: { type: 'object', required: ['pseudo'], properties: { pseudo: { type: 'string', maxLength: PSEUDO_MAX * 4 } } } },
      }, async (request) => {
        const pseudo = pseudoOrThrow(request.body.pseudo);
        if (isPseudoTaken(pseudo, request.player.id)) throw new ApiError(409, 'pseudo_taken');
        db.prepare('UPDATE players SET pseudo = ?, pseudo_key = ? WHERE id = ?').run(pseudo, pseudoKey(pseudo), request.player.id);
        return publicPlayer({ ...request.player, pseudo });
      });

      // Every member can invite a friend (invitations may be kept to the admin later, #50)
      auth.get('/invite', async () => ({ inviteCode: inviteCode(db, config).code }));

      auth.post('/me/recovery', async (request) => {
        const recoveryCode = newRecoveryCode();
        db.prepare('UPDATE players SET recovery_hash = ? WHERE id = ?').run(sha256(normalizeRecoveryCode(recoveryCode)), request.player.id);
        return { recoveryCode };
      });

      auth.delete('/me', async (request, reply) => {
        // Games go with the player (ON DELETE CASCADE)
        db.prepare('DELETE FROM players WHERE id = ?').run(request.player.id);
        return reply.status(204).send();
      });

      auth.get('/challenge/today', async (request) => {
        const date = challenges.currentDate();
        const row = challenges.get(date);
        // Not generated yet (server just started): on its way, the app shows "preparing"
        if (!row) challenges.ensure(date).catch(err => request.log.error({ err }, 'challenge generation failed'));
        const mine = getAttempt(request.player.id, date);
        // A game of the previous challenge that can still be finished (grace period)
        const previous = getAttempt(request.player.id, addDays(date, -1));
        return {
          date,
          number: challenges.number(date),
          status: row ? 'ready' : 'preparing',
          releasedAt: challenges.releaseAt(date),
          closesAt: challenges.closesAt(date),
          serverNow: now(),
          me: myGame(mine, row),
          pending: previous && statusOf(previous) === 'playing'
            ? { date: previous.date, deadline: challenges.deadline(previous.date) } : null,
          results: dayRanking(date),
        };
      });

      auth.post<{ Body: { date?: string } }>('/challenge/start', {
        schema: { body: { type: ['object', 'null'], properties: { date: { type: 'string', maxLength: 10 } } } },
      }, async (request) => {
        const current = challenges.currentDate();
        const date = request.body?.date ?? current;
        if (!isValidDate(date)) throw new ApiError(400, 'invalid_request');

        const existing = getAttempt(request.player.id, date);
        if (existing && statusOf(existing) !== 'playing') throw new ApiError(409, 'already_finished');
        // Only the current challenge can be started; an earlier one only resumed
        if (!existing && date !== current) throw new ApiError(409, 'challenge_closed');

        const row = challenges.get(date) ?? (date === current ? await challenges.ensure(date) : undefined);
        if (!row) throw new ApiError(503, 'preparing');

        let attempt = existing;
        if (!attempt) {
          db.prepare("INSERT OR IGNORE INTO attempts (player_id, date, status, started_at) VALUES (?, ?, 'playing', ?)")
            .run(request.player.id, date, now());
          attempt = getAttempt(request.player.id, date)!;
        }
        return {
          date,
          number: challenges.number(date),
          startedAt: attempt.started_at,
          deadline: challenges.deadline(date),
          serverNow: now(),
          level: puzzleFor(row),
        };
      });

      auth.post<{ Body: { date: string; moves: MoveRecord[]; clientMs?: number; backgroundMs?: number } }>('/challenge/submit', {
        schema: {
          body: {
            type: 'object', required: ['date', 'moves'],
            properties: {
              date: { type: 'string', maxLength: 10 },
              moves: {
                type: 'array', maxItems: MAX_MOVES,
                items: {
                  type: 'object', required: ['vehicleId', 'delta', 't'],
                  properties: { vehicleId: { type: 'string', maxLength: 32 }, delta: { type: 'integer' }, t: { type: 'number' } },
                },
              },
              clientMs: { type: 'number', minimum: 0 },
              backgroundMs: { type: 'number', minimum: 0 },
            },
          },
        },
      }, async (request) => {
        const { date, moves, clientMs, backgroundMs } = request.body;
        const attempt = getAttempt(request.player.id, date);
        if (!attempt) throw new ApiError(404, 'no_game');
        const status = statusOf(attempt);
        if (status === 'unfinished') throw new ApiError(409, 'too_late');
        if (status !== 'playing') throw new ApiError(409, 'already_finished');

        const row = challenges.get(date)!;
        const replay = applyMoves(challenges.level(row), moves);
        if (!replay.ok) throw new ApiError(400, 'invalid_moves', { reason: replay.error, index: replay.index });
        if (!replay.won) throw new ApiError(400, 'not_won');

        const finishedAt = now();
        const moveLog = moves.map(({ vehicleId, delta, t }) => ({ vehicleId, delta, t }));
        db.prepare(`
          UPDATE attempts SET status = 'won', finished_at = ?, move_count = ?, server_ms = ?, client_ms = ?, background_ms = ?, moves_json = ?
          WHERE id = ? AND status = 'playing'
        `).run(finishedAt, replay.moveCount, finishedAt - attempt.started_at,
          clientMs === undefined ? null : Math.round(clientMs), backgroundMs === undefined ? null : Math.round(backgroundMs),
          JSON.stringify(moveLog), attempt.id);

        const mine = dayRanking(date).find(r => r.playerId === request.player.id)!;
        return {
          status: 'won', moves: replay.moveCount, timeMs: finishedAt - attempt.started_at,
          minMoves: row.min_moves, rank: mine.rank, points: mine.points,
        };
      });

      auth.post<{ Body: { date: string } }>('/challenge/abandon', {
        schema: { body: { type: 'object', required: ['date'], properties: { date: { type: 'string', maxLength: 10 } } } },
      }, async (request) => {
        const attempt = getAttempt(request.player.id, request.body.date);
        if (!attempt) throw new ApiError(404, 'no_game');
        if (attempt.status !== 'playing') throw new ApiError(409, 'already_finished');
        db.prepare("UPDATE attempts SET status = 'abandoned', finished_at = ? WHERE id = ?").run(now(), attempt.id);
        return { status: 'abandoned', minMoves: challenges.get(attempt.date)?.min_moves ?? null };
      });

      auth.get<{ Querystring: { period?: 'day' | 'week' | 'month'; date?: string } }>('/leaderboard', {
        schema: {
          querystring: {
            type: 'object',
            properties: { period: { type: 'string', enum: ['day', 'week', 'month'] }, date: { type: 'string', maxLength: 10 } },
          },
        },
      }, async (request) => {
        const period = request.query.period ?? 'day';
        const date = request.query.date ?? challenges.currentDate();
        if (!isValidDate(date)) throw new ApiError(400, 'invalid_request');
        const { from, to } = periodBounds(period, date);
        const results = resultsOf(from, to);
        return {
          period, from, to,
          rows: period === 'day' ? rankDay(results) : rankPeriod(results),
        };
      });
    });
  }, { prefix: '/api/v1' });

  app.addHook('onClose', async () => {
    await challenges.stop();
  });

  return { app, challenges };
}


