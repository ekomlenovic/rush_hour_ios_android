import type { LevelSaveState } from './types';
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

