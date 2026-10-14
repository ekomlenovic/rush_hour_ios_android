import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { sampleLevels } from '../data/sampleLevels';
import { ACHIEVEMENTS, buildAchievementContext } from '../data/achievements';
import { getLocalDateString, daysBetween, computeDayRuns } from '../utils/date';

/** Reserved level IDs for challenges (excluded from map progression) */
export const DAILY_LEVEL_ID = 999999;
export const WEEKLY_LEVEL_ID = 999998;

/** Describes a single vehicle/block on the grid */
export interface Vehicle {
  id: string;
  /** Row (for vertical) or Row (for horizontal) — top-left cell */
  row: number;
  /** Column — top-left cell */
  col: number;
  /** Number of cells this vehicle occupies (2 or 3 typically) */
  length: number;
  /** Movement axis */
  orientation: 'horizontal' | 'vertical';
  /** Whether this is the target vehicle that must exit */
  isTarget: boolean;
  /** Color used for rendering */
  color: string;
}

/** Describes a level */
export interface Level {
  id: number;
  /** Grid dimensions (e.g. 6 for 6×6, 7 for 7×7, etc.) */
  gridSize: number;
  /** Initial vehicle placements */
  vehicles: Vehicle[];
  /** Exit position: row & col of the exit cell on the grid edge */
  exitRow: number;
  exitCol: number;
  /** Minimum number of moves to solve (computed by BFS solver) */
  minMoves: number;
  /** Timestamp of creation/last modification */
  updatedAt: number;
  /** Whether the level is marked as a favorite */
  isFavorite?: boolean;
}

/** Player progress for a specific level */
export interface LevelProgress {
  levelId: number;
  completed: boolean;
  bestScore: number;
  stars?: number;
  /** Fastest win, in milliseconds of active play */
  bestTimeMs?: number;
  /** Won at least once without using a hint */
  noHint?: boolean;
  /** Won at least once without hint nor undo */
  noHelp?: boolean;
}

/** Help used during the current attempt of a level */
export interface AttemptStats {
  hints: number;
  undos: number;
  resets: number;
  /** Active play time (app in foreground, game screen open) */
  elapsedMs: number;
}

/** Saved state for an ongoing level session */
export interface LevelSaveState {
  vehicles: Vehicle[];
  moveCount: number;
  history: Vehicle[][];
  attempt?: AttemptStats;
}

/** Result of a daily or weekly challenge */
export interface ChallengeResult {
  completed: boolean;
  score: number;
  stars: number;
  timeMs?: number;
}

/** Lifetime player statistics */
export interface PlayerStats {
  totalPlayTimeMs: number;
  totalMoves: number;
  totalUndos: number;
  totalResets: number;
  totalWins: number;
  /** Wins without any reset during the attempt */
  firstTryWins: number;
  /** Wins per grid size, keyed by size ('6', '7', '8') */
  winsByGridSize: Record<string, number>;
  levelsShared: number;
  levelsImported: number;
  /** Highest minMoves of a level ever won */
  hardestWinMoves: number;
  /** Fastest win on a level of at least 10 optimal moves */
  fastestWinMs: number | null;
  /** Wins between midnight and 5 AM */
  nightWins: number;
  /** Wins on January 1st */
  newYearWins: number;
  /** Wins on special days, keyed by 'MM-DD' (e.g. '12-25') or 'fri13' */
  specialDayWins: Record<string, number>;
  /** Longest active time spent on a level before winning it */
  longestWinMs: number;
  /** Most resets during a winning attempt */
  maxResetsBeforeWin: number;
  /** Highest minMoves of a level won with 3 stars */
  hardestPerfectMoves: number;
  /** Daily challenges won between 5 and 7 AM */
  earlyDailyWins: number;
  /** Weekly challenges won on Sunday, the last day */
  lastMinuteWeeklies: number;
  /** Longest absence between two app opens, in days */
  longestAbsenceDays: number;
}

interface GenerationState {
  isRunning: boolean;
  current: number;
  total: number;
  shouldCancel: boolean;
  estimatedRemainingSeconds: number;
}

interface GameState {
  /** Currently loaded level data */
  currentLevel: Level | null;
  /** Current vehicle positions during gameplay */
  vehicles: Vehicle[];
  /** Number of moves made so far */
  moveCount: number;
  /** History stack for undo functionality */
  history: Vehicle[][];
  /** Help used during the current attempt */
  currentAttempt: AttemptStats;
  /** Player's progress across all levels */
  progress: LevelProgress[];
  /** The highest unlocked level id */
  maxUnlockedLevel: number;
  /** The id of the last played level to resume map position */
  lastPlayedLevelId: number | null;
  /** Infinite Map: Dynamically generated levels that are saved locally */
  generatedLevels: Level[];
  /** Imported levels from others via QR/link */
  importedLevels: Level[];
  /** Levels created by the user */
  createdLevels: Level[];

  /** Periodic/Daily progress: keyed by date string (YYYY-MM-DD) */
  dailyChallengeProgress: Record<string, ChallengeResult>;
  /** Weekly progress: keyed by ISO week (YYYY-Www) */
  weeklyChallengeProgress: Record<string, ChallengeResult>;

  /** List of unlocked achievement IDs */
  achievements: string[];
  /** Achievements unlocked but not shown to the player yet (not persisted) */
  unlockQueue: string[];

  /** Lifetime statistics */
  stats: PlayerStats;

  /** Daily challenge state for caching */
  currentDailyLevel: Level | null;
  dailyLevelDate: string | null;
  /** Weekly challenge state for caching */
  currentWeeklyLevel: Level | null;
  weeklyLevelKey: string | null;
  generationState: GenerationState;

  /** Per-level saved state (to prevent reset on leave), keyed by levelId, "daily-YYYY-MM-DD" or "weekly-YYYY-Www" */
  savedStates: Record<string | number, LevelSaveState>;

  /** Audio Enabled state */
  isMusicEnabled: boolean;
  /** Haptics Enabled state */
  isHapticsEnabled: boolean;

  /** Streak tracking */
  currentStreak: number;
  bestStreak: number;
  lastStreakDate: string | null;

  /** Last time the app was opened (ISO date YYYY-MM-DD) for comeback detection */
  lastOpenDate: string | null;

  /** Total number of hints ever used */
  totalHintsUsed: number;

  // Actions
  loadLevel: (level: Level, savedState?: LevelSaveState) => void;
  moveVehicle: (vehicleId: string, newRow: number, newCol: number) => void;
  undo: () => void;
  resetLevel: () => void;
  recordHintUsed: () => void;
  addPlayTime: (ms: number) => void;
  completeLevel: (levelId: number, score: number, stars: number, timeMs?: number) => void;
  completeDailyChallenge: (dateKey: string, score: number, stars: number, timeMs?: number) => void;
  completeWeeklyChallenge: (weekKey: string, score: number, stars: number, timeMs?: number) => void;
  checkAchievements: (options?: { silent?: boolean }) => void;
  consumeUnlockQueue: () => string[];
  recordLevelShared: () => void;
  addGeneratedLevel: (level: Level) => void;
  addImportedLevel: (level: Level) => void;
  saveCreatedLevel: (level: Level) => void;
  deleteCustomLevel: (id: number, type: 'imported' | 'created') => void;
  toggleFavorite: (id: number, type: 'imported' | 'created') => void;

  purgeCustomLevels: (baseLevelCount: number) => void;
  toggleMusicEnabled: () => void;
  toggleHapticsEnabled: () => void;
  unlockAllLevels: () => void;
  setGenerationState: (state: Partial<GenerationState>) => void;
  cancelGeneration: () => void;
  hardReset: () => void;
  updateStreak: (dateKey: string) => void;
  recordAppOpen: () => { isComeback: boolean; missedDays: number };
}

const emptyAttempt = (): AttemptStats => ({ hints: 0, undos: 0, resets: 0, elapsedMs: 0 });

const initialStats = (): PlayerStats => ({
  totalPlayTimeMs: 0,
  totalMoves: 0,
  totalUndos: 0,
  totalResets: 0,
  totalWins: 0,
  firstTryWins: 0,
  winsByGridSize: {},
  levelsShared: 0,
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
  longestAbsenceDays: 0,
});

/** Below this many optimal moves, a fast win is too easy to count for the speed record */
const SPEED_RECORD_MIN_MOVES = 10;

/** Key under which a level's in-progress state is saved */
function getLevelKey(level: Level, dailyLevelDate: string | null, weeklyLevelKey: string | null): string | number {
  if (level.id === DAILY_LEVEL_ID && dailyLevelDate) return `daily-${dailyLevelDate}`;
  if (level.id === WEEKLY_LEVEL_ID && weeklyLevelKey) return `weekly-${weeklyLevelKey}`;
  return level.id;
}

/** Special days counted for secret achievements */
function getSpecialDayKeys(now: Date): string[] {
  const keys = [`${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`];
  if (now.getDay() === 5 && now.getDate() === 13) keys.push('fri13');
  return keys;
}

type WinKind = 'level' | 'daily' | 'weekly';

/** Stats after winning the current level with the given attempt */
function withWinStats(stats: PlayerStats, level: Level, attempt: AttemptStats, timeMs: number | undefined, stars: number, kind: WinKind): PlayerStats {
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

/** Streak rebuilt from the completed daily challenges, never lower than the saved best */
function recomputeStreak(state: Record<string, unknown>): Partial<Pick<GameState, 'currentStreak' | 'bestStreak' | 'lastStreakDate'>> {
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

function mergeChallengeResult(existing: ChallengeResult | undefined, score: number, stars: number, timeMs?: number): ChallengeResult {
  const times = [existing?.timeMs, timeMs].filter((t): t is number => t !== undefined);
  return {
    completed: true,
    score: Math.max(existing?.score || 0, score),
    stars: Math.max(existing?.stars || 0, stars),
    timeMs: times.length > 0 ? Math.min(...times) : undefined,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      /** Updates the in-progress state and mirrors it into savedStates */
      const saveSnapshot = (partial: Partial<Pick<GameState, 'vehicles' | 'moveCount' | 'history' | 'currentAttempt' | 'stats' | 'totalHintsUsed'>>) => {
        const state = get();
        if (!state.currentLevel) return;
        const next = { ...state, ...partial };
        const levelKey = getLevelKey(state.currentLevel, state.dailyLevelDate, state.weeklyLevelKey);

        set({
          ...partial,
          savedStates: {
            ...state.savedStates,
            [levelKey]: {
              vehicles: next.vehicles.map(v => ({ ...v })),
              moveCount: next.moveCount,
              history: next.history.map(h => h.map(v => ({ ...v }))),
              attempt: { ...next.currentAttempt },
            }
          }
        });
      };

      return {
      currentLevel: null,
      vehicles: [],
      moveCount: 0,
      history: [],
      currentAttempt: emptyAttempt(),
      progress: [],
      maxUnlockedLevel: 1,
      lastPlayedLevelId: null,
      generatedLevels: [],
      importedLevels: [],
      createdLevels: [],
      dailyChallengeProgress: {},
      weeklyChallengeProgress: {},
      achievements: [],
      unlockQueue: [],
      stats: initialStats(),
      currentDailyLevel: null,
      dailyLevelDate: null,
      currentWeeklyLevel: null,
      weeklyLevelKey: null,
      savedStates: {},
      isMusicEnabled: true,
      isHapticsEnabled: true,
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDate: null,
      lastOpenDate: null,
      totalHintsUsed: 0,
      generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },

      loadLevel: (level, savedState) => {
        const state = get();
        const levelKey = getLevelKey(level, state.dailyLevelDate, state.weeklyLevelKey);
        const resolvedSavedState = savedState || state.savedStates[levelKey];

        set({
          currentLevel: level,
          vehicles: resolvedSavedState ? resolvedSavedState.vehicles.map(v => ({...v})) : level.vehicles.map((v) => ({ ...v })),
          moveCount: resolvedSavedState ? resolvedSavedState.moveCount : 0,
          history: resolvedSavedState ? resolvedSavedState.history.map(h => h.map(v => ({...v}))) : [],
          currentAttempt: resolvedSavedState?.attempt ? { ...resolvedSavedState.attempt } : emptyAttempt(),
          lastPlayedLevelId: (level.id >= 900000) ? state.lastPlayedLevelId : level.id,
        });
      },

      moveVehicle: (vehicleId, newRow, newCol) => {
        const { vehicles, history, moveCount, currentLevel, stats } = get();
        if (!currentLevel) return;

        const snapshot = vehicles.map((v) => ({ ...v }));
        const updated = vehicles.map((v) =>
          v.id === vehicleId ? { ...v, row: newRow, col: newCol } : v
        );

        saveSnapshot({
          vehicles: updated,
          moveCount: moveCount + 1,
          history: [...history, snapshot],
          stats: { ...stats, totalMoves: stats.totalMoves + 1 },
        });
      },

      undo: () => {
        const { history, moveCount, currentLevel, currentAttempt, stats } = get();
        if (history.length === 0 || !currentLevel) return;

        // Undo counts as a move (see docs/GAME_DESIGN.md)
        saveSnapshot({
          vehicles: history[history.length - 1],
          history: history.slice(0, -1),
          moveCount: moveCount + 1,
          currentAttempt: { ...currentAttempt, undos: currentAttempt.undos + 1 },
          stats: { ...stats, totalUndos: stats.totalUndos + 1 },
        });
      },

      resetLevel: () => {
        const { currentLevel, currentAttempt, stats } = get();
        if (!currentLevel) return;

        // Keep the attempt so hints, undos and time spent before the reset still count
        saveSnapshot({
          vehicles: currentLevel.vehicles.map((v) => ({ ...v })),
          moveCount: 0,
          history: [],
          currentAttempt: { ...currentAttempt, resets: currentAttempt.resets + 1 },
          stats: { ...stats, totalResets: stats.totalResets + 1 },
        });
      },

      recordHintUsed: () => {
        const { currentAttempt, totalHintsUsed } = get();
        saveSnapshot({
          currentAttempt: { ...currentAttempt, hints: currentAttempt.hints + 1 },
          totalHintsUsed: totalHintsUsed + 1,
        });
      },

      addPlayTime: (ms) => {
        if (ms <= 0) return;
        const { currentAttempt, stats } = get();
        saveSnapshot({
          currentAttempt: { ...currentAttempt, elapsedMs: currentAttempt.elapsedMs + ms },
          stats: { ...stats, totalPlayTimeMs: stats.totalPlayTimeMs + ms },
        });
      },

      completeLevel: (levelId, score, stars, timeMs) => {
        const { progress, maxUnlockedLevel, savedStates, currentLevel, currentAttempt, stats } = get();

        // The tutorial completes a level that is not loaded: no attempt to record
        const isCurrentLevel = currentLevel?.id === levelId;
        const noHint = isCurrentLevel && currentAttempt.hints === 0;
        const noHelp = noHint && currentAttempt.undos === 0;
        const winTime = isCurrentLevel ? timeMs : undefined;

        const existing = progress.find((p) => p.levelId === levelId);
        let updatedProgress: LevelProgress[];
        if (existing) {
          updatedProgress = progress.map((p) =>
            p.levelId === levelId
              ? {
                  ...p,
                  completed: true,
                  bestScore: Math.max(p.bestScore, score),
                  stars: Math.max(p.stars || 0, stars),
                  bestTimeMs: winTime !== undefined ? Math.min(p.bestTimeMs ?? Infinity, winTime) : p.bestTimeMs,
                  noHint: p.noHint || noHint,
                  noHelp: p.noHelp || noHelp,
                }
              : p
          );
        } else {
          updatedProgress = [...progress, { levelId, completed: true, bestScore: score, stars, bestTimeMs: winTime, noHint, noHelp }];
        }

        const newSavedStates = { ...savedStates };
        delete newSavedStates[levelId];

        // Only advance map progression for map-based levels (Campaign + Generated)
        // Daily/Weekly Challenges and Custom Levels (timestamps) are excluded
        const isMapLevel = levelId < 900000;

        set({
          progress: updatedProgress,
          maxUnlockedLevel: isMapLevel ? Math.max(maxUnlockedLevel, levelId + 1) : maxUnlockedLevel,
          savedStates: newSavedStates,
          stats: isCurrentLevel && currentLevel ? withWinStats(stats, currentLevel, currentAttempt, timeMs, stars, 'level') : stats,
          currentAttempt: emptyAttempt(),
        });
        get().checkAchievements();
      },

      completeDailyChallenge: (dateKey, score, stars, timeMs) => {
        const { dailyChallengeProgress, savedStates, currentLevel, currentAttempt, stats } = get();
        const newSavedStates = { ...savedStates };
        delete newSavedStates[`daily-${dateKey}`];

        set({
          dailyChallengeProgress: {
            ...dailyChallengeProgress,
            [dateKey]: mergeChallengeResult(dailyChallengeProgress[dateKey], score, stars, timeMs),
          },
          savedStates: newSavedStates,
          stats: currentLevel?.id === DAILY_LEVEL_ID ? withWinStats(stats, currentLevel, currentAttempt, timeMs, stars, 'daily') : stats,
          currentAttempt: emptyAttempt(),
        });

        // Update streak
        get().updateStreak(dateKey);

        get().checkAchievements();
      },

      completeWeeklyChallenge: (weekKey, score, stars, timeMs) => {
        const { weeklyChallengeProgress, savedStates, currentLevel, currentAttempt, stats } = get();
        const newSavedStates = { ...savedStates };
        delete newSavedStates[`weekly-${weekKey}`];

        set({
          weeklyChallengeProgress: {
            ...weeklyChallengeProgress,
            [weekKey]: mergeChallengeResult(weeklyChallengeProgress[weekKey], score, stars, timeMs),
          },
          savedStates: newSavedStates,
          stats: currentLevel?.id === WEEKLY_LEVEL_ID ? withWinStats(stats, currentLevel, currentAttempt, timeMs, stars, 'weekly') : stats,
          currentAttempt: emptyAttempt(),
        });
        get().checkAchievements();
      },

      checkAchievements: (options) => {
        const state = get();
        const context = buildAchievementContext(state);
        const newlyUnlocked = ACHIEVEMENTS
          .filter(a => !state.achievements.includes(a.id) && a.value(context) >= a.target)
          .map(a => a.id);

        if (newlyUnlocked.length === 0) return;

        if (options?.silent) {
          set({ achievements: [...state.achievements, ...newlyUnlocked] });
          return;
        }

        set({
          achievements: [...state.achievements, ...newlyUnlocked],
          unlockQueue: [...state.unlockQueue, ...newlyUnlocked],
        });
        if (state.isHapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },

      consumeUnlockQueue: () => {
        const { unlockQueue } = get();
        if (unlockQueue.length > 0) set({ unlockQueue: [] });
        return unlockQueue;
      },

      recordLevelShared: () => {
        const { stats } = get();
        set({ stats: { ...stats, levelsShared: stats.levelsShared + 1 } });
        get().checkAchievements();
      },

      updateStreak: (dateKey: string) => {
        const { lastStreakDate, currentStreak, bestStreak } = get();

        if (lastStreakDate === dateKey) return; // Already counted today

        // Date keys are local dates: never parse them with new Date('YYYY-MM-DD') (UTC)
        let newStreak: number;
        if (lastStreakDate && daysBetween(lastStreakDate, dateKey) === 1) {
          newStreak = currentStreak + 1;
        } else if (!lastStreakDate) {
          newStreak = 1;
        } else {
          newStreak = 1; // Streak broken
        }

        set({
          currentStreak: newStreak,
          bestStreak: Math.max(bestStreak, newStreak),
          lastStreakDate: dateKey,
        });
      },

      recordAppOpen: () => {
        const { lastOpenDate, stats } = get();
        const today = getLocalDateString(new Date());

        let isComeback = false;
        let missedDays = 0;

        if (lastOpenDate) {
          missedDays = Math.max(0, daysBetween(lastOpenDate, today));
          isComeback = missedDays >= 3;
        }

        set({
          lastOpenDate: today,
          stats: { ...stats, longestAbsenceDays: Math.max(stats.longestAbsenceDays, missedDays) },
        });
        get().checkAchievements();
        return { isComeback, missedDays };
      },

      addGeneratedLevel: (level) => {
        const { generatedLevels } = get();
        if (!generatedLevels.find((l) => l.id === level.id)) {
          set({ generatedLevels: [...generatedLevels, level] });
        }
      },

      addImportedLevel: (level) => {
        const { importedLevels, stats } = get();
        if (!importedLevels.find(l => l.id === level.id)) {
          set({
            importedLevels: [...importedLevels, { ...level, updatedAt: level.updatedAt || Date.now() }],
            stats: { ...stats, levelsImported: stats.levelsImported + 1 },
          });
          get().checkAchievements();
        }
      },

      saveCreatedLevel: (level) => {
        const { createdLevels } = get();
        const index = createdLevels.findIndex(l => l.id === level.id);
        const updatedLevel = { ...level, updatedAt: Date.now() };
        if (index !== -1) {
          const updated = [...createdLevels];
          updated[index] = updatedLevel;
          set({ createdLevels: updated });
        } else {
          set({ createdLevels: [...createdLevels, updatedLevel] });
        }
        get().checkAchievements();
      },

      toggleFavorite: (id, type) => {
        if (type === 'imported') {
          const updated = get().importedLevels.map(l =>
            l.id === id ? { ...l, isFavorite: !l.isFavorite } : l
          );
          set({ importedLevels: updated });
        } else {
          const updated = get().createdLevels.map(l =>
            l.id === id ? { ...l, isFavorite: !l.isFavorite } : l
          );
          set({ createdLevels: updated });
        }
      },

      deleteCustomLevel: (id, type) => {
        if (type === 'imported') {
          set({ importedLevels: get().importedLevels.filter(l => l.id !== id) });
        } else {
          set({ createdLevels: get().createdLevels.filter(l => l.id !== id) });
        }
      },

      purgeCustomLevels: (baseLevelCount) => {
        const { progress, maxUnlockedLevel } = get();
        const cleanedProgress = progress.filter(p => p.levelId <= baseLevelCount);
        const clampedUnlocked = Math.min(maxUnlockedLevel, baseLevelCount + 1);

        set({
          generatedLevels: [],
          progress: cleanedProgress,
          maxUnlockedLevel: clampedUnlocked,
        });
      },

      toggleMusicEnabled: () => {
        const { isMusicEnabled } = get();
        set({ isMusicEnabled: !isMusicEnabled });
      },
      toggleHapticsEnabled: () => {
        const { isHapticsEnabled } = get();
        set({ isHapticsEnabled: !isHapticsEnabled });
      },

      unlockAllLevels: () => {
        const { generatedLevels } = get();
        const totalLevels = sampleLevels.length + generatedLevels.length;
        set({ maxUnlockedLevel: Math.max(1, totalLevels) });
      },

      setGenerationState: (state) => set((s) => ({ generationState: { ...s.generationState, ...state } })),

      cancelGeneration: () => {
        const current = get().generationState;
        set({ generationState: { ...current, shouldCancel: true } });
      },

      hardReset: () => {
        set({
          progress: [],
          maxUnlockedLevel: 1,
          lastPlayedLevelId: null,
          generatedLevels: [],
          importedLevels: [],
          createdLevels: [],
          currentLevel: null,
          vehicles: [],
          moveCount: 0,
          history: [],
          currentAttempt: emptyAttempt(),
          generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },
          dailyChallengeProgress: {},
          weeklyChallengeProgress: {},
          achievements: [],
          unlockQueue: [],
          stats: initialStats(),
          currentDailyLevel: null,
          dailyLevelDate: null,
          currentWeeklyLevel: null,
          weeklyLevelKey: null,
          savedStates: {},
          currentStreak: 0,
          bestStreak: 0,
          lastStreakDate: null,
          lastOpenDate: null,
          totalHintsUsed: 0,
        });
      },
      };
    },
    {
      name: 'rush-hour-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState, version) => {
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
        return state as unknown as GameState;
      },
      // Deep-merge stats so fields added in later versions get their defaults
      merge: (persistedState, currentState) => {
        const persisted = (persistedState || {}) as Partial<GameState>;
        return {
          ...currentState,
          ...persisted,
          stats: { ...currentState.stats, ...persisted.stats },
        };
      },
      // Unlock achievements already earned (e.g. new ones after an update) without a toast flood
      onRehydrateStorage: () => (state) => {
        state?.checkAchievements({ silent: true });
      },
      partialize: (state) => ({
        progress: state.progress,
        maxUnlockedLevel: state.maxUnlockedLevel,
        lastPlayedLevelId: state.lastPlayedLevelId,
        generatedLevels: state.generatedLevels,
        importedLevels: state.importedLevels,
        createdLevels: state.createdLevels,
        dailyChallengeProgress: state.dailyChallengeProgress,
        weeklyChallengeProgress: state.weeklyChallengeProgress,
        achievements: state.achievements,
        stats: state.stats,
        currentDailyLevel: state.currentDailyLevel,
        dailyLevelDate: state.dailyLevelDate,
        currentWeeklyLevel: state.currentWeeklyLevel,
        weeklyLevelKey: state.weeklyLevelKey,
        savedStates: state.savedStates,
        isMusicEnabled: state.isMusicEnabled,
        isHapticsEnabled: state.isHapticsEnabled,
        generationState: state.generationState,
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        lastStreakDate: state.lastStreakDate,
        lastOpenDate: state.lastOpenDate,
        totalHintsUsed: state.totalHintsUsed,
      }),
    }
  )
);
