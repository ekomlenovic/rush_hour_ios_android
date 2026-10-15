import type { ChallengeResult, PlayerStats } from './types';
import { addDays, computeDayRuns, daysBetween } from '../utils/date';

/** Streak rules: see docs/GAME_DESIGN.md (Streak et gels) */

export const MAX_STREAK_FREEZES = 2;
/** A freeze is earned every this many days of streak */
export const FREEZE_STREAK_INTERVAL = 7;

/** Store fields the streak is computed from */
export interface StreakState {
  currentStreak: number;
  bestStreak: number;
  lastStreakDate: string | null;
  streakFreezes: number;
  frozenDates: string[];
  stats: PlayerStats;
}

/**
 * Applies the days missed since the last daily: freezes cover them if there are enough,
 * otherwise the streak is lost (freezes are kept). Today itself can still be played.
 */
export function settleStreak(state: Omit<StreakState, 'bestStreak'>, today: string): {
  patch: Partial<StreakState>;
  frozenDays: number;
  lostStreak: number;
} {
  const { currentStreak, lastStreakDate, streakFreezes, frozenDates, stats } = state;
  if (!lastStreakDate || currentStreak === 0) return { patch: {}, frozenDays: 0, lostStreak: 0 };

  const missed = daysBetween(lastStreakDate, today) - 1;
  if (missed <= 0) return { patch: {}, frozenDays: 0, lostStreak: 0 };

  if (streakFreezes >= missed) {
    const covered = Array.from({ length: missed }, (_, i) => addDays(lastStreakDate, i + 1));
    return {
      patch: {
        streakFreezes: streakFreezes - missed,
        frozenDates: [...frozenDates, ...covered],
        // As if yesterday was played: today's daily continues the streak
        lastStreakDate: addDays(today, -1),
        stats: { ...stats, freezesUsed: stats.freezesUsed + missed },
      },
      frozenDays: missed,
      lostStreak: 0,
    };
  }
  return { patch: { currentStreak: 0 }, frozenDays: 0, lostStreak: currentStreak };
}

/** The streak after winning the daily of `dateKey` (missed days settled first) */
export function advanceStreak(state: StreakState, dateKey: string): Partial<StreakState> {
  if (state.lastStreakDate === dateKey) return {}; // Already counted today

  // Missed days may not have been settled yet (e.g. app opened on a deep link)
  const settled = settleStreak(state, dateKey).patch;
  const { lastStreakDate, currentStreak, bestStreak, streakFreezes, stats } = { ...state, ...settled };

  // Date keys are local dates: never parse them with new Date('YYYY-MM-DD') (UTC)
  const newStreak = lastStreakDate && daysBetween(lastStreakDate, dateKey) === 1
    ? currentStreak + 1
    : 1;
  const earnsFreeze = newStreak % FREEZE_STREAK_INTERVAL === 0 && streakFreezes < MAX_STREAK_FREEZES;

  return {
    ...settled,
    currentStreak: newStreak,
    bestStreak: Math.max(bestStreak, newStreak),
    lastStreakDate: dateKey,
    ...(earnsFreeze && {
      streakFreezes: streakFreezes + 1,
      stats: { ...stats, freezesEarned: stats.freezesEarned + 1 },
    }),
  };
}

/** Streak rebuilt from the completed daily challenges, never lower than the saved best */
export function recomputeStreak(state: Record<string, unknown>): Partial<Pick<StreakState, 'currentStreak' | 'bestStreak' | 'lastStreakDate'>> {
  const dailies = (state.dailyChallengeProgress || {}) as Record<string, ChallengeResult>;
  const completedKeys = Object.keys(dailies).filter(k => dailies[k]?.completed);
  if (completedKeys.length === 0) return {};

  const runs = computeDayRuns(completedKeys);
  return {
    currentStreak: runs.latest,
    bestStreak: Math.max(Number(state.bestStreak) || 0, runs.longest),
    lastStreakDate: runs.latestKey,
  };
}
