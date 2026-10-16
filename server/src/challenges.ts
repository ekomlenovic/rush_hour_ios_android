import type { Config, Difficulty } from './config';
import { getSetting, setSetting, type Database } from './db';
import type { PuzzleGenerator } from './generation';
import type { Level } from './core';
import { puzzleSeed } from './secrets';
import { addDays, closesAt, currentChallengeDate, daysBetween, releaseAt, weekday, type Schedule } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Each generation may fail (no puzzle hard enough): a few more seeds before giving up */
const GENERATION_TRIES = 5;

export interface ChallengeRow {
  date: string;
  difficulty: Difficulty;
  level_json: string;
  min_moves: number;
  generated_at: number;
}

interface Logger {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

/**
 * The daily challenges of the server: generated ahead of their release in the
 * background, so that nobody ever waits, and kept secret until a player starts one.
 */
export class Challenges {
  readonly schedule: Schedule;
  private inflight = new Map<string, Promise<ChallengeRow | null>>();
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<void> | null = null;

  constructor(
    private db: Database,
    private config: Config,
    private generator: PuzzleGenerator,
    private now: () => number,
    private log: Logger,
    /** Difficulty and replay retention: the environment, or what the admin set in the app (#50) */
    private settings: () => { difficultyByWeekday: Difficulty[]; replayRetentionDays: number } = () => config,
  ) {
    this.schedule = { timeZone: config.timeZone, releaseTime: config.releaseTime };
    if (!getSetting(db, 'first_date')) setSetting(db, 'first_date', this.currentDate());
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

  releaseAt(date: string): number {
    return releaseAt(date, this.schedule);
  }

  closesAt(date: string): number {
    return closesAt(date, this.schedule);
  }

  /** Last moment to finish a game of that day started in time */
  deadline(date: string): number {
    return this.closesAt(date) + this.config.gracePeriodMs;
  }

  get(date: string): ChallengeRow | undefined {
    return this.db.prepare('SELECT * FROM challenges WHERE date = ?').get(date) as ChallengeRow | undefined;
  }

  level(row: ChallengeRow): Level {
    return JSON.parse(row.level_json) as Level;
  }

  /**
   * The challenge of a date, generated if needed. Before its release, a puzzle whose
   * difficulty no longer matches the configuration is generated again; after it, never.
   */
  ensure(date: string): Promise<ChallengeRow | null> {
    const existing = this.get(date);
    const difficulty = this.difficultyFor(date);
    if (existing && (existing.difficulty === difficulty || this.now() >= this.releaseAt(date))) {
      return Promise.resolve(existing);
    }
    let job = this.inflight.get(date);
    if (!job) {
      job = this.generate(date, difficulty).finally(() => this.inflight.delete(date));
      this.inflight.set(date, job);
    }
    return job;
  }

  isGenerating(date: string): boolean {
    return this.inflight.has(date);
  }

  private async generate(date: string, difficulty: Difficulty): Promise<ChallengeRow | null> {
    const started = Date.now();
    for (let attempt = 0; attempt < GENERATION_TRIES; attempt++) {
      const seed = puzzleSeed(this.config.serverSecret, date, difficulty) + (attempt ? `:${attempt}` : '');
      const level = await this.generator.generate(seed, difficulty);
      if (!level) continue;
      const row: ChallengeRow = {
        date, difficulty, level_json: JSON.stringify(level), min_moves: level.minMoves, generated_at: this.now(),
      };
      this.db.prepare(`
        INSERT INTO challenges (date, difficulty, level_json, min_moves, generated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET difficulty = excluded.difficulty, level_json = excluded.level_json,
          min_moves = excluded.min_moves, generated_at = excluded.generated_at
      `).run(row.date, row.difficulty, row.level_json, row.min_moves, row.generated_at);
      this.log.info({ date, difficulty, minMoves: level.minMoves, ms: Date.now() - started }, 'challenge generated');
      return row;
    }
    this.log.error({ date, difficulty }, 'challenge generation failed');
    return null;
  }

  /** Generates the current challenge and every one coming out within PREGENERATE_AHEAD */
  async pregenerate(): Promise<void> {
    let date = this.currentDate();
    await this.ensure(date);
    for (let i = 0; i < 31; i++) {
      date = addDays(date, 1);
      if (this.releaseAt(date) - this.config.pregenerateAheadMs > this.now()) break;
      await this.ensure(date);
    }
  }

  /** Forgets the moves of games older than REPLAY_RETENTION_DAYS; the scores stay */
  purgeReplays(): number {
    const before = this.now() - this.settings().replayRetentionDays * DAY_MS;
    const result = this.db.prepare('UPDATE attempts SET moves_json = NULL WHERE moves_json IS NOT NULL AND finished_at < ?').run(before);
    return Number(result.changes);
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
