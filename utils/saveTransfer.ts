import { useGameStore, type Level, type LevelProgress, type ChallengeResult } from '../store/gameStore';
import { STORE_VERSION, migrateState, relocateGeneratedLevels } from '../store/migrations';
import { sampleLevels } from '../data/sampleLevels';
import { ACHIEVEMENTS } from '../data/achievements';
import {
  ACHIEVEMENT_XP, archiveWinXp, dailyWinXp, getFreezeCapacity, getPlayerLevel, levelWinXp, missionsXp, weeklyWinXp, REPLAY_XP_FACTOR,
} from '../data/progression';
import { getLocalDateString, getWeekKey } from './date';

/**
 * Export / import of the player's progress, without any server (see docs/GAME_DESIGN.md, Sauvegarde).
 *
 * A save is a text code: `RHSAVE1.<checksum>.<base64 of the JSON>`, shared as is or in a .rushsave file. Without a server, cheating cannot
 * be prevented (anything the app checks, someone reading its code can redo): a cheater only fools
 * themselves, there is no leaderboard nor currency. The code only stops casual edits and broken files:
 * unreadable format, checksum, consistency checks, and values recomputed rather than trusted.
 */

const PREFIX = 'RHSAVE1';
/** Not a secret (it ships with the app): only makes a hand-edited save fail the checksum */
const CHECKSUM_SALT = 'rush-hours/save/v1';

/** Persisted fields that belong to the device, not to the player: never exported nor replaced */
export const DEVICE_FIELDS = ['notificationsEnabled', 'reminderHour', 'notificationsPrompted', 'generationState'] as const;

export interface SaveFile {
  /** STORE_VERSION of the app that made the save: the import migrates it */
  version: number;
  /** Local date of the export (YYYY-MM-DD) */
  exportedAt: string;
  state: Record<string, unknown>;
}

export type ImportError = 'invalid' | 'corrupted' | 'too_new' | 'inconsistent';

export interface ImportSummary {
  exportedAt: string;
  playerLevel: number;
  completedLevels: number;
  totalStars: number;
  currentStreak: number;
}

export type ImportResult =
  | { ok: true; state: Record<string, unknown>; summary: ImportSummary }
  | { ok: false; error: ImportError };

// ─── Encoding ─────────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

function base64ToBytes(text: string): Uint8Array | null {
  const clean = text.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean) || clean.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | B64.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 255;
    }
  }
  return bytes;
}

/** UTF-8 bytes of a string (TextEncoder / TextDecoder are not available on every Hermes version) */
function utf8Encode(text: string): Uint8Array {
  const escaped = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < escaped.length; i++) {
    if (escaped[i] === '%') {
      bytes.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(escaped.charCodeAt(i));
    }
  }
  return Uint8Array.from(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let escaped = '';
  for (const byte of bytes) escaped += `%${byte.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(escaped);
}

/** cyrb53: a fast 53-bit string hash (not cryptographic, see CHECKSUM_SALT) */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function encodeSave(save: SaveFile): string {
  const payload = bytesToBase64(utf8Encode(JSON.stringify(save)));
  return `${PREFIX}.${hash(CHECKSUM_SALT + payload)}.${payload}`;
}

/** The save inside a code, or why it cannot be read (no consistency check here) */
export function decodeSave(code: string): SaveFile | ImportError {
  // Copied codes may be wrapped on several lines
  const parts = code.replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return 'invalid';
  const [, checksum, payload] = parts;
  if (hash(CHECKSUM_SALT + payload) !== checksum) return 'corrupted';

  const bytes = base64ToBytes(payload);
  if (!bytes) return 'corrupted';
  try {
    const save = JSON.parse(utf8Decode(bytes)) as SaveFile;
    if (!isRecord(save) || !Number.isInteger(save.version) || !isRecord(save.state)) return 'invalid';
    return save;
  } catch {
    return 'corrupted';
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

/** The code of the current progress: what the app persists, minus the device settings and the undo stacks */
/** What the app persists of the current state */
const persistedState = () => useGameStore.persist.getOptions().partialize!(useGameStore.getState()) as Record<string, unknown>;

export function exportProgress(now: Date = new Date()): string {
  const persisted = persistedState();
  const state: Record<string, unknown> = { ...persisted };
  for (const field of DEVICE_FIELDS) delete state[field];

  // Undo stacks are the bulk of a save: the level in progress is kept, its undo history and move log are not
  const savedStates = (state.savedStates ?? {}) as Record<string, { history?: unknown[]; moveLog?: unknown[] }>;
  state.savedStates = Object.fromEntries(Object.entries(savedStates).map(([key, saved]) => [key, { ...saved, history: [], moveLog: [] }]));

  return encodeSave({ version: STORE_VERSION, exportedAt: getLocalDateString(now), state });
}

/** Name of an exported save file, dated so that several saves can be told apart */
export const saveFileName = (now: Date = new Date()): string => `rush-hours-${getLocalDateString(now)}.rushsave`;

// ─── Import ───────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isStars = (value: unknown) => value === undefined || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 3);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_KEY = /^\d{4}-W\d{2}$/;

/** Best stars a score allows (score = 100 × optimum − 15 per extra move, see utils/scoring.ts) */
function maxStarsForScore(score: number, minMoves: number): number {
  const best = minMoves * 100;
  return score >= best ? 3 : score >= best - 3 * 15 ? 2 : 1;
}

/** A challenge result that its own score allows */
function isValidResult(result: unknown): boolean {
  if (!isRecord(result) || typeof result.completed !== 'boolean' || !isStars(result.stars)) return false;
  if (typeof result.score !== 'number' || result.score < 0) return false;
  if (result.completed && isCount(result.minMoves) && result.minMoves > 0) {
    if (result.score > result.minMoves * 100 || result.stars > maxStarsForScore(result.score, result.minMoves)) return false;
  }
  return true;
}

/**
 * Levels whose optimum never changes, by id: the campaign and the generated levels.
 * A created level can be edited after being won (another optimum): its progress is not checked.
 */
function fixedLevelsOf(state: Record<string, any>): Map<number, Level> {
  const generated = Array.isArray(state.generatedLevels) ? (state.generatedLevels as Level[]) : [];
  return new Map([...sampleLevels, ...generated].map(level => [level.id, level]));
}

/** Whether nothing in the save is impossible to reach by playing */
export function isConsistent(state: Record<string, any>, now: Date = new Date()): boolean {
  const today = getLocalDateString(now);
  const thisWeek = getWeekKey(now);
  const levels = fixedLevelsOf(state);

  const progress = state.progress ?? [];
  if (!Array.isArray(progress)) return false;
  for (const p of progress as LevelProgress[]) {
    if (!isRecord(p) || !Number.isInteger(p.levelId) || typeof p.completed !== 'boolean') return false;
    if (typeof p.bestScore !== 'number' || p.bestScore < 0 || !isStars(p.stars)) return false;
    const minMoves = levels.get(p.levelId)?.minMoves ?? 0;
    if (p.completed && minMoves > 0 && (p.bestScore > minMoves * 100 || (p.stars ?? 1) > maxStarsForScore(p.bestScore, minMoves))) return false;
  }

  const dailies = state.dailyChallengeProgress ?? {};
  const weeklies = state.weeklyChallengeProgress ?? {};
  if (!isRecord(dailies) || !isRecord(weeklies)) return false;
  // Date keys compare as strings: nothing in the future
  for (const [key, result] of Object.entries(dailies)) {
    if (!DATE_KEY.test(key) || key > today || !isValidResult(result)) return false;
  }
  for (const [key, result] of Object.entries(weeklies)) {
    if (!WEEK_KEY.test(key) || key > thisWeek || !isValidResult(result)) return false;
  }
  // Archives are past days only: never today
  const archives = state.archiveProgress ?? {};
  const archiveLevels = state.archiveLevels ?? {};
  if (!isRecord(archives) || !isRecord(archiveLevels)) return false;
  for (const [key, result] of Object.entries(archives)) {
    if (!DATE_KEY.test(key) || key >= today || !isValidResult(result)) return false;
  }
  for (const [key, level] of Object.entries(archiveLevels)) {
    if (!DATE_KEY.test(key) || !isRecord(level) || !isCount(level.minMoves) || !Array.isArray(level.vehicles)) return false;
  }

  // Every day of a streak is a daily won (frozen days do not count)
  const dailiesWon = Object.values(dailies as Record<string, ChallengeResult>).filter(r => r.completed).length;
  const { currentStreak = 0, bestStreak = 0 } = state;
  if (!isCount(currentStreak) || !isCount(bestStreak) || currentStreak > bestStreak || bestStreak > dailiesWon) return false;

  const dates = [state.lastStreakDate, state.lastOpenDate, ...(Array.isArray(state.frozenDates) ? state.frozenDates : [])];
  if (dates.some(d => d != null && (typeof d !== 'string' || !DATE_KEY.test(d) || d > today))) return false;

  for (const field of ['xp', 'streakFreezes', 'totalHintsUsed', 'maxUnlockedLevel']) {
    if (state[field] !== undefined && !isCount(state[field])) return false;
  }
  for (const field of ['achievements', 'generatedLevels', 'createdLevels', 'importedLevels', 'frozenDates', 'seenCosmetics']) {
    if (state[field] !== undefined && !Array.isArray(state[field])) return false;
  }
  for (const field of ['stats', 'savedStates', 'cosmetics']) {
    if (state[field] !== undefined && !isRecord(state[field])) return false;
  }
  const customLevels = [state.generatedLevels, state.createdLevels, state.importedLevels].flatMap(list => list ?? []);
  if (!customLevels.every(l => isRecord(l) && Number.isInteger(l.id) && isCount(l.minMoves) && Array.isArray(l.vehicles))) return false;
  return true;
}

/** Most XP the save's wins can have given: first wins at their best stars, every other win as a replay */
export function maxPlausibleXp(state: Record<string, any>): number {
  const levels = fixedLevelsOf(state);
  const completed = (state.progress as LevelProgress[]).filter(p => p.completed);
  // A custom level (maybe edited or deleted since) is counted as hard as a level can be
  let xp = completed.reduce((sum, p) => sum + levelWinXp(levels.get(p.levelId)?.minMoves ?? 60, p.stars || 1, true), 0);
  const replays = Math.max(0, (state.stats?.totalWins ?? 0) - completed.length);
  xp += replays * levelWinXp(60, 3, true) * REPLAY_XP_FACTOR;
  for (const r of Object.values((state.dailyChallengeProgress ?? {}) as Record<string, ChallengeResult>)) {
    if (r.completed) xp += dailyWinXp(r.stars || 1);
  }
  for (const r of Object.values((state.weeklyChallengeProgress ?? {}) as Record<string, ChallengeResult>)) {
    if (r.completed) xp += weeklyWinXp(r.stars || 1);
  }
  for (const r of Object.values((state.archiveProgress ?? {}) as Record<string, ChallengeResult>)) {
    if (r.completed) xp += archiveWinXp(r.minMoves ?? 60, r.stars || 1);
  }
  xp += (state.stats?.missionDaysCompleted ?? 0) * missionsXp(false);
  xp += (state.achievements?.length ?? 0) * ACHIEVEMENT_XP;
  return Math.ceil(xp);
}

/**
 * Reads a save code and prepares the state to import: migrated to this version of the app,
 * checked, and with the values that follow from the progress recomputed rather than trusted.
 */
export function parseSave(code: string, now: Date = new Date()): ImportResult {
  const save = decodeSave(code);
  if (typeof save === 'string') return { ok: false, error: save };
  if (save.version > STORE_VERSION) return { ok: false, error: 'too_new' };

  let state: Record<string, any>;
  try {
    // save.state was just parsed: migrating it in place touches nothing else
    state = relocateGeneratedLevels(migrateState(save.state, save.version));
  } catch {
    return { ok: false, error: 'inconsistent' };
  }
  // Only what the app persists: nothing else of the store (its actions) can be replaced
  const persistedFields = new Set(Object.keys(persistedState()));
  for (const field of DEVICE_FIELDS) persistedFields.delete(field);
  state = Object.fromEntries(Object.entries(state).filter(([field]) => persistedFields.has(field)));
  state.progress ??= [];
  if (!isConsistent(state, now)) return { ok: false, error: 'inconsistent' };

  const knownAchievements = new Set(ACHIEVEMENTS.map(a => a.id));
  state.achievements = [...new Set((state.achievements ?? []) as string[])].filter(id => knownAchievements.has(id));
  state.xp = Math.min(state.xp ?? 0, maxPlausibleXp(state));
  state.streakFreezes = Math.min(state.streakFreezes ?? 0, getFreezeCapacity(getPlayerLevel(state.xp)));

  const completed = (state.progress as LevelProgress[]).filter(p => p.completed);
  return {
    ok: true,
    state,
    summary: {
      exportedAt: typeof save.exportedAt === 'string' ? save.exportedAt : '',
      playerLevel: getPlayerLevel(state.xp),
      completedLevels: completed.length,
      totalStars: completed.reduce((sum, p) => sum + (p.stars || 0), 0),
      currentStreak: state.currentStreak ?? 0,
    },
  };
}
