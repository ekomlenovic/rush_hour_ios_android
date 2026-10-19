import type { ChallengeResult, Level, LevelProgress, LevelSaveState } from './types';
import { sampleLevels } from '../data/sampleLevels';
import { recomputeStreak } from './streak';
import { BOSS_WIN_XP, computeRetroactiveXp } from '../data/progression';
import { isBossLevel } from '../data/bosses';
import { getStars, starsFromScore } from '../utils/scoring';
import { compactSavedStates } from './savedStates';
import { latestSavedDate, latestSavedWeek } from '../utils/challengeDates';

/** Version of the persisted state: bump it and add a step to migrateState when its shape changes */
export const STORE_VERSION = 9;

/** Brings a state saved by an older version up to STORE_VERSION */
export function migrateState(persistedState: unknown, version: number): Record<string, unknown> {
  let state = (persistedState || {}) as Record<string, unknown>;
  if (version < 5) {
    // v5: 5 levels (7 to 11 moves) inserted after level 5 to smooth the ramp up to 12 moves.
    // First, so that the steps below look the levels up by their new ids
    state = shiftLevelsAfterRamp(state);
  }
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
  if (version < 4) {
    // v4: 2 stars within half of the optimum instead of 3 extra moves, past wins recounted
    Object.assign(state, recountStars(state));
  }
  if (version < 6) {
    // v6: undo stacks capped and dead challenge saves cleared, the save grew past what Android
    // reads back (2 MB) and the game started empty. A past daily in progress moves to its archive
    if (state.savedStates && typeof state.savedStates === 'object') {
      state.savedStates = compactSavedStates(state.savedStates as Record<string, LevelSaveState>);
    }
  }
  if (version < 7) {
    // v7: a link could open the daily or weekly of any date, won before its day (issue 119): the streak
    // jumped to that day and the save could no longer be imported. Those wins are taken out of the
    // challenges (their XP stays) and the streak is rebuilt from the real days
    Object.assign(state, dropChallengesToCome(state));
  }
  if (version < 8) {
    // v8: a generation that failed left a hole in the ids of the generated levels (issue 120): the
    // level after it never unlocked. They are numbered again, in order, right after the pack
    state = renumberGeneratedLevels(state);
  }
  if (version < 9) {
    // v9: the first win of a boss level gives extra XP, credited for the bosses already won
    const bossWins = Array.isArray(state.progress)
      ? (state.progress as LevelProgress[]).filter(p => p?.completed && isBossLevel(p.levelId)).length
      : 0;
    if (bossWins > 0) state.xp = (typeof state.xp === 'number' ? state.xp : 0) + bossWins * BOSS_WIN_XP;
  }
  return state;
}

/**
 * Generated levels numbered from the end of the pack without holes, in the order of their ids,
 * with the progress, saves and unlocking tied to them. The level after a hole unlocks.
 */
function renumberGeneratedLevels(state: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(state.generatedLevels) || state.generatedLevels.length === 0) return state;
  const generated = [...(state.generatedLevels as Level[])].sort((a, b) => a.id - b.id);
  const base = sampleLevels.length;
  const newIds = new Map(generated.map((l, i) => [l.id, base + 1 + i]));
  const renumber = (id: number) => newIds.get(id) ?? id;

  const renumbered: Record<string, unknown> = {
    ...state,
    generatedLevels: generated.map(l => ({ ...l, id: renumber(l.id) })),
  };
  if (Array.isArray(state.progress)) {
    renumbered.progress = (state.progress as LevelProgress[]).map(p => ({ ...p, levelId: renumber(p.levelId) }));
  }
  if (state.savedStates && typeof state.savedStates === 'object') {
    renumbered.savedStates = Object.fromEntries(Object.entries(state.savedStates as Record<string, LevelSaveState>).map(([key, value]) => {
      const id = Number(key);
      return [Number.isInteger(id) ? renumber(id) : key, value];
    }));
  }
  if (typeof state.lastPlayedLevelId === 'number') renumbered.lastPlayedLevelId = renumber(state.lastPlayedLevelId);
  // Past the pack (the one the generated levels followed, it may have grown since): every generated
  // level before the next one to play stays unlocked, holes left out
  const max = state.maxUnlockedLevel;
  const packEnd = Math.min(base, generated[0].id - 1);
  if (typeof max === 'number' && max > packEnd && max < MAP_ID_END) {
    renumbered.maxUnlockedLevel = base + 1 + generated.filter(l => l.id < max).length;
  }
  return renumbered;
}

/**
 * Daily and weekly results of days that have not come yet (a day of tolerance: a save made
 * in a time zone further east), and the streak that followed them, rebuilt from the dailies
 */
function dropChallengesToCome(state: Record<string, unknown>): Record<string, unknown> {
  const latestDate = latestSavedDate();
  const latestWeek = latestSavedWeek();
  const keep = (results: unknown, isComing: (key: string) => boolean) =>
    Object.fromEntries(Object.entries(results as Record<string, ChallengeResult>).filter(([key]) => !isComing(key)));

  const fixed: Record<string, unknown> = {};
  if (state.dailyChallengeProgress && typeof state.dailyChallengeProgress === 'object') {
    fixed.dailyChallengeProgress = keep(state.dailyChallengeProgress, key => key > latestDate);
  }
  if (state.weeklyChallengeProgress && typeof state.weeklyChallengeProgress === 'object') {
    fixed.weeklyChallengeProgress = keep(state.weeklyChallengeProgress, key => key > latestWeek);
  }
  if (typeof state.lastStreakDate === 'string' && state.lastStreakDate > latestDate) {
    // The best streak never goes down; with no real daily left, the streak starts again
    const rebuilt = recomputeStreak({ ...state, ...fixed });
    fixed.currentStreak = rebuilt.currentStreak ?? 0;
    fixed.bestStreak = rebuilt.bestStreak ?? (Number(state.bestStreak) || 0);
    fixed.lastStreakDate = rebuilt.lastStreakDate ?? null;
  }
  return fixed;
}

/** Last level before the levels inserted in v5, and how many were inserted */
const RAMP_AFTER_LEVEL = 5;
const RAMP_LEVEL_COUNT = 5;
const MAP_ID_END = 900000;

/** Moves the progress, saves and generated levels from level 6 on past the levels inserted in v5 */
function shiftLevelsAfterRamp(state: Record<string, unknown>): Record<string, unknown> {
  const isShifted = (id: number) => id > RAMP_AFTER_LEVEL && id < MAP_ID_END;
  const shift = (id: number) => (isShifted(id) ? id + RAMP_LEVEL_COUNT : id);
  const shifted: Record<string, unknown> = { ...state };

  if (Array.isArray(state.progress)) {
    shifted.progress = (state.progress as LevelProgress[]).map(p => ({ ...p, levelId: shift(p.levelId) }));
  }
  if (Array.isArray(state.generatedLevels)) {
    shifted.generatedLevels = (state.generatedLevels as Level[]).map(l => ({ ...l, id: shift(l.id) }));
  }
  if (state.savedStates && typeof state.savedStates === 'object') {
    shifted.savedStates = Object.fromEntries(Object.entries(state.savedStates as Record<string, LevelSaveState>).map(([key, value]) => {
      const id = Number(key);
      return [Number.isInteger(id) ? shift(id) : key, value];
    }));
  }
  if (typeof state.lastPlayedLevelId === 'number') shifted.lastPlayedLevelId = shift(state.lastPlayedLevelId);
  // A player stuck on the old level 6 starts the new levels; the others keep their next level
  if (typeof state.maxUnlockedLevel === 'number' && state.maxUnlockedLevel > RAMP_AFTER_LEVEL + 1) {
    shifted.maxUnlockedLevel = shift(state.maxUnlockedLevel);
  }
  return shifted;
}

/** Stars of the saved wins under the current getStars rule (XP already earned stays as is) */
function recountStars(state: Record<string, unknown>): Record<string, unknown> {
  const levels = [sampleLevels, state.generatedLevels, state.createdLevels, state.importedLevels]
    .flatMap(list => (Array.isArray(list) ? (list as Level[]) : []));
  const minMovesById = new Map(levels.map(l => [l.id, l.minMoves]));

  const recounted: Record<string, unknown> = {};
  if (Array.isArray(state.progress)) {
    recounted.progress = (state.progress as LevelProgress[]).map(p => {
      const minMoves = minMovesById.get(p.levelId);
      return p.completed && minMoves ? { ...p, stars: starsFromScore(p.bestScore, minMoves) } : p;
    });
  }
  // Challenges keep their moves since 1.1: older results keep their stars
  for (const key of ['dailyChallengeProgress', 'weeklyChallengeProgress', 'archiveProgress']) {
    const results = state[key];
    if (!results || typeof results !== 'object') continue;
    recounted[key] = Object.fromEntries(Object.entries(results as Record<string, ChallengeResult>).map(([k, r]) => [
      k,
      r?.completed && r.moves && r.minMoves ? { ...r, stars: getStars(r.moves, r.minMoves) } : r,
    ]));
  }
  return recounted;
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
