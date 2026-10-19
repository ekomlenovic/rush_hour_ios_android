import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDatabase } from '../src/db';
import { Challenges } from '../src/challenges';
import { generatePuzzle, generateVariants, workerGenerator, type PuzzleGenerator } from '../src/generation';
import { DIFFICULTY_LEVELS, sampleLevels, variantSources, type Level } from '../src/core';
import { applyMoves, solvePuzzle } from './solve';
import { LEVEL, fakeGenerator, paris, testConfig, testServer } from './helpers';
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

describe('variants for the hardest difficulties', () => {
  /** From scratch: what `scratch` answers; variants: LEVEL with the optimum of its source */
  function hardGenerator(scratch: () => Promise<Level | null>) {
    const calls: { kind: string; seed: string; sourceId?: number }[] = [];
    let closed = 0;
    const generator: PuzzleGenerator = {
      generate: (seed) => { calls.push({ kind: 'scratch', seed }); return scratch(); },
      variants: async (sourceId, _difficulty, count, seed) => {
        calls.push({ kind: 'variants', seed, sourceId });
        return Array.from({ length: count }, () => ({ ...LEVEL, minMoves: 42 }));
      },
      close: async () => { closed++; },
    };
    return { generator, calls, closed: () => closed };
  }
  const masterSources = variantSources(sampleLevels, DIFFICULTY_LEVELS.MASTER);

  it('a master challenge that cannot be generated from scratch is a variant of a hard level of the app', async () => {
    const hard = hardGenerator(async () => null);
    const challenges = new Challenges(openDatabase(':memory:'), testConfig({ DIFFICULTY: 'MASTER' }), hard.generator, () => paris('2026-10-16', '15:00'), silent);
    const row = await challenges.ensure('2026-10-17');
    expect(row).toMatchObject({ difficulty: 'MASTER', min_moves: 42 });
    expect(hard.calls.map(c => c.kind)).toEqual(['scratch', 'scratch', 'scratch', 'scratch', 'scratch', 'variants']);
    // From the secret seed of the day: the same on every server with that secret, unknown to the players
    const seed = puzzleSeed(testConfig().serverSecret, '2026-10-17', 'MASTER');
    expect(hard.calls[5].seed).toBe(`${seed}:variant:0`);
    expect(masterSources.map(l => l.id)).toContain(hard.calls[5].sourceId);
  });

  it('needed now (released, not generated yet): a variant at once', async () => {
    const hard = hardGenerator(async () => ({ ...LEVEL }));
    const challenges = new Challenges(openDatabase(':memory:'), testConfig({ DIFFICULTY: 'EXPERT' }), hard.generator, () => paris('2026-10-16', '15:00'), silent);
    expect(await challenges.ensure('2026-10-16')).toMatchObject({ difficulty: 'EXPERT', min_moves: 42 });
    expect(hard.calls.map(c => c.kind)).toEqual(['variants']);
  });

  it('a generation from scratch too long is stopped, a variant instead', async () => {
    const hard = hardGenerator(() => new Promise<Level | null>(() => {}));
    const challenges = new Challenges(openDatabase(':memory:'), testConfig({ DIFFICULTY: 'MASTER' }), hard.generator,
      () => paris('2026-10-16', '15:00'), silent, undefined, { scratchTimeoutMs: 20 });
    expect(await challenges.ensure('2026-10-17')).toMatchObject({ difficulty: 'MASTER', min_moves: 42 });
    expect(hard.calls.map(c => c.kind)).toEqual(['scratch', 'variants']);
    expect(hard.closed()).toBe(1);
  });

  it('from scratch first when there is time: no variant', async () => {
    const hard = hardGenerator(async () => ({ ...LEVEL }));
    const challenges = new Challenges(openDatabase(':memory:'), testConfig({ DIFFICULTY: 'MASTER' }), hard.generator, () => paris('2026-10-16', '15:00'), silent);
    expect(await challenges.ensure('2026-10-17')).toMatchObject({ difficulty: 'MASTER', min_moves: LEVEL.minMoves });
    expect(hard.calls.map(c => c.kind)).toEqual(['scratch']);
    expect(hard.closed()).toBe(0);
  });

  it('never for the other difficulties', async () => {
    const hard = hardGenerator(async () => null);
    const challenges = new Challenges(openDatabase(':memory:'), testConfig({ DIFFICULTY: 'HARD' }), hard.generator, () => paris('2026-10-16', '15:00'), silent);
    expect(await challenges.ensure('2026-10-16')).toBeNull();
    expect(hard.calls.every(c => c.kind === 'scratch')).toBe(true);
  });

  it('a real variant: the same for a seed, its optimum in the master range', async () => {
    const generator: PuzzleGenerator = { ...fakeGenerator(null).generator, variants: async (id, d, count, seed) => generateVariants(id, d, count, seed) };
    // One quick level to explore (up to 15 s for the slowest)
    const levels = masterSources.filter(l => l.id === 101);
    const make = () => new Challenges(openDatabase(':memory:'), testConfig({ DIFFICULTY: 'MASTER' }), generator,
      () => paris('2026-10-16', '15:00'), silent, undefined, { levels }).ensure('2026-10-17');
    const [a, b] = [await make(), await make()];
    expect(levels).toHaveLength(1);
    expect(a!.level_json).toBe(b!.level_json);
    expect(a!.min_moves).toBeGreaterThanOrEqual(DIFFICULTY_LEVELS.MASTER.minMovesRequired);
    expect(a!.min_moves).toBeLessThanOrEqual(DIFFICULTY_LEVELS.MASTER.maxMovesRequired);
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

describe('what the admin sees', () => {
  it('the current challenge and the next ones: generated ahead, then the first one generated later', async () => {
    const { challenges } = challengesAt(paris('2026-10-16', '15:00'), { PREGENERATE_AHEAD: '24h' });
    expect(challenges.overview().map(c => [c.date, c.status])).toEqual([
      ['2026-10-16', 'waiting'], ['2026-10-17', 'waiting'], ['2026-10-18', 'waiting'],
    ]);
    await challenges.pregenerate();
    const [today, tomorrow, after] = challenges.overview();
    expect(today).toMatchObject({ date: '2026-10-16', number: 1, current: true, status: 'ready', difficulty: 'NORMAL' });
    expect(today.puzzle).toMatchObject({ difficulty: 'NORMAL', minMoves: LEVEL.minMoves, variantOf: null });
    expect(today.puzzle!.generationMs).toBeGreaterThanOrEqual(0);
    expect(tomorrow).toMatchObject({ date: '2026-10-17', number: 2, current: false, status: 'ready' });
    // Generated 24 h before its release at noon
    expect(after).toMatchObject({ date: '2026-10-18', status: 'waiting', puzzle: null, generatesAt: paris('2026-10-17', '12:00') });
  });

  it('a variant says which level of the app it comes from, kept in the database', async () => {
    const db = openDatabase(':memory:');
    const generator: PuzzleGenerator = {
      ...fakeGenerator(null).generator,
      variants: async (_id, _d, count) => Array.from({ length: count }, () => ({ ...LEVEL, minMoves: 42 })),
    };
    const challenges = new Challenges(db, testConfig({ DIFFICULTY: 'MASTER', PREGENERATE_AHEAD: '1m' }), generator, () => paris('2026-10-16', '15:00'), silent);
    await challenges.pregenerate();
    const [today] = challenges.overview();
    expect(today.status).toBe('ready');
    expect(variantSources(sampleLevels, DIFFICULTY_LEVELS.MASTER).map(l => l.id)).toContain(today.puzzle!.variantOf);
    expect(challengesRow(db, '2026-10-16')).toMatchObject({ variant_of: today.puzzle!.variantOf, min_moves: 42 });
  });

  it('being generated, failed, or to generate again in a new difficulty', async () => {
    const db = openDatabase(':memory:');
    const clock = { now: paris('2026-10-16', '15:00') };
    await new Challenges(db, testConfig({ PREGENERATE_AHEAD: '24h' }), fakeGenerator().generator, () => clock.now, silent).pregenerate();

    // Every seed gives nothing, once the gate is open
    let open: () => void = () => {};
    const gate = new Promise<void>(resolve => { open = resolve; });
    const slow: PuzzleGenerator = { ...fakeGenerator().generator, generate: () => gate.then(() => null) };
    const challenges = new Challenges(db, testConfig({ PREGENERATE_AHEAD: '24h', DIFFICULTY: 'HARD' }), slow, () => clock.now, silent);
    // Released: kept in its difficulty; the next one: still the normal one, to generate again in hard
    expect(challenges.overview().slice(0, 2).map(c => [c.status, c.difficulty, c.puzzle?.difficulty])).toEqual([
      ['ready', 'NORMAL', 'NORMAL'], ['waiting', 'HARD', 'NORMAL'],
    ]);

    const job = challenges.ensure('2026-10-17');
    clock.now += 60_000;
    expect(challenges.overview()[1]).toMatchObject({ status: 'generating', generatingSince: paris('2026-10-16', '15:00') });
    open();
    expect(await job).toBeNull();
    expect(challenges.overview()[1]).toMatchObject({ status: 'failed', failedAt: clock.now, difficulty: 'HARD' });
  });
});
