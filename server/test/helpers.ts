import { loadConfig, type Config } from '../src/config';
import { openDatabase } from '../src/db';
import { buildApp } from '../src/app';
import type { PuzzleGenerator } from '../src/generation';
import type { Level, MoveRecord } from '../src/core';
import { zonedTimeToInstant } from '../src/time';

/**
 * A 6×6 puzzle solved in 2 moves: a vertical car blocks the row of the red car,
 * it goes down 2 cells, then the red car leaves on the right.
 */
export const LEVEL: Level = {
  id: 999996, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 2, updatedAt: 0,
  vehicles: [
    { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: '#E53935' },
    { id: 'v1', row: 1, col: 3, length: 2, orientation: 'vertical', isTarget: false, color: '#1E88E5' },
    { id: 'v2', row: 0, col: 0, length: 3, orientation: 'horizontal', isTarget: false, color: '#43A047' },
  ],
};

export const SOLUTION: MoveRecord[] = [
  { vehicleId: 'v1', delta: 2, t: 4000 },
  { vehicleId: 'target', delta: 4, t: 9000 },
];

/** The same solution with a detour: 4 moves */
export const LONG_SOLUTION: MoveRecord[] = [
  { vehicleId: 'v1', delta: 2, t: 3000 },
  { vehicleId: 'v2', delta: 1, t: 5000 },
  { vehicleId: 'v2', delta: -1, t: 7000 },
  { vehicleId: 'target', delta: 4, t: 9000 },
];

/** Records what it is asked to generate, answers LEVEL */
export function fakeGenerator(level: Level | null = LEVEL) {
  const calls: { seed: string; difficulty: string }[] = [];
  const generator: PuzzleGenerator = {
    generate: async (seed, difficulty) => {
      calls.push({ seed, difficulty });
      return level && { ...level };
    },
    close: async () => {},
  };
  return { generator, calls };
}

export const INVITE = 'invite-code-for-tests';

export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({
    SERVER_SECRET: 'secret-for-tests-0123456789', ADMIN_TOKEN: 'admin-token-for-tests', INVITE_CODE: INVITE,
    TZ: 'Europe/Paris', RELEASE_TIME: '12:00', DATA_DIR: '/tmp', ...env,
  });
}

/** Paris time */
export const paris = (date: string, time: string) => zonedTimeToInstant(date, time, 'Europe/Paris');

/** A server on an in-memory database with a clock under control */
export function testServer(options: { env?: Record<string, string>; level?: Level | null; at?: number; generator?: PuzzleGenerator } = {}) {
  const clock = { now: options.at ?? paris('2026-10-16', '15:00') };
  const db = openDatabase(':memory:');
  const fake = fakeGenerator(options.level === undefined ? LEVEL : options.level);
  const { calls } = fake;
  const generator = options.generator ?? fake.generator;
  const config = testConfig(options.env);
  const { app, challenges } = buildApp({ config, db, generator, now: () => clock.now });

  const request = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token?: string, body?: object) => {
    const res = await app.inject({
      method, url: `/api/v1${url}`, payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: res.statusCode, body: res.body ? res.json() : null };
  };

  const join = async (pseudo: string) => {
    const res = await request('POST', '/join', undefined, { inviteCode: INVITE, pseudo });
    if (res.status !== 201) throw new Error(`join ${pseudo}: ${JSON.stringify(res.body)}`);
    return res.body as { token: string; recoveryCode: string; player: { id: number; pseudo: string } };
  };

  /** Starts the current challenge and wins it with `moves` after `ms` */
  const play = async (token: string, moves = SOLUTION, ms = 30_000) => {
    const start = await request('POST', '/challenge/start', token, {});
    clock.now += ms;
    return request('POST', '/challenge/submit', token, { date: start.body.date, moves });
  };

  return { app, db, challenges, clock, calls, config, request, join, play };
}
