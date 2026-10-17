import { DIFFICULTIES, type Config, type Difficulty } from './config';
import { getSetting, setSetting, type Database } from './db';
import { DEFAULT_THRESHOLDS, type Thresholds } from './cheat';
import { addDays, currentChallengeDate, releaseTimeOn, zonedTimeToInstant, type ReleaseChange, type Schedule } from './time';

const HOUR_MS = 3_600_000;
/** A new release time may not bring the next challenge closer than this */
export const MIN_RELEASE_NOTICE_MS = HOUR_MS;
export const SERVER_NAME_MAX = 40;
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;

/**
 * What the admin can change from the app, without restarting the server (#50).
 * Starts from the environment variables; once changed in the app, the app wins.
 */
export interface AdminSettings {
  /** New players can join with the invite code */
  joinOpen: boolean;
  /** Only the admin can see the invite code (to invite) */
  invitesAdminOnly: boolean;
  difficultyByWeekday: Difficulty[];
  replayRetentionDays: number;
  thresholds: Thresholds;
  serverName: string;
  /** 'HH:MM': release time of the next challenge and the ones after it */
  releaseTime: string;
  /** Every release time set in the app, so that the challenges already out never move */
  releaseChanges: ReleaseChange[];
  gracePeriodMs: number;
  pregenerateAheadMs: number;
}

const KEY = 'admin_settings';

export function defaultSettings(config: Config): AdminSettings {
  return {
    joinOpen: true,
    invitesAdminOnly: false,
    difficultyByWeekday: config.difficultyByWeekday,
    replayRetentionDays: config.replayRetentionDays,
    thresholds: DEFAULT_THRESHOLDS,
    serverName: config.serverName,
    releaseTime: config.releaseTime,
    releaseChanges: [],
    gracePeriodMs: config.gracePeriodMs,
    pregenerateAheadMs: config.pregenerateAheadMs,
  };
}

/** When the challenges come out, with the release times set in the app */
export function scheduleOf(config: Config, settings: Pick<AdminSettings, 'releaseChanges'>): Schedule {
  return { timeZone: config.timeZone, releaseTime: config.releaseTime, changes: settings.releaseChanges };
}

export function loadSettings(db: Database, config: Config): AdminSettings {
  const defaults = defaultSettings(config);
  const raw = getSetting(db, KEY);
  if (!raw) return defaults;
  const saved = JSON.parse(raw) as Partial<AdminSettings>;
  return { ...defaults, ...saved, thresholds: { ...defaults.thresholds, ...saved.thresholds } };
}

export class SettingsError extends Error {
  /** `field` is the refused setting; `code` the error sent to the app */
  constructor(field: string, readonly code = 'invalid_settings') {
    super(field);
  }
}

const isNumber = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/**
 * The release changes once the release time becomes `time` (null: RELEASE_TIME again).
 * The challenge being played keeps its release: the new time applies from the next one on.
 */
function withReleaseTime(config: Config, settings: AdminSettings, time: string | null, now: number): ReleaseChange[] {
  const schedule = scheduleOf(config, settings);
  const from = addDays(currentChallengeDate(now, schedule), 1);
  const changes = settings.releaseChanges;
  const effective = changes.filter(c => c.from <= from).at(-1)?.releaseTime ?? null;
  if (time === effective) return changes;
  const next = time ?? config.releaseTime;
  if (next !== releaseTimeOn(from, schedule) && zonedTimeToInstant(from, next, config.timeZone) - now < MIN_RELEASE_NOTICE_MS) {
    throw new SettingsError('releaseTime', 'release_too_soon');
  }
  // The first change keeps the environment's time for the past, even if RELEASE_TIME changes later
  const kept = changes.length ? changes.filter(c => c.from < from) : [{ from: '0000-01-01', releaseTime: config.releaseTime }];
  return [...kept, { from, releaseTime: time }];
}

/**
 * Back to the environment variables: the release time from the next challenge on,
 * the rest at once. The invite code stays.
 */
export function resetSettings(db: Database, config: Config, now: number): AdminSettings {
  const releaseChanges = withReleaseTime(config, loadSettings(db, config), null, now);
  // The release changes stay, so that the challenges already out never move
  setSetting(db, KEY, JSON.stringify(releaseChanges.length ? { releaseChanges } : {}));
  return loadSettings(db, config);
}

/** Validates a change sent by the admin and saves it; returns the new settings */
export function updateSettings(db: Database, config: Config, patch: Record<string, unknown>, now: number): AdminSettings {
  const current = loadSettings(db, config);
  const next: AdminSettings = { ...current, thresholds: { ...current.thresholds }, releaseChanges: [...current.releaseChanges] };

  if ('joinOpen' in patch) {
    if (typeof patch.joinOpen !== 'boolean') throw new SettingsError('joinOpen');
    next.joinOpen = patch.joinOpen;
  }
  if ('invitesAdminOnly' in patch) {
    if (typeof patch.invitesAdminOnly !== 'boolean') throw new SettingsError('invitesAdminOnly');
    next.invitesAdminOnly = patch.invitesAdminOnly;
  }
  if ('difficultyByWeekday' in patch) {
    const days = patch.difficultyByWeekday;
    if (!Array.isArray(days) || days.length !== 7 || !days.every(d => DIFFICULTIES.includes(d))) throw new SettingsError('difficultyByWeekday');
    next.difficultyByWeekday = days as Difficulty[];
  }
  if ('replayRetentionDays' in patch) {
    if (!isNumber(patch.replayRetentionDays, 0, 365) || !Number.isInteger(patch.replayRetentionDays)) throw new SettingsError('replayRetentionDays');
    next.replayRetentionDays = patch.replayRetentionDays as number;
  }
  if ('thresholds' in patch) {
    const th = patch.thresholds as Record<string, unknown>;
    if (!th || typeof th !== 'object') throw new SettingsError('thresholds');
    const limits: Record<keyof Thresholds, [number, number]> = {
      minMsPerMove: [0, 10_000],
      copyMinMoves: [1, 200],
      copyPauseRatio: [0, 1],
      copyMaxRhythmVariation: [0, 5],
      clockToleranceMs: [0, 3_600_000],
      clockToleranceRatio: [0, 1],
    };
    for (const [key, value] of Object.entries(th)) {
      const range = limits[key as keyof Thresholds];
      if (!range || !isNumber(value, range[0], range[1])) throw new SettingsError(`thresholds.${key}`);
      next.thresholds[key as keyof Thresholds] = value as number;
    }
  }
  if ('serverName' in patch) {
    const name = typeof patch.serverName === 'string' ? patch.serverName.trim() : '';
    // Shown to every player: no control or direction characters that could garble or disguise it
    if (!name || [...name].length > SERVER_NAME_MAX || INVISIBLE.test(name)) throw new SettingsError('serverName');
    next.serverName = name;
  }
  if ('gracePeriodMs' in patch) {
    if (!isNumber(patch.gracePeriodMs, 0, 24 * HOUR_MS) || !Number.isInteger(patch.gracePeriodMs)) throw new SettingsError('gracePeriodMs');
    next.gracePeriodMs = patch.gracePeriodMs as number;
  }
  if ('pregenerateAheadMs' in patch) {
    if (!isNumber(patch.pregenerateAheadMs, HOUR_MS, 7 * 24 * HOUR_MS) || !Number.isInteger(patch.pregenerateAheadMs)) {
      throw new SettingsError('pregenerateAheadMs');
    }
    next.pregenerateAheadMs = patch.pregenerateAheadMs as number;
  }
  if ('releaseTime' in patch) {
    const time = patch.releaseTime;
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new SettingsError('releaseTime');
    next.releaseChanges = withReleaseTime(config, current, time, now);
    next.releaseTime = time;
  }
  // Only what the admin changed: the rest keeps following the environment
  const saved = JSON.parse(getSetting(db, KEY) ?? '{}') as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    if (Object.hasOwn(next, key) && key !== 'releaseChanges') saved[key] = next[key as keyof AdminSettings];
  }
  if ('releaseTime' in patch) saved.releaseChanges = next.releaseChanges;
  setSetting(db, KEY, JSON.stringify(saved));
  return next;
}
