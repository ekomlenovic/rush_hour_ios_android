import type { Level, LevelProgress, LevelSaveState } from './types';
import { sampleLevels } from '../data/sampleLevels';
import { recomputeStreak } from './streak';
import { computeRetroactiveXp } from '../data/progression';

/** Version of the persisted state: bump it and add a step to migrateState when its shape changes */
export const STORE_VERSION = 3;

/** Brings a state saved by an older version up to STORE_VERSION */
export function migrateState(persistedState: unknown, version: number): Record<string, unknown> {
  const state = (persistedState || {}) as Record<string, unknown>;
  if (version < 1) {
    // v1: hints are unlimited, the token economy is gone (see docs/GAME_DESIGN.md)
    delete state.hintTokens;
    // v1: the weekly challenge was never reachable, replaced by weeklyChallengeProgress
    delete state.weeklyChallenge;
  }
  if (version < 2) {
    // v2: streaks were broken west of UTC (dates parsed as UTC), rebuild them from the dailies
    Object.assign(state, recomputeStreak(state));
  }
  if (version < 3) {
    // v3: player XP, credited for the progress made before it existed (each win once)
    const levels = [sampleLevels, state.generatedLevels, state.createdLevels, state.importedLevels]
      .flatMap(list => (Array.isArray(list) ? (list as Level[]) : []));
    state.xp = computeRetroactiveXp(state, levels);
  }
  return state;
}

/** Persisted fields tied to level ids */
interface RelocatableState {
  generatedLevels?: Level[];
  progress?: LevelProgress[];
  savedStates?: Record<string | number, LevelSaveState>;
  lastPlayedLevelId?: number | null;
  maxUnlockedLevel?: number;
}

/**
 * Generated levels take ids right after the official pack. When an update adds
 * official levels, previously generated levels collide with the new ids: shift
 * them (and the progress/save/unlock state tied to them) past the new pack.
 */
export function relocateGeneratedLevels<T extends RelocatableState>(state: T): T {
  const generated = state.generatedLevels ?? [];
  if (generated.length === 0) return state;

  const firstId = Math.min(...generated.map((l) => l.id));
  const offset = sampleLevels.length + 1 - firstId;
  if (offset <= 0) return state;

  const generatedIds = new Set(generated.map((l) => l.id));
  const oldBaseCount = firstId - 1;
  const shift = (id: number) => (generatedIds.has(id) ? id + offset : id);

  const savedStates: Record<string | number, LevelSaveState> = {};
  for (const [key, value] of Object.entries(state.savedStates ?? {})) {
    const numericKey = Number(key);
    savedStates[Number.isInteger(numericKey) ? shift(numericKey) : key] = value;
  }

  return {
    ...state,
    generatedLevels: generated.map((l) => ({ ...l, id: l.id + offset })),
    progress: (state.progress ?? []).map((p) => ({ ...p, levelId: shift(p.levelId) })),
    savedStates,
    lastPlayedLevelId: state.lastPlayedLevelId != null ? shift(state.lastPlayedLevelId) : state.lastPlayedLevelId,
    maxUnlockedLevel:
      state.maxUnlockedLevel != null && state.maxUnlockedLevel > oldBaseCount && state.maxUnlockedLevel < 900000
        ? state.maxUnlockedLevel + offset
        : state.maxUnlockedLevel,
  };
}
