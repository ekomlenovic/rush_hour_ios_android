import type { LevelSaveState, Vehicle } from './types';
import { getLocalDateString, getWeekKey } from '../utils/date';
import { isArchiveDateAvailable } from '../utils/archives';

/**
 * Undo steps kept in the save of a level in progress. Each step copies the whole
 * board (about 1 KB): uncapped, the stacks of the abandoned levels made the save
 * too big to be read back on Android (2 MB per entry), and the game started empty.
 */
export const MAX_SAVED_UNDOS = 50;

type SavedStates = Record<string | number, LevelSaveState>;

const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function isWellFormedVehicle(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && Number.isInteger(value.row) && Number.isInteger(value.col)
    && Number.isInteger(value.length) && value.length > 0 && (value.orientation === 'horizontal' || value.orientation === 'vertical');
}

const isBoard = (value: unknown): boolean => Array.isArray(value) && value.every(isWellFormedVehicle);

/**
 * Whether a save can be resumed without crashing the game screen: a save broken by
 * another tool, edited by hand or corrupted on the phone is dropped rather than read.
 */
export function isWellFormedSave(value: unknown): value is LevelSaveState {
  if (!isRecord(value) || !isBoard(value.vehicles) || !isCount(value.moveCount)) return false;
  if (!Array.isArray(value.history) || !value.history.every(isBoard)) return false;
  if (value.moveLog !== undefined && !(Array.isArray(value.moveLog) && value.moveLog.every(isRecord))) return false;
  if (value.undoSteps !== undefined && !(Array.isArray(value.undoSteps) && value.undoSteps.every(Array.isArray))) return false;
  if (value.attempt !== undefined && !isRecord(value.attempt)) return false;
  return value.startedAt === undefined || Number.isFinite(value.startedAt);
}

/** Challenges have no undo (see docs/GAME_DESIGN.md): their save needs no undo stack */
const isChallengeKey = (key: string) => key.startsWith('daily-') || key.startsWith('weekly-');

/** The undo stack a save keeps: the last steps only, none on a challenge */
export function savedHistory(key: string | number, history: LevelSaveState['history']): LevelSaveState['history'] {
  if (isChallengeKey(String(key))) return [];
  return history.slice(-MAX_SAVED_UNDOS);
}

/**
 * Saves of levels in progress that can still be resumed, with capped undo stacks.
 * A past day's daily can no longer be played as such: its game carries on in the
 * archive of that day (same puzzle) when there is none yet, rather than being lost.
 * Past weeks and archive days out of reach can never be opened again: dropped.
 */
export function compactSavedStates(savedStates: SavedStates, now: Date = new Date()): SavedStates {
  const today = getLocalDateString(now);
  const week = getWeekKey(now);
  const compacted: SavedStates = {};
  const pastDailies: [string, LevelSaveState][] = [];

  for (const [key, save] of Object.entries(savedStates ?? {})) {
    if (!save || typeof save !== 'object') continue;
    if (key.startsWith('daily-')) {
      const date = key.slice('daily-'.length);
      if (date >= today) compacted[key] = withHistory(key, save);
      else pastDailies.push([date, save]);
    } else if (key.startsWith('weekly-')) {
      if (key.slice('weekly-'.length) >= week) compacted[key] = withHistory(key, save);
    } else if (key.startsWith('archive-')) {
      if (isArchiveDateAvailable(key.slice('archive-'.length), today)) compacted[key] = withHistory(key, save);
    } else {
      compacted[key] = withHistory(key, save);
    }
  }

  for (const [date, save] of pastDailies) {
    const archiveKey = `archive-${date}`;
    if (!compacted[archiveKey] && isArchiveDateAvailable(date, today)) compacted[archiveKey] = withHistory(archiveKey, save);
  }
  return compacted;
}

function withHistory(key: string, save: LevelSaveState): LevelSaveState {
  return { ...save, history: savedHistory(key, Array.isArray(save.history) ? save.history : []) };
}

/** Undo steps kept in the save of each of the levels played last (hard levels need many) */
export const MAX_UNDO_STEPS = 150;
/** Levels in progress that keep their undo steps in the save: the ones played last, the older ones keep none */
export const RECENT_SAVES_WITH_UNDOS = 10;

/**
 * Undo steps of a save, in the compact form of `undoSteps`: each step is the row and column of
 * every vehicle, in the order of the save's own vehicles (about 50 bytes instead of 1.4 KB a
 * board). The last MAX_UNDO_STEPS steps only, none on a challenge.
 */
export function savedUndoSteps(key: string | number, vehicles: Vehicle[], history: Vehicle[][]): number[][] {
  if (isChallengeKey(String(key))) return [];
  return history.slice(-MAX_UNDO_STEPS).map(board => {
    const byId = new Map(board.map(v => [v.id, v]));
    return vehicles.flatMap(v => {
      const at = byId.get(v.id) ?? v;
      return [at.row, at.col];
    });
  });
}

/**
 * The undo stack to resume a save with: its compact steps, or the boards of a save from before
 * v11. A step that does not match the save's vehicles is left out.
 */
export function undoStackOf(save: LevelSaveState): Vehicle[][] {
  if (!Array.isArray(save.undoSteps) || save.undoSteps.length === 0) {
    return Array.isArray(save.history) ? save.history.map(board => board.map(v => ({ ...v }))) : [];
  }
  return save.undoSteps
    .filter(step => Array.isArray(step) && step.length === save.vehicles.length * 2 && step.every(n => Number.isInteger(n)))
    .map(step => save.vehicles.map((v, i) => ({ ...v, row: step[2 * i], col: step[2 * i + 1] })));
}

/** When a save was last played: its last move, else the start of its attempt (saves from before v11) */
const playedAt = (save: LevelSaveState) => save.savedAt ?? save.startedAt ?? 0;
const hasUndos = (save: LevelSaveState) =>
  (Array.isArray(save.history) && save.history.length > 0) || (Array.isArray(save.undoSteps) && save.undoSteps.length > 0);

/**
 * Saves with no undo steps left for the levels played long ago: only the RECENT_SAVES_WITH_UNDOS
 * played last keep theirs. The game itself (board, moves, move log, attempt) is kept as is.
 * The same object when nothing changes.
 */
export function dropOldUndoStacks(savedStates: SavedStates): SavedStates {
  const withUndos = Object.entries(savedStates ?? {})
    .filter(([, save]) => isRecord(save) && hasUndos(save))
    .sort(([, a], [, b]) => playedAt(b) - playedAt(a));
  const old = withUndos.slice(RECENT_SAVES_WITH_UNDOS);
  if (old.length === 0) return savedStates;
  const dropped: SavedStates = { ...savedStates };
  for (const [key, save] of old) dropped[key] = { ...save, history: [], undoSteps: [] };
  return dropped;
}

/** Undo stacks of saves from before v11 (whole boards) in the compact form of `undoSteps` */
export function compactUndoStacks(savedStates: SavedStates): SavedStates {
  return Object.fromEntries(Object.entries(savedStates ?? {}).map(([key, save]) => {
    if (!isRecord(save) || !Array.isArray(save.history) || save.history.length === 0 || !isBoard(save.vehicles)) return [key, save];
    const undoSteps = save.history.every(isBoard) ? savedUndoSteps(key, save.vehicles, save.history) : [];
    return [key, { ...save, history: [], undoSteps }];
  }));
}
