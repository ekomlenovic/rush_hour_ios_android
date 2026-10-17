import type { AttemptStats, ChallengeDetails, ChallengeResult, Level, PlayerStats } from './types';

export const emptyAttempt = (): AttemptStats => ({ hints: 0, undos: 0, resets: 0, elapsedMs: 0 });

export const initialStats = (): PlayerStats => ({
  totalPlayTimeMs: 0,
  totalMoves: 0,
  totalUndos: 0,
  totalResets: 0,
  totalWins: 0,
  firstTryWins: 0,
  winsByGridSize: {},
  levelsShared: 0,
  resultsShared: 0,
  levelsImported: 0,
  hardestWinMoves: 0,
  fastestWinMs: null,
  nightWins: 0,
  newYearWins: 0,
  specialDayWins: {},
  longestWinMs: 0,
  maxResetsBeforeWin: 0,
  hardestPerfectMoves: 0,
  earlyDailyWins: 0,
  lastMinuteWeeklies: 0,
  freezesEarned: 0,
  freezesUsed: 0,
  missionDaysCompleted: 0,
  longestAbsenceDays: 0,
});

/** Below this many optimal moves, a fast win is too easy to count for the speed record */
export const SPEED_RECORD_MIN_MOVES = 10;

/** Special days counted for secret achievements */
export function getSpecialDayKeys(now: Date): string[] {
  const keys = [`${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`];
  if (now.getDay() === 5 && now.getDate() === 13) keys.push('fri13');
  return keys;
}

export type WinKind = 'level' | 'daily' | 'weekly' | 'archive';

/** Stats after winning the current level with the given attempt */
export function withWinStats(stats: PlayerStats, level: Level, attempt: AttemptStats, timeMs: number | undefined, stars: number, kind: WinKind): PlayerStats {
  const now = new Date();
  const gridKey = String(level.gridSize);
  const countsForSpeed = timeMs !== undefined && level.minMoves >= SPEED_RECORD_MIN_MOVES;
  const specialDayWins = { ...stats.specialDayWins };
  for (const key of getSpecialDayKeys(now)) specialDayWins[key] = (specialDayWins[key] || 0) + 1;
  return {
    ...stats,
    totalWins: stats.totalWins + 1,
    firstTryWins: stats.firstTryWins + (attempt.resets === 0 ? 1 : 0),
    winsByGridSize: { ...stats.winsByGridSize, [gridKey]: (stats.winsByGridSize[gridKey] || 0) + 1 },
    hardestWinMoves: Math.max(stats.hardestWinMoves, level.minMoves),
    fastestWinMs: countsForSpeed
      ? Math.min(stats.fastestWinMs ?? Infinity, timeMs)
      : stats.fastestWinMs,
    nightWins: stats.nightWins + (now.getHours() < 5 ? 1 : 0),
    newYearWins: stats.newYearWins + (now.getMonth() === 0 && now.getDate() === 1 ? 1 : 0),
    specialDayWins,
    longestWinMs: Math.max(stats.longestWinMs, timeMs ?? 0),
    maxResetsBeforeWin: Math.max(stats.maxResetsBeforeWin, attempt.resets),
    hardestPerfectMoves: stars === 3 ? Math.max(stats.hardestPerfectMoves, level.minMoves) : stats.hardestPerfectMoves,
    earlyDailyWins: stats.earlyDailyWins + (kind === 'daily' && now.getHours() >= 5 && now.getHours() < 7 ? 1 : 0),
    lastMinuteWeeklies: stats.lastMinuteWeeklies + (kind === 'weekly' && now.getDay() === 0 ? 1 : 0),
  };
}

/** Best result of a daily or weekly challenge, merged with a new win */
export function mergeChallengeResult(existing: ChallengeResult | undefined, score: number, stars: number, timeMs?: number, details?: ChallengeDetails): ChallengeResult {
  const times = [existing?.timeMs, timeMs].filter((t): t is number => t !== undefined);
  const isBest = !existing || score >= existing.score;
  const moves = isBest ? details?.moves ?? existing?.moves : existing?.moves;
  const minMoves = details?.minMoves ?? existing?.minMoves;
  const moveLog = isBest ? details?.moveLog ?? existing?.moveLog : existing?.moveLog;
  return {
    completed: true,
    score: Math.max(existing?.score || 0, score),
    stars: Math.max(existing?.stars || 0, stars),
    timeMs: times.length > 0 ? Math.min(...times) : undefined,
    ...(moves !== undefined && { moves }),
    ...(minMoves !== undefined && { minMoves }),
    ...(moveLog !== undefined && { moveLog: moveLog.map(m => ({ ...m })) }),
  };
}
