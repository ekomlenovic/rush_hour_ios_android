import type { ChallengeResult, Level, LevelProgress, LevelSaveState, PeriodStats, PlayerStats } from '../store/types';
import type { DailyMissionsState } from '../data/missions';
import { sampleLevels } from '../data/sampleLevels';
import { getFreezeCapacity, getPlayerLevel } from '../data/progression';
import { initialStats } from '../store/stats';
import { isSameBoard } from './sharing';

/**
 * Merge of two saves of the same player (issue 320, synchro Play Jeux): the progress of this phone
 * and the one found in the cloud, both in the shape the app persists (the cloud one read by
 * `parseSave`: migrated, checked, recomputed). Nothing the player earned on either phone is lost:
 * see docs/GAME_DESIGN.md, « Synchro automatique (Play Jeux) ».
 *
 * - **Gains** are kept from both: levels won, best score, stars, best time, unlocks (achievements,
 *   levels of the map, created and imported levels, archive days), lifetime counters (the highest:
 *   a phone that started from the other's save already counts its wins, a sum would count them twice).
 * - **This phone stays as it is** where it plays: its games in progress, and a level of its map
 *   whose board differs from the cloud's (each phone draws its own infinite map) keeps its own board
 *   and progress.
 * - **One-try challenges** (daily, weekly): a won result beats one not won; won on both, this phone's
 *   result stays (the try the player saw), a second phone does not give a second try. Archives are
 *   training: the best result is kept.
 * - **Streak**: the one of the save that won a daily last, the best streak of both; the days missed
 *   since are applied afterwards, as at an import (`recordAppOpen`).
 * - Choices with no "better" value (settings, styles selected, map position) stay this phone's, except
 *   on a phone that has not played yet (a new phone): it takes the cloud's.
 *
 * The order of this phone's lists is kept (the cloud's additions after them): a merge that adds
 * nothing gives back this phone's state as it was (see `isSameSave`).
 */

type State = Record<string, any>;

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const recordOf = <T>(value: unknown): Record<string, T> => (isRecord(value) ? (value as Record<string, T>) : {});
const numberOr = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
/** The later of two optional date keys (YYYY-MM-DD, YYYY-MM or YYYY: they compare as strings) */
const laterKey = (a: unknown, b: unknown): string | null => {
  const keys = [a, b].filter((k): k is string => typeof k === 'string');
  return keys.length ? keys.reduce((x, y) => (y > x ? y : x)) : null;
};

/** The campaign never differs between two phones: its levels are the same ids everywhere */
const CAMPAIGN = new Map(sampleLevels.map(level => [level.id, level]));

/** Levels by id; the first list given wins on an id found twice */
function levelsById(...lists: Level[][]): Map<number, Level> {
  const byId = new Map<number, Level>();
  for (const list of lists) for (const level of list) if (!byId.has(level.id)) byId.set(level.id, level);
  return byId;
}

/** Every level a save knows by id: campaign, its map, created and imported levels */
function knownLevels(state: State): Map<number, Level> {
  return levelsById(
    sampleLevels,
    arrayOf<Level>(state.generatedLevels),
    arrayOf<Level>(state.createdLevels),
    arrayOf<Level>(state.importedLevels),
  );
}

/**
 * The map levels of both: this phone's board for an id they share, the cloud's levels after the end
 * of this phone's map appended (the infinite map is drawn at random on each phone)
 */
function mergeGenerated(local: Level[], remote: Level[]): Level[] {
  const localIds = new Set(local.map(l => l.id));
  const lastLocal = local.reduce((max, l) => Math.max(max, l.id), 0);
  const added = remote.filter(l => !localIds.has(l.id) && l.id > lastLocal).sort((a, b) => a.id - b.id);
  return [...local, ...added];
}

/** Created or imported levels of both: on a shared id, the one edited last */
function mergeCustom(local: Level[], remote: Level[]): Level[] {
  const byId = new Map<number, Level>();
  for (const level of [...local, ...remote]) {
    const kept = byId.get(level.id);
    if (!kept || numberOr(level.updatedAt) > numberOr(kept.updatedAt)) byId.set(level.id, level);
  }
  // This phone's order first (the order of « Mes niveaux »), then the levels only in the cloud
  const order = [...local, ...remote].map(l => l.id).filter((id, i, ids) => ids.indexOf(id) === i);
  return order.map(id => byId.get(id)!);
}

/** The best of two results of the same level */
function bestProgress(a: LevelProgress, b: LevelProgress): LevelProgress {
  const times = [a.bestTimeMs, b.bestTimeMs].filter((t): t is number => typeof t === 'number');
  const either = (field: keyof LevelProgress) => a[field] !== undefined || b[field] !== undefined;
  return {
    ...a,
    completed: a.completed || b.completed,
    bestScore: Math.max(a.bestScore, b.bestScore),
    ...(either('stars') && { stars: Math.max(a.stars ?? 0, b.stars ?? 0) }),
    ...(times.length > 0 && { bestTimeMs: Math.min(...times) }),
    ...(either('noHint') && { noHint: !!(a.noHint || b.noHint) }),
    ...(either('noHelp') && { noHelp: !!(a.noHelp || b.noHelp) }),
  };
}

/**
 * Progress of both, level by level. A result counts for the merged level only if it was won on the
 * same board: a map level drawn differently on the other phone, or a created level edited since,
 * is another puzzle (its result stays with its own board, on its own phone)
 */
function mergeProgress(local: State, remote: State, merged: Map<number, Level>): LevelProgress[] {
  const result = new Map<number, LevelProgress>();
  for (const source of [local, remote]) {
    const levels = knownLevels(source);
    for (const p of arrayOf<LevelProgress>(source.progress)) {
      const own = levels.get(p.levelId);
      const kept = merged.get(p.levelId);
      const sameBoard = CAMPAIGN.has(p.levelId) || !own || !kept || own === kept || isSameBoard(own, kept);
      if (!sameBoard) continue;
      const existing = result.get(p.levelId);
      result.set(p.levelId, existing ? bestProgress(existing, p) : { ...p });
    }
  }
  return [...result.values()];
}

/** One-try challenges: won beats not won; won on both, this phone's result stays */
function mergeOneTry(local: Record<string, ChallengeResult>, remote: Record<string, ChallengeResult>): Record<string, ChallengeResult> {
  const merged: Record<string, ChallengeResult> = { ...remote };
  for (const [key, result] of Object.entries(local)) {
    const other = remote[key];
    merged[key] = !other || result.completed || !other.completed ? result : other;
  }
  return merged;
}

/** Training (archives): the best result of each day */
function mergeBest(local: Record<string, ChallengeResult>, remote: Record<string, ChallengeResult>): Record<string, ChallengeResult> {
  const merged: Record<string, ChallengeResult> = { ...remote };
  for (const [key, result] of Object.entries(local)) {
    const other = remote[key];
    if (!other || (result.completed && !other.completed)) merged[key] = result;
    else if (result.completed === other.completed) merged[key] = result.score >= other.score ? result : other;
  }
  return merged;
}

const unionList = (a: unknown, b: unknown): string[] => [...new Set([...arrayOf<string>(a), ...arrayOf<string>(b)])];

/** Lifetime counters: the highest of each (never a sum, see above); the fastest win is the lowest */
function mergeStats(local: unknown, remote: unknown): PlayerStats {
  const a: Record<string, any> = { ...initialStats(), ...recordOf(local) };
  const b: Record<string, any> = { ...initialStats(), ...recordOf(remote) };
  const merged: Record<string, any> = {};
  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[field];
    const y = b[field];
    if (field === 'fastestWinMs') {
      const times = [x, y].filter((t): t is number => typeof t === 'number');
      merged[field] = times.length ? Math.min(...times) : null;
    } else if (isRecord(x) || isRecord(y)) {
      const keys = new Set([...Object.keys(recordOf(x)), ...Object.keys(recordOf(y))]);
      merged[field] = Object.fromEntries([...keys].map(k => [k, Math.max(numberOr(recordOf(x)[k]), numberOr(recordOf(y)[k]))]));
    } else {
      merged[field] = Math.max(numberOr(x), numberOr(y));
    }
  }
  return merged as PlayerStats;
}

/** Recap counters, period by period and field by field: the highest */
function mergePeriods(local: unknown, remote: unknown): Record<string, PeriodStats> {
  const a = recordOf<PeriodStats>(local);
  const b = recordOf<PeriodStats>(remote);
  const merged: Record<string, PeriodStats> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x: Record<string, number> = { ...(a[key] ?? {}) } as any;
    const y: Record<string, number> = { ...(b[key] ?? {}) } as any;
    const fields = new Set([...Object.keys(x), ...Object.keys(y)]);
    merged[key] = Object.fromEntries([...fields].map(f => [f, Math.max(numberOr(x[f]), numberOr(y[f]))])) as unknown as PeriodStats;
  }
  return merged;
}

/** Month each achievement was unlocked: the first of both */
function mergeAchievementMonths(local: unknown, remote: unknown): Record<string, string> {
  const merged: Record<string, string> = { ...recordOf<string>(remote) };
  for (const [id, month] of Object.entries(recordOf<string>(local))) {
    merged[id] = merged[id] && merged[id] < month ? merged[id] : month;
  }
  return merged;
}

/**
 * Games in progress: this phone's stay as they are (never changed under the player, issue 320:
 * never during a game); a game only in the cloud is added, unless it is on a map level whose board
 * differs here
 */
function mergeSavedStates(local: unknown, remote: unknown, localLevels: Map<number, Level>, remoteLevels: Map<number, Level>): Record<string, LevelSaveState> {
  const merged: Record<string, LevelSaveState> = { ...recordOf<LevelSaveState>(local) };
  for (const [key, saved] of Object.entries(recordOf<LevelSaveState>(remote))) {
    if (key in merged) continue;
    const id = Number(key);
    if (Number.isInteger(id)) {
      const here = localLevels.get(id);
      const there = remoteLevels.get(id);
      if (here && there && here !== there && !isSameBoard(here, there)) continue;
    }
    merged[key] = saved;
  }
  return merged;
}

/** The missions of the latest day; the same day on both, the counters furthest along */
function mergeMissions(local: DailyMissionsState | null, remote: DailyMissionsState | null): DailyMissionsState | null {
  if (!local || !remote) return local ?? remote ?? null;
  if (local.date !== remote.date) return local.date > remote.date ? local : remote;
  const counters: Record<string, number> = { ...remote.counters } as any;
  for (const [counter, value] of Object.entries(local.counters)) counters[counter] = Math.max(numberOr(value), numberOr(counters[counter]));
  return { ...local, counters, rewarded: local.rewarded || remote.rewarded };
}

/** The streak of the save that won a daily last (the other one is behind it), the best of both */
function mergeStreak(local: State, remote: State, xp: number) {
  const localDate = local.lastStreakDate ?? '';
  const remoteDate = remote.lastStreakDate ?? '';
  const newer = remoteDate > localDate || (remoteDate === localDate && numberOr(remote.currentStreak) > numberOr(local.currentStreak))
    ? remote
    : local;
  const capacity = getFreezeCapacity(getPlayerLevel(xp));
  return {
    currentStreak: numberOr(newer.currentStreak),
    bestStreak: Math.max(numberOr(local.bestStreak), numberOr(remote.bestStreak), numberOr(newer.currentStreak)),
    lastStreakDate: newer.lastStreakDate ?? null,
    streakFreezes: Math.min(Math.max(numberOr(local.streakFreezes), numberOr(remote.streakFreezes)), capacity),
    frozenDates: unionList(local.frozenDates, remote.frozenDates),
  };
}

/** A phone where nothing was played yet (a new phone, the app just installed) */
export function hasNotPlayed(state: State): boolean {
  return numberOr(state.xp) === 0
    && arrayOf(state.progress).length === 0
    && Object.keys(recordOf(state.dailyChallengeProgress)).length === 0
    && Object.keys(recordOf(state.weeklyChallengeProgress)).length === 0
    && Object.keys(recordOf(state.archiveProgress)).length === 0
    && arrayOf(state.createdLevels).length === 0
    && arrayOf(state.importedLevels).length === 0
    && arrayOf(state.achievements).length === 0;
}

/** JSON with the keys of every object sorted: two states that only differ by the order of their keys are equal */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v) => (isRecord(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    : v));
}

/** Whether the merge left this phone's state as it was: nothing to apply */
export function isSameSave(local: State, merged: State): boolean {
  return Object.keys(merged).every(field => canonical(local[field] ?? null) === canonical(merged[field] ?? null));
}

/**
 * This phone's progress merged with the cloud's (see the rules above). Only the fields the app
 * persists and exports are returned; the device settings (`DEVICE_FIELDS`) are left out by the caller.
 */
export function mergeSaves(local: State, remote: State): State {
  const xp = Math.max(numberOr(local.xp), numberOr(remote.xp));
  // The choices without a better value: this phone's, or the cloud's on a phone that has not played yet
  const main = hasNotPlayed(local) ? remote : local;

  const generatedLevels = mergeGenerated(arrayOf<Level>(local.generatedLevels), arrayOf<Level>(remote.generatedLevels));
  const createdLevels = mergeCustom(arrayOf<Level>(local.createdLevels), arrayOf<Level>(remote.createdLevels));
  const importedLevels = mergeCustom(arrayOf<Level>(local.importedLevels), arrayOf<Level>(remote.importedLevels));
  const mergedLevels = levelsById(sampleLevels, generatedLevels, createdLevels, importedLevels);
  const mapEnd = sampleLevels.length + generatedLevels.length + 1;

  // The daily and weekly levels in cache: the latest day's (the same puzzle on both for a given day)
  const daily = (remote.dailyLevelDate ?? '') > (local.dailyLevelDate ?? '') ? remote : local;
  const weekly = (remote.weeklyLevelKey ?? '') > (local.weeklyLevelKey ?? '') ? remote : local;

  const recapSince = local.recapSince === null || remote.recapSince === null
    ? null
    : [local.recapSince, remote.recapSince].filter((d): d is string => typeof d === 'string').sort()[0] ?? null;

  return {
    progress: mergeProgress(local, remote, mergedLevels),
    // An unlocked level stays unlocked, as far as the merged map goes
    maxUnlockedLevel: Math.max(numberOr(local.maxUnlockedLevel, 1), Math.min(numberOr(remote.maxUnlockedLevel, 1), mapEnd)),
    lastPlayedLevelId: main.lastPlayedLevelId ?? local.lastPlayedLevelId ?? remote.lastPlayedLevelId ?? null,
    generatedLevels,
    importedLevels,
    createdLevels,
    dailyChallengeProgress: mergeOneTry(recordOf(local.dailyChallengeProgress), recordOf(remote.dailyChallengeProgress)),
    weeklyChallengeProgress: mergeOneTry(recordOf(local.weeklyChallengeProgress), recordOf(remote.weeklyChallengeProgress)),
    archiveProgress: mergeBest(recordOf(local.archiveProgress), recordOf(remote.archiveProgress)),
    archiveLevels: { ...recordOf(remote.archiveLevels), ...recordOf(local.archiveLevels) },
    achievements: unionList(local.achievements, remote.achievements),
    stats: mergeStats(local.stats, remote.stats),
    monthlyStats: mergePeriods(local.monthlyStats, remote.monthlyStats),
    yearlyStats: mergePeriods(local.yearlyStats, remote.yearlyStats),
    achievementMonths: mergeAchievementMonths(local.achievementMonths, remote.achievementMonths),
    recapSince,
    recapsSeen: {
      ...(laterKey(local.recapsSeen?.month, remote.recapsSeen?.month) && { month: laterKey(local.recapsSeen?.month, remote.recapsSeen?.month) }),
      ...(laterKey(local.recapsSeen?.year, remote.recapsSeen?.year) && { year: laterKey(local.recapsSeen?.year, remote.recapsSeen?.year) }),
    },
    currentDailyLevel: daily.currentDailyLevel ?? null,
    dailyLevelDate: daily.dailyLevelDate ?? null,
    currentWeeklyLevel: weekly.currentWeeklyLevel ?? null,
    weeklyLevelKey: weekly.weeklyLevelKey ?? null,
    savedStates: mergeSavedStates(local.savedStates, remote.savedStates, knownLevels(local), knownLevels(remote)),
    isMusicEnabled: main.isMusicEnabled ?? local.isMusicEnabled,
    isHapticsEnabled: main.isHapticsEnabled ?? local.isHapticsEnabled,
    showVehicleLetters: main.showVehicleLetters ?? local.showVehicleLetters,
    themeMode: main.themeMode ?? local.themeMode,
    ...mergeStreak(local, remote, xp),
    dailyMissions: mergeMissions(local.dailyMissions ?? null, remote.dailyMissions ?? null),
    lastOpenDate: laterKey(local.lastOpenDate, remote.lastOpenDate),
    totalHintsUsed: Math.max(numberOr(local.totalHintsUsed), numberOr(remote.totalHintsUsed)),
    xp,
    cosmetics: { ...recordOf(local.cosmetics), ...recordOf(main.cosmetics) },
    seenCosmetics: unionList(local.seenCosmetics, remote.seenCosmetics),
    seenAchievements: unionList(local.seenAchievements, remote.seenAchievements),
  };
}
