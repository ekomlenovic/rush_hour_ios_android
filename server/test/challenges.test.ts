import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDatabase } from '../src/db';
import { Challenges } from '../src/challenges';
import { generatePuzzle, workerGenerator } from '../src/generation';
import { applyMoves, solvePuzzle } from './solve';
import { fakeGenerator, paris, testConfig, testServer } from './helpers';
import { puzzleSeed } from '../src/secrets';

const silent = { info: () => {}, error: () => {} };

const challengesRow = (db: ReturnType<typeof openDatabase>, date: string) =>
  ({ ...(db.prepare('SELECT * FROM challenges WHERE date = ?').get(date) as object) });

function challengesAt(at: number, env: Record<string, string> = {}, level?: Parameters<typeof fakeGenerator>[0]) {
  const clock = { now: at };
  const db = openDatabase(':memory:');
  const { generator, calls } = fakeGenerator(level);
  const challenges = new Challenges(db, testConfig(env), generator, () => clock.now, silent);
  return { challenges, clock, calls, db };
}

describe('pregeneration', () => {
  it('generates the current challenge and the ones coming out within PREGENERATE_AHEAD', async () => {
    const { challenges, calls } = challengesAt(paris('2026-10-16', '15:00'), { PREGENERATE_AHEAD: '24h' });
    await challenges.pregenerate();
    // The 17th comes out in 21 h (< 24 h), the 18th in 45 h
    expect(calls.map(c => c.difficulty)).toHaveLength(2);
    expect(challenges.get('2026-10-16')).toBeDefined();
    expect(challenges.get('2026-10-17')).toBeDefined();
    expect(challenges.get('2026-10-18')).toBeUndefined();
  });

  it('never generates the same day twice', async () => {
    const { challenges, calls, clock } = challengesAt(paris('2026-10-16', '15:00'), { PREGENERATE_AHEAD: '24h' });
    await Promise.all([challenges.pregenerate(), challenges.pregenerate(), challenges.ensure('2026-10-16')]);
    clock.now += 3_600_000;
    await challenges.pregenerate();
    expect(calls).toHaveLength(2);
  });

  it('the seed is secret: it depends on SERVER_SECRET, the date and the difficulty', async () => {
    const { challenges, calls } = challengesAt(paris('2026-10-16', '15:00'), { PREGENERATE_AHEAD: '1m' });
    await challenges.pregenerate();
    const config = testConfig();
    expect(calls).toEqual([{ seed: puzzleSeed(config.serverSecret, '2026-10-16', 'NORMAL'), difficulty: 'NORMAL' }]);
    expect(calls[0].seed).not.toContain('2026');
    expect(puzzleSeed('another-secret-0123456', '2026-10-16', 'NORMAL')).not.toBe(calls[0].seed);
  });

  it('uses the difficulty of the day of the week', async () => {
    // 2026-10-19 is a Monday
    const { challenges, calls } = challengesAt(paris('2026-10-18', '15:00'), { PREGENERATE_AHEAD: '24h' });
    await challenges.pregenerate();
    expect(calls.map(c => c.difficulty)).toEqual(['NORMAL', 'HARD']);
  });

  it('a new difficulty regenerates the puzzles not released yet, never the released ones', async () => {
    const db = openDatabase(':memory:');
    const at = paris('2026-10-16', '15:00');
    const first = fakeGenerator();
    await new Challenges(db, testConfig({ PREGENERATE_AHEAD: '24h' }), first.generator, () => at, silent).pregenerate();

    const second = fakeGenerator();
    const challenges = new Challenges(db, testConfig({ PREGENERATE_AHEAD: '24h', DIFFICULTY: 'EXPERT' }), second.generator, () => at, silent);
    await challenges.pregenerate();
    expect(second.calls.map(c => c.difficulty)).toEqual(['EXPERT']);
    expect(challenges.get('2026-10-16')!.difficulty).toBe('NORMAL');
    expect(challenges.get('2026-10-17')!.difficulty).toBe('EXPERT');
  });

  it('a puzzle released while its regeneration runs is kept: the games started on it stay valid', async () => {
    const db = openDatabase(':memory:');
    const clock = { now: paris('2026-10-17', '11:50') };
    await new Challenges(db, testConfig(), fakeGenerator().generator, () => clock.now, silent).ensure('2026-10-17');
    const before = challengesRow(db, '2026-10-17');

    // A slow generation for the new difficulty, that ends after the release at 12:00
    let finish: () => void = () => {};
    const slow = fakeGenerator();
    const generator = {
      ...slow.generator,
      generate: (seed: string, difficulty: Parameters<typeof slow.generator.generate>[1]) =>
        new Promise<void>(resolve => { finish = resolve; }).then(() => slow.generator.generate(seed, difficulty)),
    };
    const challenges = new Challenges(db, testConfig({ DIFFICULTY: 'HARD' }), generator, () => clock.now, silent);
    const job = challenges.ensure('2026-10-17');
    clock.now = paris('2026-10-17', '12:01');
    finish();

    expect(await job).toEqual(before);
    expect(challengesRow(db, '2026-10-17')).toEqual(before);
  });

  it('tries other seeds when a generation fails, and gives up after a few', async () => {
    const { challenges, calls } = challengesAt(paris('2026-10-16', '15:00'), { PREGENERATE_AHEAD: '1m' }, null);
    expect(await challenges.ensure('2026-10-16')).toBeNull();
    expect(calls.map(c => c.seed.split(':')[1] ?? '0')).toEqual(['0', '1', '2', '3', '4']);
  });

  it('numbers the challenges from the first day of the server', () => {
    const { challenges, clock, db } = challengesAt(paris('2026-10-16', '09:00'));
    expect(challenges.currentDate()).toBe('2026-10-15');
    expect(challenges.number('2026-10-15')).toBe(1);
    clock.now = paris('2026-11-01', '12:00');
    expect(challenges.number(challenges.currentDate())).toBe(18);
    // The first day is kept across restarts
    const restarted = new Challenges(db, testConfig(), fakeGenerator().generator, () => clock.now, silent);
    expect(restarted.number('2026-10-15')).toBe(1);
  });
});

describe('replays', () => {
  it('the moves are deleted after REPLAY_RETENTION_DAYS, the scores stay', async () => {
    const { join, play, challenges, clock, db } = testServer({ env: { REPLAY_RETENTION_DAYS: '7' } });
    const { token } = await join('Léo');
    await play(token);
    clock.now += 6 * 86_400_000;
    expect(challenges.purgeReplays()).toBe(0);
    clock.now += 2 * 86_400_000;
    expect(challenges.purgeReplays()).toBe(1);
    expect(db.prepare('SELECT status, move_count, moves_json FROM attempts').get()).toEqual({ status: 'won', move_count: 2, moves_json: null });
  });
});

describe('real generation', () => {
  it('a puzzle of the server is solvable in its optimum and deterministic', () => {
    const a = generatePuzzle('a-secret-seed', 'EASY')!;
    const b = generatePuzzle('a-secret-seed', 'EASY')!;
    expect({ ...a, updatedAt: 0 }).toEqual({ ...b, updatedAt: 0 });
    expect(a.id).toBe(999996);
    const solution = solvePuzzle(a);
    expect(solution.length).toBe(a.minMoves);
    expect(applyMoves(a, solution)).toMatchObject({ ok: true, won: true, moveCount: a.minMoves });
  });

  it('runs in a worker thread once built', async () => {
    const root = path.resolve(__dirname, '..');
    execFileSync('node', ['build.mjs'], { cwd: root, stdio: 'ignore' });
    const generator = workerGenerator(path.join(root, 'dist', 'worker.cjs'));
    try {
      const [a, b] = await Promise.all([generator.generate('seed-1', 'EASY'), generator.generate('seed-2', 'EASY')]);
      expect(a!.vehicles).not.toEqual(b!.vehicles);
      expect({ ...a!, updatedAt: 0 }).toEqual({ ...generatePuzzle('seed-1', 'EASY')!, updatedAt: 0 });
    } finally {
      await generator.close();
    }
  });
});
