import type { Config, Difficulty } from './config';
import { getSetting, setSetting, type Database } from './db';
import type { PuzzleGenerator } from './generation';
import { createPRNG, DIFFICULTY_LEVELS, sampleLevels, variantSources, type Level } from './core';
import { VARIANTS_PER_LEVEL } from './puzzlePool';
import { puzzleSeed } from './secrets';
import { addDays, closesAt, currentChallengeDate, daysBetween, releaseAt, weekday, type ReleaseChange, type Schedule } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Each generation may fail (no puzzle hard enough): a few more seeds before giving up */
const GENERATION_TRIES = 5;
/** An exact optimum asked for is found on one board in a few, near the top of its difficulty: more seeds */
const EXACT_TRIES = 20;
/**
 * Longest generation from scratch of a challenge of a difficulty with variants (a master
 * one can take very long): beyond, or once its release has come, a variant instead.
 */
export const SCRATCH_TIMEOUT_MS = 60 * 60_000;

export interface ChallengeRow {
  date: string;
  difficulty: Difficulty;
  level_json: string;
  min_moves: number;
  generated_at: number;
  /** The level of the app it is a variant of; null: generated from scratch */
  variant_of: number | null;
  /** How long its generation took; null: not known (generated before it was kept) */
  generation_ms: number | null;
  /** The optimum the admin asked for when it was generated; null: none, the usual one of its difficulty */
  wanted_moves: number | null;
}

/** A daily challenge as the admin sees it: the current one and the next ones */
export interface ChallengeOverview {
  date: string;
  number: number;
  /** Its difficulty: the one configured until its release, then the one it came out with */
  difficulty: Difficulty;
  /** The optimum asked for, like the difficulty; null: the usual one of the difficulty */
  wantedMoves: number | null;
  releaseAt: number;
  /** Being played now */
  current: boolean;
  /**
   * ready: generated (in its difficulty); generating: being generated now; failed: the last
   * generation gave nothing, tried again each minute; waiting: generated later, from generatesAt
   */
  status: 'ready' | 'generating' | 'failed' | 'waiting';
  /** When the background work generates it (PREGENERATE_AHEAD before its release) */
  generatesAt: number;
  generatingSince: number | null;
  failedAt: number | null;
  /** The puzzle generated; in another difficulty when it changed since, generated again before its release */
  puzzle: {
    difficulty: Difficulty;
    /** The optimum asked for when it was generated: not found when minMoves differs */
    wantedMoves: number | null;
    minMoves: number;
    variantOf: number | null;
    generationMs: number | null;
    generatedAt: number;
    level: Level;
  } | null;
}

/** What the admin can change in the app (#50); the environment until then */
export interface ChallengeSettings {
  difficultyByWeekday: Difficulty[];
  /** Exact optimum of each day of the week, 0 = Sunday; null (or missing): the usual one of the difficulty */
  minMovesByWeekday?: (number | null)[];
  replayRetentionDays: number;
  gracePeriodMs: number;
  pregenerateAheadMs: number;
  releaseChanges?: ReleaseChange[];
}

interface Logger {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

export interface ChallengesOptions {
  /** SCRATCH_TIMEOUT_MS */
  scratchTimeoutMs?: number;
  /** The levels the variants come from: the levels of the app */
  levels?: readonly Level[];
}

/**
 * The daily challenges of the server: generated ahead of their release in the
 * background, so that nobody ever waits, and kept secret until a player starts one.
 * For the hardest difficulties (those of the duels with a catalog), a generation from
 * scratch that fails or takes too long gives way to a variant of a hard level of the
 * app (utils/variants.ts), from the same secret seed: seconds, not minutes.
 */
export class Challenges {
  private inflight = new Map<string, Promise<ChallengeRow | null>>();
  /** Since when a date is being generated, and when its last generation failed */
  private generatingSince = new Map<string, number>();
  private failedAt = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<void> | null = null;

  constructor(
    private db: Database,
    private config: Config,
    private generator: PuzzleGenerator,
    private now: () => number,
    private log: Logger,
    private settings: () => ChallengeSettings = () => config,
    private options: ChallengesOptions = {},
  ) {
    if (!getSetting(db, 'first_date')) setSetting(db, 'first_date', this.currentDate());
  }

  get schedule(): Schedule {
    return { timeZone: this.config.timeZone, releaseTime: this.config.releaseTime, changes: this.settings().releaseChanges };
  }

  currentDate(): string {
    return currentChallengeDate(this.now(), this.schedule);
  }

  /** Challenge #1 is the one being played when the server first started */
  number(date: string): number {
    return daysBetween(getSetting(this.db, 'first_date')!, date) + 1;
  }

  difficultyFor(date: string): Difficulty {
    return this.settings().difficultyByWeekday[weekday(date)];
  }

  wantedMovesFor(date: string): number | null {
    return this.settings().minMovesByWeekday?.[weekday(date)] ?? null;
  }

  releaseAt(date: string): number {
    return releaseAt(date, this.schedule);
  }

  closesAt(date: string): number {
    return closesAt(date, this.schedule);
  }

  /** Last moment to finish a game of that day started in time */
  deadline(date: string): number {
    return this.closesAt(date) + this.settings().gracePeriodMs;
  }

  get(date: string): ChallengeRow | undefined {
    return this.db.prepare('SELECT * FROM challenges WHERE date = ?').get(date) as ChallengeRow | undefined;
  }

  level(row: ChallengeRow): Level {
    return JSON.parse(row.level_json) as Level;
  }

  /**
   * The challenge of a date, generated if needed. Before its release, a puzzle whose
   * difficulty or optimum asked for no longer matches the configuration is generated again; after it, never.
   */
  ensure(date: string): Promise<ChallengeRow | null> {
    const existing = this.get(date);
    const difficulty = this.difficultyFor(date);
    const wanted = this.wantedMovesFor(date);
    if (existing && (this.matches(existing, difficulty, wanted) || this.now() >= this.releaseAt(date))) {
      return Promise.resolve(existing);
    }
    let job = this.inflight.get(date);
    if (!job) {
      this.generatingSince.set(date, this.now());
      job = this.generate(date, difficulty, wanted)
        .then(
          (row) => {
            if (row) this.failedAt.delete(date);
            else this.failedAt.set(date, this.now());
            return row;
          },
          (err: unknown) => {
            this.failedAt.set(date, this.now());
            throw err;
          },
        )
        .finally(() => {
          this.inflight.delete(date);
          this.generatingSince.delete(date);
        });
      this.inflight.set(date, job);
    }
    return job;
  }

  isGenerating(date: string): boolean {
    return this.inflight.has(date);
  }

  private hasVariants = (difficulty: Difficulty) => (VARIANTS_PER_LEVEL[difficulty] ?? 0) > 0;

  /** Generated for this configuration (a puzzle whose optimum asked for was not found too: it is not looked for again) */
  private matches = (row: ChallengeRow, difficulty: Difficulty, wanted: number | null) =>
    row.difficulty === difficulty && (row.wanted_moves ?? null) === wanted;

  /** The puzzle already out, if the release came while generating: it is being played, it never changes */
  private released(date: string): ChallengeRow | undefined {
    const row = this.get(date);
    return row && this.now() >= this.releaseAt(date) ? row : undefined;
  }

  /**
   * With an optimum asked for, a puzzle of exactly that optimum first; none found, the usual
   * puzzle of the difficulty, so that the challenge comes out anyway (the admin sees it).
   */
  private async generate(date: string, difficulty: Difficulty, wanted: number | null): Promise<ChallengeRow | null> {
    const started = Date.now();
    let found = wanted !== null ? await this.search(date, difficulty, started, wanted) : null;
    if (!found && wanted !== null) this.log.info({ date, difficulty, wanted }, 'no challenge with exactly this optimum: the usual one');
    found ??= await this.search(date, difficulty, started);
    if (!found) {
      this.log.error({ date, difficulty }, 'challenge generation failed');
      return null;
    }
    if ('released' in found) return found.released;
    return this.save(date, difficulty, wanted, found.level, found.variantOf, Date.now() - started);
  }

  /** A puzzle for a date (of exactly `minMoves` if given), or the one already out if the release came meanwhile */
  private async search(
    date: string, difficulty: Difficulty, started: number, minMoves?: number,
  ): Promise<{ level: Level; variantOf: number | null } | { released: ChallengeRow } | null> {
    const seed = puzzleSeed(this.config.serverSecret, date, difficulty);
    const withVariants = this.hasVariants(difficulty);
    // From scratch until the release at the latest: needed now, a variant at once
    const endAt = withVariants
      ? started + Math.min(this.options.scratchTimeoutMs ?? SCRATCH_TIMEOUT_MS, this.releaseAt(date) - this.now())
      : Infinity;
    const tries = minMoves === undefined ? GENERATION_TRIES : EXACT_TRIES;
    for (let attempt = 0; attempt < tries; attempt++) {
      const level = await this.fromScratch(seed + (attempt ? `:${attempt}` : ''), difficulty, endAt - Date.now(), minMoves);
      const released = this.released(date);
      if (released) return { released };
      if (level === 'timeout') break;
      if (level) return { level, variantOf: null };
    }
    if (withVariants) {
      for (let attempt = 0; attempt < GENERATION_TRIES; attempt++) {
        const variant = await this.variant(`${seed}:variant:${attempt}`, difficulty, minMoves);
        const released = this.released(date);
        if (released) return { released };
        if (variant) return { level: variant.level, variantOf: variant.sourceId };
      }
    }
    return null;
  }

  /**
   * A puzzle from scratch, given up after `timeoutMs`: the generator is then closed, so
   * that its worker stops (the next job starts a new one).
   */
  private async fromScratch(seed: string, difficulty: Difficulty, timeoutMs: number, minMoves?: number): Promise<Level | null | 'timeout'> {
    if (timeoutMs === Infinity) return this.generator.generate(seed, difficulty, minMoves);
    if (timeoutMs <= 0) return 'timeout';
    const job = this.generator.generate(seed, difficulty, minMoves);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
    const result = await Promise.race([job, timeout]);
    clearTimeout(timer);
    if (result === 'timeout') {
      // Rejected once its worker is stopped: nothing wrong
      job.catch(() => {});
      this.log.info({ difficulty }, 'challenge too long to generate: a variant instead');
      await this.generator.close();
    }
    return result;
  }

  /**
   * A variant of a hard level of the app, the level and the start drawn from the seed. Of exactly
   * `minMoves`: from a level at least that long if there is one (its solution goes through such a position)
   */
  private async variant(seed: string, difficulty: Difficulty, minMoves?: number): Promise<{ level: Level; sourceId: number } | null> {
    const all = variantSources(this.options.levels ?? sampleLevels, DIFFICULTY_LEVELS[difficulty]);
    const longEnough = minMoves === undefined ? all : all.filter(l => l.minMoves >= minMoves);
    const sources = longEnough.length ? longEnough : all;
    if (sources.length === 0) return null;
    const source = sources[Math.floor(createPRNG(seed)() * sources.length)];
    try {
      const [level] = await this.generator.variants(source.id, difficulty, 1, seed, minMoves);
      return level ? { level, sourceId: source.id } : null;
    } catch (err) {
      this.log.error({ err }, 'challenge variant failed');
      return null;
    }
  }

  private save(date: string, difficulty: Difficulty, wanted: number | null, level: Level, variantOf: number | null, ms: number): ChallengeRow {
    const row: ChallengeRow = {
      date, difficulty, level_json: JSON.stringify(level), min_moves: level.minMoves, generated_at: this.now(),
      variant_of: variantOf, generation_ms: ms, wanted_moves: wanted,
    };
    this.db.prepare(`
      INSERT INTO challenges (date, difficulty, level_json, min_moves, generated_at, variant_of, generation_ms, wanted_moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET difficulty = excluded.difficulty, level_json = excluded.level_json,
        min_moves = excluded.min_moves, generated_at = excluded.generated_at,
        variant_of = excluded.variant_of, generation_ms = excluded.generation_ms, wanted_moves = excluded.wanted_moves
    `).run(row.date, row.difficulty, row.level_json, row.min_moves, row.generated_at, row.variant_of, row.generation_ms, row.wanted_moves);
    this.log.info({ date, difficulty, minMoves: level.minMoves, wanted: wanted ?? undefined, variantOf: variantOf ?? undefined, ms }, 'challenge generated');
    return row;
  }

  /**
   * The current challenge and the next ones: those generated ahead (PREGENERATE_AHEAD),
   * and the first one after them, generated later
   */
  overview(): ChallengeOverview[] {
    const current = this.currentDate();
    const ahead = this.settings().pregenerateAheadMs;
    const list: ChallengeOverview[] = [];
    let date = current;
    for (let i = 0; i < 32; i++) {
      const releaseAt = this.releaseAt(date);
      const generatesAt = releaseAt - ahead;
      const row = this.get(date);
      const released = this.now() >= releaseAt;
      const difficulty = released && row ? row.difficulty : this.difficultyFor(date);
      const wantedMoves = released && row ? row.wanted_moves ?? null : this.wantedMovesFor(date);
      const generatingSince = this.generatingSince.get(date) ?? null;
      const failedAt = this.failedAt.get(date) ?? null;
      list.push({
        date,
        number: this.number(date),
        difficulty,
        wantedMoves,
        releaseAt,
        current: date === current,
        status: generatingSince !== null ? 'generating'
          : row && this.matches(row, difficulty, wantedMoves) ? 'ready'
          : failedAt !== null ? 'failed'
          : 'waiting',
        generatesAt,
        generatingSince,
        failedAt,
        puzzle: row ? {
          difficulty: row.difficulty,
          wantedMoves: row.wanted_moves ?? null,
          minMoves: row.min_moves,
          variantOf: row.variant_of,
          generationMs: row.generation_ms,
          generatedAt: row.generated_at,
          level: this.level(row),
        } : null,
      });
      // The first one generated later closes the list
      if (generatesAt > this.now()) break;
      date = addDays(date, 1);
    }
    return list;
  }

  /** Generates the current challenge and every one coming out within PREGENERATE_AHEAD */
  async pregenerate(): Promise<void> {
    let date = this.currentDate();
    await this.ensure(date);
    const ahead = this.settings().pregenerateAheadMs;
    for (let i = 0; i < 31; i++) {
      date = addDays(date, 1);
      if (this.releaseAt(date) - ahead > this.now()) break;
      await this.ensure(date);
    }
  }

  /** Forgets the moves of games and duels older than REPLAY_RETENTION_DAYS; the scores stay */
  purgeReplays(): number {
    const before = this.now() - this.settings().replayRetentionDays * DAY_MS;
    const games = this.db.prepare('UPDATE attempts SET moves_json = NULL WHERE moves_json IS NOT NULL AND finished_at < ?').run(before);
    const duels = this.db.prepare('UPDATE duels SET moves1_json = NULL, moves2_json = NULL WHERE moves1_json IS NOT NULL AND ended_at < ?').run(before);
    return Number(games.changes) + Number(duels.changes);
  }

  /** One pass of the background work */
  tick(): Promise<void> {
    this.ticking ??= (async () => {
      try {
        await this.pregenerate();
        const purged = this.purgeReplays();
        if (purged) this.log.info({ purged }, 'old replays deleted');
      } catch (e) {
        this.log.error({ err: e }, 'background work failed');
      } finally {
        this.ticking = null;
      }
    })();
    return this.ticking;
  }

  /** Background work every minute, starting now */
  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.ticking;
    await Promise.allSettled(this.inflight.values());
  }
}
