import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { openDatabase, setSetting } from '../src/db';
import { GIVE_UP_MS, POOL_SIZES, PuzzlePool, VARIANTS_PER_LEVEL } from '../src/puzzlePool';
import { generateVariants, type PuzzleGenerator } from '../src/generation';
import { DIFFICULTY_LEVELS, sampleLevels, variantSources } from '../src/core';
import { LEVEL, fakeGenerator } from './helpers';

const SMALL = { EASY: 2, NORMAL: 2, HARD: 1, EXPERT: 1, MASTER: 1 };
/** Two hard levels of the app for each difficulty with variants (none in both ranges), 3 variants each */
const LEVELS = [
  ...sampleLevels.filter(l => l.minMoves > 50).slice(0, 2),
  ...sampleLevels.filter(l => l.minMoves >= 25 && l.minMoves < 40).slice(0, 2),
];
const PER_LEVEL = { EXPERT: 3, MASTER: 3 };

const pool = (options: Partial<ConstructorParameters<typeof PuzzlePool>[0]> = {}) => {
  const fake = fakeGenerator();
  const db = openDatabase(':memory:');
  return { fake, db, pool: new PuzzlePool({ db, generator: fake.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS, ...options }) };
};

describe('puzzles of the duels', () => {
  it('10 of each difficulty from scratch, 3 masters; a catalog of variants for expert and master', () => {
    expect(POOL_SIZES).toEqual({ EASY: 10, NORMAL: 10, HARD: 10, EXPERT: 10, MASTER: 3 });
    expect(VARIANTS_PER_LEVEL).toEqual({ EXPERT: 20, MASTER: 40 });
  });

  it('the quick difficulties first, then the catalog, then the long ones from scratch', async () => {
    const { fake, pool: p } = pool();
    await p.start();
    expect(fake.calls.map(c => c.kind ?? c.difficulty)).toEqual([
      'EASY', 'EASY', 'NORMAL', 'NORMAL', 'HARD', 'variants', 'variants', 'variants', 'variants', 'EXPERT', 'MASTER',
    ]);
    expect(p.catalogSize()).toEqual({ EXPERT: 6, MASTER: 6 });
    // From scratch and variants not played yet
    expect(p.counts()).toEqual({ EASY: 2, NORMAL: 2, HARD: 1, EXPERT: 7, MASTER: 7 });
  });

  it('a puzzle from scratch first, then the variants: each one played once, the least played level first', async () => {
    const { db, pool: p } = pool({ sizes: { ...SMALL, MASTER: 0 } });
    await p.start();
    const playedBySource = () => (db.prepare(`
      SELECT source_id, COUNT(*) AS n FROM duel_variants WHERE difficulty = 'MASTER' AND used_at IS NOT NULL GROUP BY source_id
    `).all() as { n: number }[]).map(r => Number(r.n));
    for (let i = 1; i <= 6; i++) {
      expect(await p.take('MASTER')).toBeTruthy();
      // The levels are played in turn: never one ahead of the other by more than one
      const played = playedBySource();
      expect(played.reduce((a, b) => a + b, 0)).toBe(i);
      expect(Math.max(...played) - (played.length < 2 ? 0 : Math.min(...played))).toBeLessThanOrEqual(1);
    }
    expect((db.prepare('SELECT COUNT(*) AS n FROM duel_variants WHERE used_at IS NULL').get() as { n: number }).n).toBe(6);
    expect(p.counts().MASTER).toBe(0);
    // All played: the one played the longest ago comes back (turned and colored again)
    expect(await p.take('MASTER')).toBeTruthy();
  });

  it('a variant comes back turned and colored again', async () => {
    const db = openDatabase(':memory:');
    const p = new PuzzlePool({
      db, generator: { ...fakeGenerator().generator, variants: async (id, d, count, seed) => generateVariants(id, d, count, seed) },
      sizes: { ...SMALL, MASTER: 0 }, variantsPerLevel: { MASTER: 1 }, levels: LEVELS.slice(0, 1),
    });
    await p.start();
    const looks = new Set<string>();
    for (let i = 0; i < 8; i++) looks.add(JSON.stringify((await p.take('MASTER'))!.vehicles));
    expect(looks.size).toBeGreaterThan(1);
  });

  it('the catalog is kept, a level that leaves loses its variants; a restart goes on', async () => {
    const db = openDatabase(':memory:');
    await new PuzzlePool({ db, generator: fakeGenerator().generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS }).start();
    const again = fakeGenerator();
    await new PuzzlePool({ db, generator: again.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS }).start();
    expect(again.calls).toEqual([]);
    // A master level left: only its variants go, the others stay
    const other = fakeGenerator();
    const p = new PuzzlePool({ db, generator: other.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS.slice(1) });
    await p.start();
    expect(other.calls.filter(c => c.kind === 'variants')).toEqual([]);
    expect(p.catalogSize()).toEqual({ EXPERT: 6, MASTER: 3 });
  });

  it('levels added at the end of the campaign: only their variants are prepared, the marks stay', async () => {
    const db = openDatabase(':memory:');
    await new PuzzlePool({ db, generator: fakeGenerator().generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS.slice(0, 1) }).start();
    db.prepare('UPDATE duel_variants SET used_at = 1').run();
    const more = fakeGenerator();
    const p = new PuzzlePool({ db, generator: more.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS });
    await p.start();
    expect(more.calls.filter(c => c.kind === 'variants').map(c => c.seed).sort())
      .toEqual(LEVELS.slice(1).map(l => `variants:${l.id}`).sort());
    expect(db.prepare('SELECT COUNT(*) AS n FROM duel_variants WHERE used_at = 1').get()).toEqual({ n: 3 });
  });

  it('a level that changes, or a new way of making variants: prepared again', async () => {
    const db = openDatabase(':memory:');
    await new PuzzlePool({ db, generator: fakeGenerator().generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS }).start();
    const changed = [{ ...LEVELS[0], minMoves: LEVELS[0].minMoves + 1 }, ...LEVELS.slice(1)];
    const other = fakeGenerator();
    await new PuzzlePool({ db, generator: other.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: changed }).start();
    expect(other.calls.filter(c => c.kind === 'variants').map(c => c.seed)).toEqual([`variants:${LEVELS[0].id}`]);
    const fewer = fakeGenerator();
    await new PuzzlePool({ db, generator: fewer.generator, sizes: SMALL, variantsPerLevel: { ...PER_LEVEL, MASTER: 2 }, levels: changed }).start();
    expect(fewer.calls.filter(c => c.kind === 'variants' && c.difficulty === 'MASTER')).toHaveLength(2);
  });

  it('a catalog of the previous version (a hash of all its levels) is kept', async () => {
    const db = openDatabase(':memory:');
    await new PuzzlePool({ db, generator: fakeGenerator().generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS }).start();
    // The setting as the previous version wrote it
    for (const [difficulty, perLevel] of Object.entries(PER_LEVEL)) {
      const sources = variantSources(LEVELS, DIFFICULTY_LEVELS[difficulty]);
      const hash = createHash('sha256')
        .update(JSON.stringify([1, perLevel, sources.map(l => [l.id, l.minMoves, l.vehicles.length])]))
        .digest('hex');
      setSetting(db, `duel_variants_${difficulty}`, hash);
    }
    const again = fakeGenerator();
    const p = new PuzzlePool({ db, generator: again.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS });
    await p.start();
    expect(again.calls.filter(c => c.kind === 'variants')).toEqual([]);
    expect(p.catalogSize()).toEqual({ EXPERT: 6, MASTER: 6 });
  });

  it('a duel takes a puzzle at once, and the pool fills up again', async () => {
    const { fake, pool: p } = pool();
    await p.start();
    expect(await p.take('HARD')).toEqual(LEVEL);
    await p.fill();
    expect(p.counts().HARD).toBe(1);
    expect(fake.calls.filter(c => c.difficulty === 'HARD' && !c.kind)).toHaveLength(2);
  });

  it('nothing ready: made now, a variant for the hardest difficulties (seconds, not minutes)', async () => {
    const { fake, pool: p } = pool();
    expect(await p.take('EASY')).toEqual(LEVEL);
    expect(await p.take('MASTER')).toEqual(LEVEL);
    expect(fake.calls.map(c => c.kind ?? c.difficulty)).toEqual(['EASY', 'variants']);
  });

  it('never uses the generator of the daily challenges to fill, with a worker of its own', async () => {
    const filler = fakeGenerator();
    const daily = fakeGenerator();
    const db = openDatabase(':memory:');
    const p = new PuzzlePool({ db, generator: daily.generator, fillGenerator: filler.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS });
    await p.start();
    expect(filler.calls.length).toBeGreaterThan(0);
    expect(daily.calls).toEqual([]);
  });

  it('a puzzle from scratch too long is left aside: its worker is stopped, the others fill up', async () => {
    const clock = { now: 0 };
    let closed = 0;
    const asked: string[] = [];
    let stopWorker: (e: Error) => void = () => {};
    const filler: PuzzleGenerator = {
      generate: (_seed, difficulty) => {
        asked.push(difficulty);
        return difficulty === 'MASTER' ? new Promise((_, reject) => { stopWorker = reject; }) : Promise.resolve({ ...LEVEL });
      },
      variants: async () => [],
      close: async () => { closed++; stopWorker(new Error('generator closed')); },
    };
    const p = new PuzzlePool({
      db: openDatabase(':memory:'), generator: fakeGenerator().generator, fillGenerator: filler,
      sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS, fillTimeoutMs: 20, now: () => clock.now,
    });
    await p.start();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(closed).toBe(1);
    // Asked once: no other try behind the back of the pool once stopped
    expect(asked.filter(d => d === 'MASTER')).toHaveLength(1);
    expect(p.counts()).toEqual({ EASY: 2, NORMAL: 2, HARD: 1, EXPERT: 1, MASTER: 0 });
    // Taken: generated again, master stays aside
    await p.take('EASY');
    await p.fill();
    expect(p.counts().EASY).toBe(2);
    expect(closed).toBe(1);
    // Tried again later
    clock.now += GIVE_UP_MS + 1;
    await p.fill();
    expect(closed).toBe(2);
  });

  it('a generator that gives nothing does not loop forever', async () => {
    const fake = fakeGenerator(null);
    const p = new PuzzlePool({ db: openDatabase(':memory:'), generator: fake.generator, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS });
    await p.start();
    expect(p.counts()).toEqual({ EASY: 0, NORMAL: 0, HARD: 0, EXPERT: 0, MASTER: 0 });
    expect(await p.take('EASY')).toBeNull();
  });

  it('stops with the server, without waiting for the puzzle being generated', async () => {
    let release: () => void = () => {};
    const calls: string[] = [];
    const slow: PuzzleGenerator = {
      generate: (_seed, difficulty) => { calls.push(difficulty); return new Promise(resolve => { release = () => resolve({ ...LEVEL }); }); },
      variants: async () => [],
      close: async () => {},
    };
    const p = new PuzzlePool({ db: openDatabase(':memory:'), generator: slow, sizes: SMALL, variantsPerLevel: PER_LEVEL, levels: LEVELS });
    const filling = p.start();
    p.stop();
    release();
    await filling;
    expect(calls).toHaveLength(1);
    expect(Object.values(p.counts()).every(n => n === 0)).toBe(true);
  });

  it('real variants of the levels of the app: exact optimum, in range', () => {
    const [source] = variantSources(sampleLevels, DIFFICULTY_LEVELS.MASTER);
    const variants = generateVariants(source.id, 'MASTER', 5, 'seed');
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      expect(v.minMoves).toBeGreaterThanOrEqual(Math.max(40, source.minMoves - 2));
      expect(v.minMoves).toBeLessThanOrEqual(80);
    }
  });
});
