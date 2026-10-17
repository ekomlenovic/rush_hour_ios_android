import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db';
import { GIVE_UP_MS, POOL_SIZES, PuzzlePool } from '../src/puzzlePool';
import { generatePuzzle } from '../src/generation';
import { DIFFICULTY_LEVELS, generateSeededLevelSync, levelVariant, MULTI_LEVEL_ID, sampleLevels } from '../src/core';
import type { PuzzleGenerator } from '../src/generation';
import { LEVEL, fakeGenerator } from './helpers';

const SMALL = { EASY: 2, NORMAL: 2, HARD: 1, EXPERT: 1, MASTER: 1 };

describe('pool of duel puzzles', () => {
  it('10 of each difficulty, 3 masters (they take long to generate)', () => {
    expect(POOL_SIZES).toEqual({ EASY: 10, NORMAL: 10, HARD: 10, EXPERT: 10, MASTER: 3 });
  });

  it('fills up one at a time, the easiest first: the long master ones come last', async () => {
    const fake = fakeGenerator();
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: fake.generator, sizes: SMALL });
    await pool.start();
    expect(pool.counts()).toEqual(SMALL);
    expect(fake.calls.map(c => c.difficulty)).toEqual(['EASY', 'EASY', 'NORMAL', 'NORMAL', 'HARD', 'EXPERT', 'MASTER']);
  });

  it('never uses the generator of the daily challenges when it has a worker of its own', async () => {
    const filler = fakeGenerator();
    const daily = fakeGenerator();
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: daily.generator, fillGenerator: filler.generator, sizes: SMALL });
    // Empty pool: the puzzle of the duel is generated now, on the worker of the pool
    expect(await pool.take('HARD')).toEqual(LEVEL);
    await pool.start();
    expect(filler.calls).toHaveLength(8);
    expect(daily.calls).toEqual([]);
  });

  it('a duel waits for its puzzle no longer than the time limit', async () => {
    const stuck: PuzzleGenerator = { generate: () => new Promise(() => {}), close: async () => {} };
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: fakeGenerator().generator, fillGenerator: stuck, sizes: SMALL, fillTimeoutMs: 20 });
    expect(await pool.take('MASTER')).toBeNull();
  });

  it('a duel takes a puzzle at once, and the pool fills up again', async () => {
    const fake = fakeGenerator();
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: fake.generator, sizes: SMALL });
    await pool.start();
    expect(await pool.take('HARD')).toEqual(LEVEL);
    // Taken from the pool, not generated: the generation that follows refills it
    await pool.fill();
    expect(pool.counts().HARD).toBe(1);
    expect(fake.calls).toHaveLength(8);
  });

  it('an empty pool generates the puzzle right away', async () => {
    const fake = fakeGenerator();
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: fake.generator, sizes: SMALL });
    expect(await pool.take('EXPERT')).toEqual(LEVEL);
    expect(fake.calls).toEqual([{ seed: expect.stringMatching(/^duel:[0-9a-f]{32}$/), difficulty: 'EXPERT', kind: 'duel' }]);
  });

  it('survives a restart: kept in the database', async () => {
    const db = openDatabase(':memory:');
    await new PuzzlePool({ db, generator: fakeGenerator().generator, sizes: SMALL }).start();
    const fake = fakeGenerator();
    const again = new PuzzlePool({ db, generator: fake.generator, sizes: SMALL });
    await again.start();
    expect(fake.calls).toEqual([]);
    expect(again.counts()).toEqual(SMALL);
  });

  it('a generator that gives nothing does not loop forever', async () => {
    const fake = fakeGenerator(null);
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: fake.generator, sizes: SMALL });
    await pool.start();
    expect(pool.counts()).toEqual({ EASY: 0, NORMAL: 0, HARD: 0, EXPERT: 0, MASTER: 0 });
    expect(await pool.take('EASY')).toBeNull();
  });

  it('a puzzle too long to generate is left aside: its worker is stopped, the others fill up', async () => {
    const clock = { now: 0 };
    let closed = 0;
    const asked: string[] = [];
    // MASTER never comes, until the worker is stopped; the others at once
    let stopWorker: (e: Error) => void = () => {};
    const filler: PuzzleGenerator = {
      generate: (_seed, difficulty) => {
        asked.push(difficulty);
        return difficulty === 'MASTER' ? new Promise((_, reject) => { stopWorker = reject; }) : Promise.resolve({ ...LEVEL });
      },
      close: async () => { closed++; stopWorker(new Error('generator closed')); },
    };
    const pool = new PuzzlePool({
      db: openDatabase(':memory:'), generator: fakeGenerator().generator, fillGenerator: filler,
      sizes: { ...SMALL, EASY: 3 }, fillTimeoutMs: 20, now: () => clock.now,
    });
    await pool.start();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(closed).toBe(1);
    // Asked once: no other try behind the back of the pool once stopped
    expect(asked.filter(d => d === 'MASTER')).toHaveLength(1);
    expect(pool.counts()).toEqual({ EASY: 3, NORMAL: 2, HARD: 1, EXPERT: 1, MASTER: 0 });
    expect(pool.unavailable()).toEqual(['MASTER']);
    // A master duel does not wait minutes for nothing
    expect(await pool.take('MASTER')).toBeNull();
    expect(asked.filter(d => d === 'MASTER')).toHaveLength(1);
    // A puzzle taken is generated again, master stays aside
    await pool.take('EASY');
    await pool.fill();
    expect(pool.counts().EASY).toBe(3);
    expect(closed).toBe(1);
    // Tried again later
    clock.now += GIVE_UP_MS + 1;
    expect(pool.unavailable()).toEqual([]);
    await pool.fill();
    expect(closed).toBe(2);
  });

  it('stops with the server', async () => {
    let release: () => void = () => {};
    const calls: string[] = [];
    const slow: PuzzleGenerator = {
      generate: (_seed, difficulty) => { calls.push(difficulty); return new Promise(resolve => { release = () => resolve({ ...LEVEL }); }); },
      close: async () => {},
    };
    const pool = new PuzzlePool({ db: openDatabase(':memory:'), generator: slow, sizes: SMALL });
    const filling = pool.start();
    // Not waiting for the puzzle being generated
    pool.stop();
    release();
    await filling;
    expect(calls).toHaveLength(1);
    expect(Object.values(pool.counts()).every(n => n === 0)).toBe(true);
  });

  it('the hardest duels are variants of the levels of the app: in a second, not minutes', () => {
    for (const difficulty of ['EXPERT', 'MASTER'] as const) {
      const start = Date.now();
      const level = generatePuzzle('duel:0123456789abcdef', difficulty, 'duel')!;
      expect(Date.now() - start).toBeLessThan(10_000);
      expect(level).toEqual(levelVariant(sampleLevels, 'duel:0123456789abcdef', MULTI_LEVEL_ID, DIFFICULTY_LEVELS[difficulty]));
      expect(level.minMoves).toBeGreaterThanOrEqual(DIFFICULTY_LEVELS[difficulty].minMovesRequired);
    }
    // A daily challenge is generated from scratch, as before
    expect(generatePuzzle('challenge', 'EASY')).toEqual({
      ...generateSeededLevelSync('challenge', MULTI_LEVEL_ID, DIFFICULTY_LEVELS.EASY), updatedAt: expect.any(Number),
    });
  });
});
