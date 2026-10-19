import { createHash, randomBytes } from 'node:crypto';
import { getSetting, setSetting, type Database } from './db';
import { createPRNG, DIFFICULTY_LEVELS, dressVariant, sampleLevels, variantSources, type Level } from './core';
import { DIFFICULTIES, type Difficulty } from './config';
import type { PuzzleGenerator } from './generation';

/**
 * The puzzles of the duels, ready ahead so that a duel starts at once:
 * - puzzles generated from scratch, in the background (10 of each difficulty, 3 masters);
 * - for the hardest difficulties, a catalog of variants of the hard levels of the app
 *   (utils/variants.ts), prepared once: a master puzzle can take very long to generate.
 *   A variant played is marked; the least played levels come first, so that two duels
 *   in a row do not start from the same level.
 * All kept in the database: a restart keeps them.
 */

export const POOL_SIZES: Record<Difficulty, number> = { EASY: 10, NORMAL: 10, HARD: 10, EXPERT: 10, MASTER: 3 };
/** Difficulties with a catalog of variants, and how many variants of each level of the app it keeps */
export const VARIANTS_PER_LEVEL: Partial<Record<Difficulty, number>> = { EXPERT: 20, MASTER: 40 };
/** Bumped when the variants change: the catalog is prepared again */
const CATALOG_VERSION = 1;

/** Where a duel gets its puzzle */
export interface PuzzleSource {
  take(difficulty: Difficulty): Promise<Level | null>;
}

/** What the pool holds and does, for the admin */
export interface PoolOverview {
  difficulties: {
    difficulty: Difficulty;
    /** Puzzles from scratch kept ready (0: none generated ahead), how many by default, and how many are */
    size: number;
    defaultSize: number;
    ready: number;
    /** Variants of the catalog, and the ones not played yet; null without a catalog */
    catalog: { total: number; fresh: number } | null;
    /** Left aside after a generation too long, until then */
    asideUntil: number | null;
  }[];
  /** Being generated now (the pool and the catalog); null when all is ready */
  working: { difficulty: Difficulty; kind: 'scratch' | 'catalog'; since: number } | null;
  /** The puzzles from scratch, in the order the duels take them */
  puzzles: { id: number; difficulty: Difficulty; createdAt: number; level: Level }[];
}

interface Logger { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void }

/** Tries of the generation of one puzzle (a seed may give nothing) */
const TRIES = 3;
/**
 * Longest generation of one puzzle from scratch, in the background (its worker is then
 * stopped and started again): a master puzzle can take very long, nobody waits for it.
 */
export const FILL_TIMEOUT_MS = 60 * 60_000;
/** A difficulty that took too long is left aside this long, the others fill up meanwhile */
export const GIVE_UP_MS = 60 * 60_000;

export interface PuzzlePoolOptions {
  db: Database;
  /** The generator of the server (daily challenges): for the puzzle a duel needs now, when there is none ready */
  generator: PuzzleGenerator;
  /**
   * Fills the pool and prepares the catalog: a worker of its own, so that a long
   * generation never holds up the daily challenge. The generator by default.
   */
  fillGenerator?: PuzzleGenerator;
  log?: Logger;
  /** How many from scratch by difficulty; read again at each step (the admin changes them) */
  sizes?: Record<Difficulty, number> | (() => Record<Difficulty, number>);
  variantsPerLevel?: Partial<Record<Difficulty, number>>;
  /** The levels the variants come from: the levels of the app */
  levels?: readonly Level[];
  now?: () => number;
  /** FILL_TIMEOUT_MS; only with a fill generator of its own, which can be stopped */
  fillTimeoutMs?: number;
}

export class PuzzlePool implements PuzzleSource {
  private filling: Promise<void> | null = null;
  private started = false;
  private stopped = false;
  private readonly db: Database;
  private readonly generator: PuzzleGenerator;
  private readonly fillGenerator: PuzzleGenerator;
  private readonly log?: Logger;
  private readonly sizesOf: () => Record<Difficulty, number>;
  private readonly variantsPerLevel: Partial<Record<Difficulty, number>>;
  private readonly levels: readonly Level[];
  private readonly now: () => number;
  private readonly fillTimeoutMs: number;
  /** Difficulties left aside after a generation too long, until then */
  private readonly givenUp = new Map<Difficulty, number>();
  private working: PoolOverview['working'] = null;
  /** Stops the generation from scratch going on (it is no longer wanted) */
  private abortCurrent: (() => void) | null = null;
  /** Asked to fill while filling: once more after */
  private fillAgain = false;

  constructor(options: PuzzlePoolOptions) {
    this.db = options.db;
    this.generator = options.generator;
    this.fillGenerator = options.fillGenerator ?? options.generator;
    this.log = options.log;
    const sizes = options.sizes ?? POOL_SIZES;
    this.sizesOf = typeof sizes === 'function' ? sizes : () => sizes;
    this.variantsPerLevel = options.variantsPerLevel ?? VARIANTS_PER_LEVEL;
    this.levels = options.levels ?? sampleLevels;
    this.now = options.now ?? Date.now;
    this.fillTimeoutMs = options.fillTimeoutMs ?? FILL_TIMEOUT_MS;
  }

  private hasCatalog = (difficulty: Difficulty) => (this.variantsPerLevel[difficulty] ?? 0) > 0;

  /** Puzzles ready by difficulty: generated from scratch, and variants not played yet */
  counts(): Record<Difficulty, number> {
    const counts = Object.fromEntries(DIFFICULTIES.map(d => [d, 0])) as Record<Difficulty, number>;
    const add = (sql: string) => {
      for (const r of this.db.prepare(sql).all() as { difficulty: Difficulty; n: number }[]) counts[r.difficulty] += Number(r.n);
    };
    add('SELECT difficulty, COUNT(*) AS n FROM puzzle_pool GROUP BY difficulty');
    add('SELECT difficulty, COUNT(*) AS n FROM duel_variants WHERE used_at IS NULL GROUP BY difficulty');
    return counts;
  }

  /** Variants in the catalog, played or not, by difficulty */
  catalogSize(): Partial<Record<Difficulty, number>> {
    const rows = this.db.prepare('SELECT difficulty, COUNT(*) AS n FROM duel_variants GROUP BY difficulty').all() as { difficulty: Difficulty; n: number }[];
    return Object.fromEntries(rows.map(r => [r.difficulty, Number(r.n)]));
  }

  /** Everything the pool holds, for the admin panel */
  overview(): PoolOverview {
    const scratch = this.scratchCounts();
    const sizes = this.sizesOf();
    const catalog = Object.fromEntries((this.db.prepare(
      'SELECT difficulty, COUNT(*) AS n, SUM(used_at IS NULL) AS fresh FROM duel_variants GROUP BY difficulty',
    ).all() as { difficulty: Difficulty; n: number; fresh: number }[]).map(r => [r.difficulty, { total: Number(r.n), fresh: Number(r.fresh) }]));
    const rows = this.db.prepare('SELECT id, difficulty, level_json, created_at FROM puzzle_pool ORDER BY id').all() as
      { id: number; difficulty: Difficulty; level_json: string; created_at: number }[];
    return {
      difficulties: DIFFICULTIES.map(difficulty => ({
        difficulty,
        size: sizes[difficulty],
        defaultSize: POOL_SIZES[difficulty],
        ready: scratch[difficulty],
        catalog: this.hasCatalog(difficulty) ? catalog[difficulty] ?? { total: 0, fresh: 0 } : null,
        asideUntil: this.isAside(difficulty) ? this.givenUp.get(difficulty)! : null,
      })),
      working: this.working,
      puzzles: rows.map(r => ({
        id: Number(r.id), difficulty: r.difficulty, createdAt: Number(r.created_at), level: JSON.parse(r.level_json) as Level,
      })),
    };
  }

  /** Runs a generation, shown to the admin meanwhile */
  private async work<T>(difficulty: Difficulty, kind: 'scratch' | 'catalog', run: () => Promise<T>): Promise<T> {
    this.working = { difficulty, kind, since: this.now() };
    try {
      return await run();
    } finally {
      this.working = null;
    }
  }

  /**
   * The puzzle of a duel: one generated from scratch if there is one ready, else a
   * variant of the catalog, else one made now (null if it cannot be).
   */
  async take(difficulty: Difficulty): Promise<Level | null> {
    const row = this.db.prepare('SELECT id, level_json FROM puzzle_pool WHERE difficulty = ? ORDER BY id LIMIT 1').get(difficulty) as
      { id: number; level_json: string } | undefined;
    if (row) this.db.prepare('DELETE FROM puzzle_pool WHERE id = ?').run(row.id);
    // Once the puzzle is out of the pool, so that the refill sees it is missing
    if (this.started) void this.fill();
    if (row) return JSON.parse(row.level_json) as Level;
    if (this.hasCatalog(difficulty)) {
      const variant = this.takeVariant(difficulty);
      if (variant) return variant;
    }
    return this.makeNow(difficulty);
  }

  /**
   * A variant not played yet, of the level of the app played the least; once all are
   * played, the one played the longest ago. Turned and colored again each time.
   */
  private takeVariant(difficulty: Difficulty): Level | null {
    const fresh = this.db.prepare(`
      SELECT v.id, v.level_json FROM duel_variants v
      WHERE v.difficulty = ? AND v.used_at IS NULL
      ORDER BY (SELECT COUNT(*) FROM duel_variants u WHERE u.difficulty = v.difficulty AND u.source_id = v.source_id AND u.used_at IS NOT NULL), RANDOM()
      LIMIT 1
    `).get(difficulty) as { id: number; level_json: string } | undefined;
    const row = fresh ?? this.db.prepare('SELECT id, level_json FROM duel_variants WHERE difficulty = ? ORDER BY used_at, id LIMIT 1')
      .get(difficulty) as { id: number; level_json: string } | undefined;
    if (!row) return null;
    this.db.prepare('UPDATE duel_variants SET used_at = ? WHERE id = ?').run(this.now(), row.id);
    return dressVariant(JSON.parse(row.level_json) as Level, createPRNG(randomBytes(8).toString('hex')));
  }

  /** None ready: generated now, with the generator of the server (a variant for the hardest difficulties: seconds, not minutes) */
  private async makeNow(difficulty: Difficulty): Promise<Level | null> {
    if (!this.hasCatalog(difficulty)) return this.generate(this.generator, difficulty);
    const sources = variantSources(this.levels, DIFFICULTY_LEVELS[difficulty]);
    for (let attempt = 0; attempt < TRIES && sources.length > 0; attempt++) {
      const source = sources[Math.floor(Math.random() * sources.length)];
      try {
        const [level] = await this.generator.variants(source.id, difficulty, 1, randomBytes(8).toString('hex'));
        if (level) return level;
      } catch (err) {
        this.log?.error({ err }, 'duel variant failed');
      }
    }
    return null;
  }

  private isAside(difficulty: Difficulty): boolean {
    return (this.givenUp.get(difficulty) ?? 0) > this.now();
  }

  /** Fills the pool and prepares the catalog from now on, and refills after each puzzle taken */
  start(): Promise<void> {
    this.started = true;
    return this.fill();
  }

  /**
   * No new puzzle (the server stops). The one being generated is not waited for (a
   * master one can take very long): it is dropped when its worker is closed.
   */
  stop(): void {
    this.stopped = true;
  }

  /** One job at a time (single flight); asked meanwhile, once more after */
  fill(): Promise<void> {
    if (this.filling) {
      this.fillAgain = true;
      return this.filling;
    }
    const run = this.fillLoop();
    this.filling = run;
    // Cleared once over, even when there was nothing to do (over at once)
    void run.finally(() => {
      if (this.filling !== run) return;
      this.filling = null;
      if (this.fillAgain && !this.stopped) {
        this.fillAgain = false;
        void this.fill();
      }
    });
    return this.filling;
  }

  /**
   * The admin changed how many to keep: a generation no longer wanted stops (a master
   * one can hold the worker for an hour), and the pool fills up to the new sizes.
   */
  resized(): void {
    const working = this.working;
    if (working?.kind === 'scratch' && this.scratchCounts()[working.difficulty] >= this.sizesOf()[working.difficulty]) {
      this.abortCurrent?.();
    }
    if (this.started) void this.fill();
  }

  /**
   * The quick difficulties first (seconds), then the catalog of variants (a couple of
   * minutes, once), then the long ones from scratch (up to FILL_TIMEOUT_MS each).
   */
  private async fillLoop(): Promise<void> {
    try {
      await this.fillFromScratch(DIFFICULTIES.filter(d => !this.hasCatalog(d)));
      await this.prepareCatalog();
      await this.fillFromScratch(DIFFICULTIES.filter(d => this.hasCatalog(d)));
    } catch (err) {
      this.log?.error({ err }, 'duel puzzle pool not filled');
    }
  }

  /** One puzzle at a time, the easiest difficulty not full first, until they are full */
  private async fillFromScratch(difficulties: Difficulty[]): Promise<void> {
    let failures = 0;
    while (!this.stopped && failures < TRIES) {
      const counts = this.scratchCounts();
      const sizes = this.sizesOf();
      const next = difficulties.find(d => counts[d] < sizes[d] && !this.isAside(d));
      if (!next) return;
      const level = await this.work(next, 'scratch', () => this.generateForPool(next));
      if (this.stopped) return;
      // No longer wanted (the admin lowered its size meanwhile): not kept, nothing failed
      if (level === 'aborted') continue;
      if (level === 'timeout') {
        this.log?.info({ difficulty: next }, 'duel puzzle too long to generate: left aside for now');
        continue;
      }
      if (!level) {
        failures++;
        continue;
      }
      failures = 0;
      this.db.prepare('INSERT INTO puzzle_pool (difficulty, level_json, created_at) VALUES (?, ?, ?)')
        .run(next, JSON.stringify(level), this.now());
    }
  }

  private scratchCounts(): Record<Difficulty, number> {
    const counts = Object.fromEntries(DIFFICULTIES.map(d => [d, 0])) as Record<Difficulty, number>;
    for (const r of this.db.prepare('SELECT difficulty, COUNT(*) AS n FROM puzzle_pool GROUP BY difficulty').all() as { difficulty: Difficulty; n: number }[]) {
      counts[r.difficulty] = Number(r.n);
    }
    return counts;
  }

  /**
   * The variants of every hard level of the app, prepared once and kept: a level at a
   * time, so that a restart goes on where it stopped. Prepared again when the levels or
   * the way of making variants change.
   */
  private async prepareCatalog(): Promise<void> {
    // The hardest first: a master puzzle is the longest to generate from scratch
    for (const difficulty of DIFFICULTIES.filter(d => this.hasCatalog(d)).reverse()) {
      const perLevel = this.variantsPerLevel[difficulty]!;
      const sources = variantSources(this.levels, DIFFICULTY_LEVELS[difficulty]);
      const version = createHash('sha256')
        .update(JSON.stringify([CATALOG_VERSION, perLevel, sources.map(l => [l.id, l.minMoves, l.vehicles.length])]))
        .digest('hex');
      const key = `duel_variants_${difficulty}`;
      if (getSetting(this.db, key) !== version) {
        this.db.prepare('DELETE FROM duel_variants WHERE difficulty = ?').run(difficulty);
        setSetting(this.db, key, version);
      }
      const done = new Set((this.db.prepare('SELECT DISTINCT source_id AS id FROM duel_variants WHERE difficulty = ?').all(difficulty) as { id: number }[])
        .map(r => Number(r.id)));
      let added = 0;
      for (const source of sources) {
        if (this.stopped) return;
        if (done.has(source.id)) continue;
        const variants = await this.work(difficulty, 'catalog',
          () => this.fillGenerator.variants(source.id, difficulty, perLevel, randomBytes(8).toString('hex')));
        if (this.stopped) return;
        const insert = this.db.prepare('INSERT INTO duel_variants (difficulty, source_id, level_json) VALUES (?, ?, ?)');
        this.db.exec('BEGIN');
        try {
          for (const level of variants) insert.run(difficulty, source.id, JSON.stringify(level));
          this.db.exec('COMMIT');
        } catch (e) {
          this.db.exec('ROLLBACK');
          throw e;
        }
        added += variants.length;
      }
      if (added > 0) this.log?.info({ difficulty, added, total: this.catalogSize()[difficulty] ?? 0 }, 'duel variants prepared');
    }
  }

  /**
   * A puzzle from scratch for the pool. With a worker of its own, a generation too long
   * stops that worker: the next one starts afresh; so does one no longer wanted.
   */
  private async generateForPool(difficulty: Difficulty): Promise<Level | null | 'timeout' | 'aborted'> {
    const cancel = { cancelled: false };
    let abort: () => void = () => {};
    const aborted = new Promise<'aborted'>(resolve => { abort = () => resolve('aborted'); });
    this.abortCurrent = () => {
      cancel.cancelled = true;
      abort();
    };
    try {
      // The generator of the daily challenges cannot be stopped: its puzzle is only dropped
      if (this.fillGenerator === this.generator) {
        const level = await this.generate(this.fillGenerator, difficulty, cancel);
        return cancel.cancelled ? 'aborted' : level;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), this.fillTimeoutMs); });
      const result = await Promise.race([this.generate(this.fillGenerator, difficulty, cancel), timeout, aborted]);
      clearTimeout(timer);
      if (result === 'timeout' || result === 'aborted') {
        // No other try behind our back, and the worker busy with it is stopped
        cancel.cancelled = true;
        if (result === 'timeout') this.givenUp.set(difficulty, this.now() + GIVE_UP_MS);
        await this.fillGenerator.close();
      }
      return result;
    } finally {
      this.abortCurrent = null;
    }
  }

  /** A random puzzle from scratch; a seed that gives nothing is replaced by another */
  private async generate(generator: PuzzleGenerator, difficulty: Difficulty, cancel = { cancelled: false }): Promise<Level | null> {
    for (let attempt = 0; attempt < TRIES && !this.stopped && !cancel.cancelled; attempt++) {
      try {
        const level = await generator.generate(`duel:${randomBytes(16).toString('hex')}`, difficulty);
        if (level) return level;
      } catch (err) {
        // Stopped on purpose (too long, or the server stops): nothing wrong
        if (!cancel.cancelled && !this.stopped) this.log?.error({ err }, 'duel generation failed');
      }
    }
    return null;
  }
}
