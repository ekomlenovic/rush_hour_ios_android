import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { sampleLevels } from '../data/sampleLevels';
import { ACHIEVEMENTS, buildAchievementContext } from '../data/achievements';
import { DEFAULT_REMINDER_HOUR } from '../utils/reminders';
import { DailyMissionsState, MissionCounter, MISSIONS_BY_ID, getMissionsForDay, isMissionDone } from '../data/missions';
import { getLocalDateString, daysBetween } from '../utils/date';
import type {
  AppOpenInfo, AttemptStats, ChallengeDetails, ChallengeResult, Level, LevelProgress, LevelSaveState, PlayerStats, ThemeMode, Vehicle,
} from './types';
import { MAX_STREAK_FREEZES, settleStreak, advanceStreak } from './streak';
import { emptyAttempt, initialStats, withWinStats, mergeChallengeResult } from './stats';
import { STORE_VERSION, migrateState, relocateGeneratedLevels } from './migrations';

export type * from './types';
export { MAX_STREAK_FREEZES };

/** Reserved level IDs for challenges (excluded from map progression) */
export const DAILY_LEVEL_ID = 999999;
export const WEEKLY_LEVEL_ID = 999998;

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
  /** Letters on the vehicles, to tell them apart without colors (accessibility) */
  showVehicleLetters: boolean;
  /** Light / dark choice of the interface */
  themeMode: ThemeMode;
  /** Local reminders (opt-in) */
  notificationsEnabled: boolean;
  /** Hour of the daily challenge reminder (0-23) */
  reminderHour: number;
  /** The player was already asked about reminders */
  notificationsPrompted: boolean;

  /** Streak tracking */
  currentStreak: number;
  bestStreak: number;
  lastStreakDate: string | null;
  /** Streak freezes in stock: each one covers a missed day (see docs/GAME_DESIGN.md) */
  streakFreezes: number;
  /** Days covered by a freeze, shown in the calendar */
  frozenDates: string[];

  /** Today's missions and their counters */
  dailyMissions: DailyMissionsState | null;
  /** All missions of the day just completed, not shown to the player yet (not persisted) */
  pendingMissionReward: { freezeGranted: boolean } | null;

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
  completeDailyChallenge: (dateKey: string, score: number, stars: number, timeMs?: number, details?: ChallengeDetails) => void;
  completeWeeklyChallenge: (weekKey: string, score: number, stars: number, timeMs?: number, details?: ChallengeDetails) => void;
  checkAchievements: (options?: { silent?: boolean }) => void;
  consumeUnlockQueue: () => string[];
  recordLevelShared: () => void;
  recordResultShared: () => void;
  addGeneratedLevel: (level: Level) => void;
  addImportedLevel: (level: Level) => void;
  saveCreatedLevel: (level: Level) => void;
  deleteCustomLevel: (id: number, type: 'imported' | 'created') => void;
  toggleFavorite: (id: number, type: 'imported' | 'created') => void;

  purgeCustomLevels: (baseLevelCount: number) => void;
  toggleMusicEnabled: () => void;
  toggleHapticsEnabled: () => void;
  toggleVehicleLetters: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderHour: (hour: number) => void;
  markNotificationsPrompted: () => void;
  unlockAllLevels: () => void;
  setGenerationState: (state: Partial<GenerationState>) => void;
  cancelGeneration: () => void;
  hardReset: () => void;
  updateStreak: (dateKey: string) => void;
  recordAppOpen: () => AppOpenInfo;
  addStreakFreeze: () => boolean;
  consumeMissionReward: () => { freezeGranted: boolean } | null;
}

/** Key under which a level's in-progress state is saved */
function getLevelKey(level: Level, dailyLevelDate: string | null, weeklyLevelKey: string | null): string | number {
  if (level.id === DAILY_LEVEL_ID && dailyLevelDate) return `daily-${dailyLevelDate}`;
  if (level.id === WEEKLY_LEVEL_ID && weeklyLevelKey) return `weekly-${weeklyLevelKey}`;
  return level.id;
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

      /** Advances today's mission counters; completing them all grants a streak freeze */
      const bumpMissions = (increments: Partial<Record<MissionCounter, number>>) => {
        const state = get();
        const missions = getMissionsForDay(state.dailyMissions, getLocalDateString(new Date()));
        const counters = { ...missions.counters };
        for (const [counter, amount] of Object.entries(increments) as [MissionCounter, number][]) {
          if (amount) counters[counter] = (counters[counter] || 0) + amount;
        }

        const allDone = missions.ids.every(id => MISSIONS_BY_ID[id] && isMissionDone(MISSIONS_BY_ID[id], counters));
        if (!allDone || missions.rewarded) {
          set({ dailyMissions: { ...missions, counters } });
          return;
        }

        set({
          dailyMissions: { ...missions, counters, rewarded: true },
          stats: { ...state.stats, missionDaysCompleted: state.stats.missionDaysCompleted + 1 },
        });
        const freezeGranted = get().addStreakFreeze();
        set({ pendingMissionReward: { freezeGranted } });
        get().checkAchievements();
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
      showVehicleLetters: false,
      themeMode: 'system',
      notificationsEnabled: false,
      reminderHour: DEFAULT_REMINDER_HOUR,
      notificationsPrompted: false,
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDate: null,
      streakFreezes: 0,
      frozenDates: [],
      dailyMissions: null,
      pendingMissionReward: null,
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
        bumpMissions({ moves: 1 });
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
        bumpMissions({ playMs: ms });
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
        if (isCurrentLevel && currentLevel) {
          bumpMissions({
            levelWins: 1,
            perfectWins: stars === 3 ? 1 : 0,
            noHintWins: noHint ? 1 : 0,
            cleanWins: noHelp ? 1 : 0,
            bigGridWins: currentLevel.gridSize >= 7 ? 1 : 0,
          });
        }
        get().checkAchievements();
      },

      completeDailyChallenge: (dateKey, score, stars, timeMs, details) => {
        const { dailyChallengeProgress, savedStates, currentLevel, currentAttempt, stats } = get();
        const newSavedStates = { ...savedStates };
        delete newSavedStates[`daily-${dateKey}`];

        set({
          dailyChallengeProgress: {
            ...dailyChallengeProgress,
            [dateKey]: mergeChallengeResult(dailyChallengeProgress[dateKey], score, stars, timeMs, details),
          },
          savedStates: newSavedStates,
          stats: currentLevel?.id === DAILY_LEVEL_ID ? withWinStats(stats, currentLevel, currentAttempt, timeMs, stars, 'daily') : stats,
          currentAttempt: emptyAttempt(),
        });

        // Update streak
        get().updateStreak(dateKey);
        if (dateKey === getLocalDateString(new Date())) {
          bumpMissions({ dailyDone: 1 });
        }

        get().checkAchievements();
      },

      completeWeeklyChallenge: (weekKey, score, stars, timeMs, details) => {
        const { weeklyChallengeProgress, savedStates, currentLevel, currentAttempt, stats } = get();
        const newSavedStates = { ...savedStates };
        delete newSavedStates[`weekly-${weekKey}`];

        set({
          weeklyChallengeProgress: {
            ...weeklyChallengeProgress,
            [weekKey]: mergeChallengeResult(weeklyChallengeProgress[weekKey], score, stars, timeMs, details),
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

      consumeMissionReward: () => {
        const { pendingMissionReward } = get();
        if (pendingMissionReward) set({ pendingMissionReward: null });
        return pendingMissionReward;
      },

      consumeUnlockQueue: () => {
        const { unlockQueue } = get();
        if (unlockQueue.length > 0) set({ unlockQueue: [] });
        return unlockQueue;
      },

      recordResultShared: () => {
        const { stats } = get();
        set({ stats: { ...stats, resultsShared: stats.resultsShared + 1 } });
        get().checkAchievements();
      },

      recordLevelShared: () => {
        const { stats } = get();
        set({ stats: { ...stats, levelsShared: stats.levelsShared + 1 } });
        get().checkAchievements();
      },

      updateStreak: (dateKey: string) => {
        set(advanceStreak(get(), dateKey));
      },

      addStreakFreeze: () => {
        const { streakFreezes, stats } = get();
        if (streakFreezes >= MAX_STREAK_FREEZES) return false;
        set({
          streakFreezes: streakFreezes + 1,
          stats: { ...stats, freezesEarned: stats.freezesEarned + 1 },
        });
        return true;
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
        const { patch, frozenDays, lostStreak } = settleStreak(get(), today);
        set(patch);
        get().checkAchievements();
        return { isComeback, missedDays, frozenDays, lostStreak };
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
      toggleVehicleLetters: () => set({ showVehicleLetters: !get().showVehicleLetters }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled, notificationsPrompted: true }),
      setReminderHour: (hour) => set({ reminderHour: ((Math.round(hour) % 24) + 24) % 24 }),
      markNotificationsPrompted: () => set({ notificationsPrompted: true }),

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
          streakFreezes: 0,
          frozenDates: [],
          dailyMissions: null,
          pendingMissionReward: null,
          lastOpenDate: null,
          totalHintsUsed: 0,
        });
      },
      };
    },
    {
      name: 'rush-hour-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      migrate: (persistedState, version) => migrateState(persistedState, version) as unknown as GameState,
      // Relocate generated levels if the official pack grew, and deep-merge stats
      // so fields added in later versions get their defaults
      merge: (persistedState, currentState) => {
        const persisted = relocateGeneratedLevels((persistedState || {}) as Partial<GameState>);
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
        showVehicleLetters: state.showVehicleLetters,
        themeMode: state.themeMode,
        notificationsEnabled: state.notificationsEnabled,
        reminderHour: state.reminderHour,
        notificationsPrompted: state.notificationsPrompted,
        generationState: state.generationState,
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        lastStreakDate: state.lastStreakDate,
        streakFreezes: state.streakFreezes,
        frozenDates: state.frozenDates,
        dailyMissions: state.dailyMissions,
        lastOpenDate: state.lastOpenDate,
        totalHintsUsed: state.totalHintsUsed,
      }),
    }
  )
);
