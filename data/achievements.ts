import type { ChallengeResult, Level, LevelProgress, PlayerStats } from '../store/gameStore';
import { computeDayRuns, parseLocalDateString } from '../utils/date';

export type AchievementCategory = 'progress' | 'mastery' | 'purity' | 'speed' | 'daily' | 'streak' | 'creator' | 'secret';

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'progress', 'mastery', 'purity', 'speed', 'daily', 'streak', 'creator', 'secret',
];

export interface AchievementDef {
  /** Also the i18n key: achievements.<id> and achievements.<id>_desc */
  id: string;
  icon: string;
  category: AchievementCategory;
  /** Shown as "???" until unlocked */
  hidden?: boolean;
  /** Unlocked when value(context) >= target */
  target: number;
  value: (c: AchievementContext) => number;
}

/** Store fields the achievements are computed from */
export interface AchievementSource {
  progress: LevelProgress[];
  dailyChallengeProgress: Record<string, ChallengeResult>;
  weeklyChallengeProgress: Record<string, ChallengeResult>;
  createdLevels: Level[];
  bestStreak: number;
  stats: PlayerStats;
}

export interface AchievementContext {
  completedLevels: number;
  perfectLevels: number;
  noHintLevels: number;
  noHelpLevels: number;
  dailies: number;
  perfectDailies: number;
  /** Longest run of consecutive days with a 3-star daily */
  perfectDailyRun: number;
  mondayDailies: number;
  fastestDailyMs: number | null;
  weeklies: number;
  bestStreak: number;
  createdLevels: number;
  hardestCreatedMoves: number;
  stats: PlayerStats;
}

export function buildAchievementContext(s: AchievementSource): AchievementContext {
  const completed = s.progress.filter(p => p.completed);
  const dailyEntries = Object.entries(s.dailyChallengeProgress).filter(([, r]) => r.completed);
  const perfectDailyKeys = dailyEntries.filter(([, r]) => r.stars === 3).map(([k]) => k);
  const dailyTimes = dailyEntries.map(([, r]) => r.timeMs).filter((t): t is number => t !== undefined);

  return {
    completedLevels: completed.length,
    perfectLevels: completed.filter(p => p.stars === 3).length,
    noHintLevels: completed.filter(p => p.noHint).length,
    noHelpLevels: completed.filter(p => p.noHelp).length,
    dailies: dailyEntries.length,
    perfectDailies: perfectDailyKeys.length,
    perfectDailyRun: computeDayRuns(perfectDailyKeys).longest,
    mondayDailies: dailyEntries.filter(([k]) => parseLocalDateString(k).getDay() === 1).length,
    fastestDailyMs: dailyTimes.length > 0 ? Math.min(...dailyTimes) : null,
    weeklies: Object.values(s.weeklyChallengeProgress).filter(r => r.completed).length,
    bestStreak: s.bestStreak,
    createdLevels: s.createdLevels.length,
    hardestCreatedMoves: Math.max(0, ...s.createdLevels.map(l => l.minMoves || 0)),
    stats: s.stats,
  };
}

const isUnder = (ms: number | null, limitMs: number) => (ms !== null && ms < limitMs ? 1 : 0);

/**
 * All achievements. IDs are persisted: never rename one, only add new ones.
 * Achievements of the daily challenge must respect its rules: no hint, undo or reset (see docs/GAME_DESIGN.md).
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // Progress
  { id: 'first_win', icon: '🚗', category: 'progress', target: 1, value: c => c.completedLevels },
  { id: 'novice', icon: '🌟', category: 'progress', target: 5, value: c => c.completedLevels },
  { id: 'expert', icon: '🏅', category: 'progress', target: 50, value: c => c.completedLevels },
  { id: 'veteran', icon: '🎖️', category: 'progress', target: 100, value: c => c.completedLevels },
  { id: 'levels_250', icon: '🏆', category: 'progress', target: 250, value: c => c.completedLevels },
  { id: 'levels_500', icon: '👑', category: 'progress', target: 500, value: c => c.completedLevels },

  // Mastery
  { id: 'perfectionist', icon: '⭐', category: 'mastery', target: 10, value: c => c.perfectLevels },
  { id: 'perfect_50', icon: '🌠', category: 'mastery', target: 50, value: c => c.perfectLevels },
  { id: 'perfect_100', icon: '💫', category: 'mastery', target: 100, value: c => c.perfectLevels },
  { id: 'master_driver', icon: '🧠', category: 'mastery', target: 40, value: c => c.stats.hardestWinMoves },
  { id: 'big_grid', icon: '🗺️', category: 'mastery', target: 1, value: c => c.stats.winsByGridSize['8'] || 0 },

  // Purity (map and custom levels only: the daily never has hints)
  { id: 'clean_run', icon: '🎯', category: 'purity', target: 1, value: c => c.noHelpLevels },
  { id: 'no_hint_25', icon: '🧘', category: 'purity', target: 25, value: c => c.noHintLevels },
  { id: 'no_hint_100', icon: '🦉', category: 'purity', target: 100, value: c => c.noHintLevels },

  // Speed
  { id: 'speed_30', icon: '⚡', category: 'speed', target: 1, value: c => isUnder(c.stats.fastestWinMs, 30_000) },
  { id: 'daily_sprint', icon: '⏱️', category: 'speed', target: 1, value: c => isUnder(c.fastestDailyMs, 60_000) },

  // Daily & weekly challenges
  { id: 'daily_winner', icon: '📅', category: 'daily', target: 1, value: c => c.dailies },
  { id: 'daily_devotee', icon: '📆', category: 'daily', target: 7, value: c => c.dailies },
  { id: 'daily_30', icon: '🗓️', category: 'daily', target: 30, value: c => c.dailies },
  { id: 'daily_100', icon: '💯', category: 'daily', target: 100, value: c => c.dailies },
  { id: 'daily_perfect', icon: '✨', category: 'daily', target: 1, value: c => c.perfectDailies },
  { id: 'daily_perfect_7', icon: '🌈', category: 'daily', target: 7, value: c => c.perfectDailyRun },
  { id: 'monday_survivor', icon: '💀', category: 'daily', target: 1, value: c => c.mondayDailies },
  { id: 'weekly_warrior', icon: '⚔️', category: 'daily', target: 1, value: c => c.weeklies },
  { id: 'weekly_4', icon: '🛡️', category: 'daily', target: 4, value: c => c.weeklies },

  // Streak
  { id: 'streak_3', icon: '🔥', category: 'streak', target: 3, value: c => c.bestStreak },
  { id: 'streak_7', icon: '🔥', category: 'streak', target: 7, value: c => c.bestStreak },
  { id: 'streak_30', icon: '🔥', category: 'streak', target: 30, value: c => c.bestStreak },
  { id: 'streak_100', icon: '☄️', category: 'streak', target: 100, value: c => c.bestStreak },
  { id: 'streak_365', icon: '🌋', category: 'streak', target: 365, value: c => c.bestStreak },

  // Creator & sharing
  { id: 'creator_star', icon: '🎨', category: 'creator', target: 5, value: c => c.createdLevels },
  { id: 'creator_puzzle', icon: '🧩', category: 'creator', target: 20, value: c => c.hardestCreatedMoves },
  { id: 'sharer', icon: '📤', category: 'creator', target: 1, value: c => c.stats.levelsShared },
  { id: 'importer', icon: '📥', category: 'creator', target: 1, value: c => c.stats.levelsImported },

  // Secrets
  { id: 'night_owl', icon: '🌙', category: 'secret', hidden: true, target: 1, value: c => c.stats.nightWins },
  { id: 'new_year', icon: '🎆', category: 'secret', hidden: true, target: 1, value: c => c.stats.newYearWins },
  { id: 'undo_500', icon: '⏪', category: 'secret', hidden: true, target: 500, value: c => c.stats.totalUndos },
  { id: 'comeback_30', icon: '🏡', category: 'secret', hidden: true, target: 30, value: c => c.stats.longestAbsenceDays },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a]),
);
