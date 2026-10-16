import { DIFFICULTIES, type Config, type Difficulty } from './config';
import { getSetting, setSetting, type Database } from './db';
import { DEFAULT_THRESHOLDS, type Thresholds } from './cheat';

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
}

const KEY = 'admin_settings';

export function defaultSettings(config: Config): AdminSettings {
  return {
    joinOpen: true,
    invitesAdminOnly: false,
    difficultyByWeekday: config.difficultyByWeekday,
    replayRetentionDays: config.replayRetentionDays,
    thresholds: DEFAULT_THRESHOLDS,
  };
}

export function loadSettings(db: Database, config: Config): AdminSettings {
  const defaults = defaultSettings(config);
  const raw = getSetting(db, KEY);
  if (!raw) return defaults;
  const saved = JSON.parse(raw) as Partial<AdminSettings>;
  return { ...defaults, ...saved, thresholds: { ...defaults.thresholds, ...saved.thresholds } };
}

export class SettingsError extends Error {}

const isNumber = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Validates a change sent by the admin and saves it; returns the new settings */
export function updateSettings(db: Database, config: Config, patch: Record<string, unknown>): AdminSettings {
  const current = loadSettings(db, config);
  const next: AdminSettings = { ...current, thresholds: { ...current.thresholds } };

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
  setSetting(db, KEY, JSON.stringify(next));
  return next;
}
