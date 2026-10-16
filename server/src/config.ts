import { isValidTimeZone } from './time';

export const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export interface Config {
  serverName: string;
  /** Seeds the puzzles: whoever knows it can compute them in advance */
  serverSecret: string;
  adminToken: string;
  /** From the environment; empty → generated once and stored in the database */
  inviteCode: string;
  timeZone: string;
  /** 'HH:MM' in timeZone */
  releaseTime: string;
  /** How long before its release a puzzle is generated, in ms */
  pregenerateAheadMs: number;
  /** Difficulty of each day of the week, 0 = Sunday */
  difficultyByWeekday: Difficulty[];
  /** How long after the release of the next challenge a game started before it can still be finished, in ms */
  gracePeriodMs: number;
  /** How long the moves of a game are kept for its replay, in days */
  replayRetentionDays: number;
  port: number;
  host: string;
  dataDir: string;
  /** Proxies whose X-Forwarded-For is trusted (nginx in front), see Fastify trustProxy */
  trustProxy: string | boolean;
}

export class ConfigError extends Error {}

/** '48h', '30m', '90s', '2d' → ms */
export function parseDuration(value: string, name: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new ConfigError(`${name}: invalid duration "${value}" (examples: 30m, 1h, 48h, 2d)`);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}

/** 'NORMAL,MONDAY=HARD' → a difficulty for each day of the week */
export function parseDifficulty(value: string): Difficulty[] {
  const days: Difficulty[] = Array(7).fill('NORMAL');
  const overrides: [number, Difficulty][] = [];
  let base: Difficulty | null = null;
  for (const part of value.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)) {
    const [left, right] = part.split('=').map(p => p.trim());
    const difficulty = (right ?? left) as Difficulty;
    if (!DIFFICULTIES.includes(difficulty)) {
      throw new ConfigError(`DIFFICULTY: unknown difficulty "${difficulty}" (${DIFFICULTIES.join(', ')})`);
    }
    if (right === undefined) {
      base = difficulty;
    } else {
      const day = WEEKDAYS.indexOf(left);
      if (day === -1) throw new ConfigError(`DIFFICULTY: unknown day "${left}" (${WEEKDAYS.join(', ')})`);
      overrides.push([day, difficulty]);
    }
  }
  if (base) days.fill(base);
  for (const [day, difficulty] of overrides) days[day] = difficulty;
  return days;
}

/** The configuration of the server, from its environment variables */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const required = (name: string, minLength: number) => {
    const value = env[name]?.trim() ?? '';
    if (value.length < minLength) {
      throw new ConfigError(`${name} is required, at least ${minLength} characters (e.g. openssl rand -hex 32)`);
    }
    return value;
  };

  const timeZone = env.TZ?.trim() || 'Europe/Paris';
  if (!isValidTimeZone(timeZone)) throw new ConfigError(`TZ: unknown time zone "${timeZone}"`);

  const releaseTime = env.RELEASE_TIME?.trim() || '12:00';
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(releaseTime);
  if (!time) throw new ConfigError(`RELEASE_TIME: "${releaseTime}" is not a time (HH:MM, e.g. 12:00)`);

  const inviteCode = env.INVITE_CODE?.trim() ?? '';
  if (inviteCode && inviteCode.length < 8) throw new ConfigError('INVITE_CODE: at least 8 characters, or empty to generate one');

  const retention = Number(env.REPLAY_RETENTION_DAYS ?? '7');
  if (!Number.isInteger(retention) || retention < 0) throw new ConfigError('REPLAY_RETENTION_DAYS: a number of days');

  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new ConfigError('PORT: invalid port');

  const trustProxy = env.TRUST_PROXY?.trim();

  return {
    serverName: env.SERVER_NAME?.trim().slice(0, 40) || 'Rush Hours',
    serverSecret: required('SERVER_SECRET', 16),
    adminToken: required('ADMIN_TOKEN', 16),
    inviteCode,
    timeZone,
    releaseTime,
    pregenerateAheadMs: parseDuration(env.PREGENERATE_AHEAD ?? '48h', 'PREGENERATE_AHEAD'),
    difficultyByWeekday: parseDifficulty(env.DIFFICULTY ?? 'NORMAL,MONDAY=HARD'),
    gracePeriodMs: parseDuration(env.GRACE_PERIOD ?? '1h', 'GRACE_PERIOD'),
    replayRetentionDays: retention,
    port,
    host: env.HOST?.trim() || '0.0.0.0',
    dataDir: env.DATA_DIR?.trim() || '/data',
    // Private networks by default: nginx on the host reaches the container through the Docker bridge
    trustProxy: trustProxy === undefined || trustProxy === '' ? 'loopback,uniquelocal'
      : trustProxy === 'true' ? true : trustProxy === 'false' ? false : trustProxy,
  };
}
