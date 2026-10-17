import { randomBytes } from 'node:crypto';
import type { Database } from './db';
import type { Level } from './core';
import { DIFFICULTIES, type Difficulty } from './config';
import type { PuzzleGenerator } from './generation';

/**
 * Puzzles generated ahead for the duels: a duel takes one and starts at once, the pool
 * fills up again in the background. Kept in the database, so a restart keeps them.
 * A hard puzzle takes seconds to generate, a master one longer: fewer of those.
 */

export const POOL_SIZES: Record<Difficulty, number> = { EASY: 10, NORMAL: 10, HARD: 10, EXPERT: 10, MASTER: 3 };

/** Where a duel gets its puzzle */
export interface PuzzleSource {
  take(difficulty: Difficulty): Promise<Level | null>;
}

interface Logger { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void }

/** Tries of the generation of one puzzle (a seed may give nothing) */
const TRIES = 3;
/** Longest wait for one puzzle of the pool (its own worker is then stopped and started again) */
export const FILL_TIMEOUT_MS = 3 * 60_000;
/** A difficulty that took too long is left aside this long, the others fill up meanwhile */
export const GIVE_UP_MS = 60 * 60_000;

export interface PuzzlePoolOptions {
  db: Database;
  /** The generator of the server (daily challenges) */
  generator: PuzzleGenerator;
  /**
   * Fills the pool, and generates the puzzle of a duel when the pool has none: a worker
   * of its own, so that a master puzzle, which can take minutes, never holds up the
   * daily challenge. The generator by default.
   */
  fillGenerator?: PuzzleGenerator;
  log?: Logger;
  sizes?: Record<Difficulty, number>;
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
  private readonly sizes: Record<Difficulty, number>;
  private readonly now: () => number;
  private readonly fillTimeoutMs: number;
  /** Difficulties left aside after a generation too long, until then */
  private readonly givenUp = new Map<Difficulty, number>();

  constructor(options: PuzzlePoolOptions) {
    this.db = options.db;
    this.generator = options.generator;
    this.fillGenerator = options.fillGenerator ?? options.generator;
    this.log = options.log;
    this.sizes = options.sizes ?? POOL_SIZES;
    this.now = options.now ?? Date.now;
    this.fillTimeoutMs = options.fillTimeoutMs ?? FILL_TIMEOUT_MS;
  }

  /** Puzzles ready, by difficulty */
  counts(): Record<Difficulty, number> {
    const rows = this.db.prepare('SELECT difficulty, COUNT(*) AS n FROM puzzle_pool GROUP BY difficulty').all() as { difficulty: Difficulty; n: number }[];
    const counts = Object.fromEntries(Object.keys(this.sizes).map(d => [d, 0])) as Record<Difficulty, number>;
    for (const r of rows) counts[r.difficulty] = Number(r.n);
    return counts;
  }

  /** A puzzle of the pool (the oldest), or one generated now when there is none left (null: too long) */
  async take(difficulty: Difficulty): Promise<Level | null> {
    const row = this.db.prepare('SELECT id, level_json FROM puzzle_pool WHERE difficulty = ? ORDER BY id LIMIT 1').get(difficulty) as
      { id: number; level_json: string } | undefined;
    if (row) this.db.prepare('DELETE FROM puzzle_pool WHERE id = ?').run(row.id);
    // Once the puzzle is out of the pool, so that the refill sees it is missing
    if (this.started) void this.fill();
    if (row) return JSON.parse(row.level_json) as Level;
    // Just found too long to generate: no point waiting minutes again
    if (this.isAside(difficulty)) return null;
    const level = await this.generateForPool(difficulty);
    return level === 'timeout' ? null : level;
  }

  /** Difficulties left aside for now (too long to generate), with no puzzle ready: a duel of those cannot start */
  unavailable(): Difficulty[] {
    const counts = this.counts();
    return DIFFICULTIES.filter(d => counts[d] === 0 && this.isAside(d));
  }

  private isAside(difficulty: Difficulty): boolean {
    return (this.givenUp.get(difficulty) ?? 0) > this.now();
  }

  /** Fills the pool from now on, and again after each puzzle taken */
  start(): Promise<void> {
    this.started = true;
    return this.fill();
  }

  /**
   * No new puzzle (the server stops). The one being generated is not waited for (a
   * master one can take minutes): it is dropped when its worker is closed.
   */
  stop(): void {
    this.stopped = true;
  }

  /**
   * One puzzle at a time, the easiest difficulty not full first, until the pool is full:
   * the quick ones are ready at once, the long master ones come last.
   */
  fill(): Promise<void> {
    if (!this.filling) {
      const run = this.fillLoop();
      this.filling = run;
      // Cleared once over, even when there was nothing to do (over at once)
      void run.finally(() => { if (this.filling === run) this.filling = null; });
    }
    return this.filling;
  }

  private async fillLoop(): Promise<void> {
    let failures = 0;
    try {
      while (!this.stopped && failures < TRIES) {
        const counts = this.counts();
        const next = DIFFICULTIES.find(d => counts[d] < this.sizes[d] && !this.isAside(d));
        if (!next) return;
        const level = await this.generateForPool(next);
        if (this.stopped) return;
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
    } catch (err) {
      this.log?.error({ err }, 'duel puzzle pool not filled');
    }
  }

  /**
   * A puzzle for the pool. With a worker of its own, a generation too long (a master
   * puzzle can take many minutes) stops that worker: the next one starts afresh.
   */
  private async generateForPool(difficulty: Difficulty): Promise<Level | null | 'timeout'> {
    if (this.fillGenerator === this.generator) return this.generate(this.fillGenerator, difficulty);
    const cancel = { cancelled: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), this.fillTimeoutMs); });
    const result = await Promise.race([this.generate(this.fillGenerator, difficulty, cancel), timeout]);
    clearTimeout(timer);
    if (result === 'timeout') {
      // No other try behind our back, and the worker busy with it is stopped
      cancel.cancelled = true;
      this.givenUp.set(difficulty, this.now() + GIVE_UP_MS);
      await this.fillGenerator.close();
    }
    return result;
  }

  /** A random puzzle; a seed that gives nothing is replaced by another */
  private async generate(generator: PuzzleGenerator, difficulty: Difficulty, cancel = { cancelled: false }): Promise<Level | null> {
    for (let attempt = 0; attempt < TRIES && !this.stopped && !cancel.cancelled; attempt++) {
      try {
        const level = await generator.generate(`duel:${randomBytes(16).toString('hex')}`, difficulty, 'duel');
        if (level) return level;
      } catch (err) {
        // Stopped on purpose (too long, or the server stops): nothing wrong
        if (!cancel.cancelled && !this.stopped) this.log?.error({ err }, 'duel generation failed');
      }
    }
    return null;
  }
}
