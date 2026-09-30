import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { sampleLevels } from '../data/sampleLevels';

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
}

/** Saved state for an ongoing level session */
export interface LevelSaveState {
  vehicles: Vehicle[];
  moveCount: number;
  history: Vehicle[][];
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
  dailyChallengeProgress: Record<string, { completed: boolean; score: number; stars: number }>;

  /** List of unlocked achievement IDs */
  achievements: string[];

  /** Daily challenge state for caching */
  currentDailyLevel: Level | null;
  dailyLevelDate: string | null;
  generationState: GenerationState;

  /** Per-level saved state (to prevent reset on leave), keyed by levelId or "daily-YYYY-MM-DD" */
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

  /** Hint token economy */
  hintTokens: number;
  /** Total number of hints ever used */
  totalHintsUsed: number;

  /** Weekly challenge state */
  weeklyChallenge: {
    weekKey: string | null;  // e.g. '2026-W40'
    level: Level | null;
    completed: boolean;
    score: number;
    stars: number;
  };

  // Actions
  loadLevel: (level: Level, savedState?: LevelSaveState) => void;
  moveVehicle: (vehicleId: string, newRow: number, newCol: number) => void;
  undo: () => void;
  resetLevel: () => void;
  completeLevel: (levelId: number, score: number, stars: number) => void;
  completeDailyChallenge: (dateKey: string, score: number, stars: number) => void;
  checkAchievements: () => void;
  addGeneratedLevel: (level: Level) => void;
  addImportedLevel: (level: Level) => void;
  saveCreatedLevel: (level: Level) => void;
  deleteCustomLevel: (id: number, type: 'imported' | 'created') => void;
  toggleFavorite: (id: number, type: 'imported' | 'created') => void;

  purgeCustomLevels: (baseLevelCount: number) => void;
  toggleMusicEnabled: () => void;
  toggleHapticsEnabled: () => void;
  setGenerationState: (state: Partial<GenerationState>) => void;
  cancelGeneration: () => void;
  hardReset: () => void;
  updateStreak: (dateKey: string) => void;
  recordAppOpen: () => { isComeback: boolean; missedDays: number };
  useHintToken: () => boolean;
  addHintTokens: (amount: number) => void;
  completeWeeklyChallenge: (weekKey: string, score: number, stars: number) => void;
}


export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentLevel: null,
      vehicles: [],
      moveCount: 0,
      history: [],
      progress: [],
      maxUnlockedLevel: 1,
      lastPlayedLevelId: null,
      generatedLevels: [],
      importedLevels: [],
      createdLevels: [],
      dailyChallengeProgress: {},
      achievements: [],
      currentDailyLevel: null,
      dailyLevelDate: null,
      savedStates: {},
      isMusicEnabled: true,
      isHapticsEnabled: true,
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDate: null,
      lastOpenDate: null,
      hintTokens: 5,
      totalHintsUsed: 0,
      weeklyChallenge: { weekKey: null, level: null, completed: false, score: 0, stars: 0 },
      generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },

      loadLevel: (level, savedState) => {
        const state = get();
        const levelKey = level.id === 999999 && state.dailyLevelDate ? `daily-${state.dailyLevelDate}` : level.id;
        const resolvedSavedState = savedState || state.savedStates[levelKey];

        set({
          currentLevel: level,
          vehicles: resolvedSavedState ? resolvedSavedState.vehicles.map(v => ({...v})) : level.vehicles.map((v) => ({ ...v })),
          moveCount: resolvedSavedState ? resolvedSavedState.moveCount : 0,
          history: resolvedSavedState ? resolvedSavedState.history.map(h => h.map(v => ({...v}))) : [],
          lastPlayedLevelId: (level.id >= 900000) ? state.lastPlayedLevelId : level.id,
        });
      },

      moveVehicle: (vehicleId, newRow, newCol) => {
        const { vehicles, history, moveCount, currentLevel, dailyLevelDate, savedStates } = get();
        if (!currentLevel) return;

        const snapshot = vehicles.map((v) => ({ ...v }));
        const updated = vehicles.map((v) =>
          v.id === vehicleId ? { ...v, row: newRow, col: newCol } : v
        );

        const newMoveCount = moveCount + 1;
        const newHistory = [...history, snapshot];
        const levelKey = currentLevel.id === 999999 && dailyLevelDate ? `daily-${dailyLevelDate}` : currentLevel.id;
        
        set({
          vehicles: updated,
          moveCount: newMoveCount,
          history: newHistory,
          savedStates: {
            ...savedStates,
            [levelKey]: { 
              vehicles: updated.map(v => ({...v})), 
              moveCount: newMoveCount, 
              history: newHistory.map(h => h.map(v => ({...v}))) 
            }
          }
        });
      },

      undo: () => {
        const { history, moveCount, currentLevel, dailyLevelDate, savedStates } = get();
        if (history.length === 0 || !currentLevel) return;
        
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        const newMoveCount = moveCount + 1;
        const levelKey = currentLevel.id === 999999 && dailyLevelDate ? `daily-${dailyLevelDate}` : currentLevel.id;

        set({
          vehicles: previous,
          history: newHistory,
          moveCount: newMoveCount,
          savedStates: {
            ...savedStates,
            [levelKey]: { 
              vehicles: previous.map(v => ({...v})), 
              moveCount: newMoveCount, 
              history: newHistory.map(h => h.map(v => ({...v}))) 
            }
          }
        });
      },

      resetLevel: () => {
        const { currentLevel, dailyLevelDate, savedStates } = get();
        if (!currentLevel) return;
        
        const levelKey = currentLevel.id === 999999 && dailyLevelDate ? `daily-${dailyLevelDate}` : currentLevel.id;
        const newSavedStates = { ...savedStates };
        delete newSavedStates[levelKey];

        set({
          vehicles: currentLevel.vehicles.map((v) => ({ ...v })),
          moveCount: 0,
          history: [],
          savedStates: newSavedStates
        });
      },

      completeLevel: (levelId, score, stars) => {
        const { progress, maxUnlockedLevel, savedStates } = get();
        
        const existing = progress.find((p) => p.levelId === levelId);
        let updatedProgress: LevelProgress[];
        if (existing) {
          updatedProgress = progress.map((p) =>
            p.levelId === levelId
              ? { ...p, completed: true, bestScore: Math.max(p.bestScore, score), stars: Math.max(p.stars || 0, stars) }
              : p
          );
        } else {
          updatedProgress = [...progress, { levelId, completed: true, bestScore: score, stars }];
        }
        
        const newSavedStates = { ...savedStates };
        delete newSavedStates[levelId];

        // Only advance map progression for map-based levels (Campaign + Generated)
        // Daily Challenge (999999) and Custom Levels (timestamps) are excluded
        const isMapLevel = levelId < 900000;

        set({
          progress: updatedProgress,
          maxUnlockedLevel: isMapLevel ? Math.max(maxUnlockedLevel, levelId + 1) : maxUnlockedLevel,
          savedStates: newSavedStates
        });
        get().checkAchievements();
      },

      completeDailyChallenge: (dateKey, score, stars) => {
        const { dailyChallengeProgress, savedStates } = get();
        const existing = dailyChallengeProgress[dateKey];
        const newSavedStates = { ...savedStates };
        delete newSavedStates[`daily-${dateKey}`];
        
        set({
          dailyChallengeProgress: {
            ...dailyChallengeProgress,
            [dateKey]: {
              completed: true,
              score: Math.max(existing?.score || 0, score),
              stars: Math.max(existing?.stars || 0, stars),
            }
          },
          savedStates: newSavedStates 
        });

        // Update streak
        get().updateStreak(dateKey);
        // Reward hint tokens for daily completion
        get().addHintTokens(2);

        get().checkAchievements();
      },

      checkAchievements: () => {
        const { progress, dailyChallengeProgress, achievements, currentStreak, createdLevels, weeklyChallenge } = get();
        const newAchievements: string[] = [...achievements];
        
        const completedCount = progress.filter(p => p.completed).length;
        const perfectCount = progress.filter(p => p.stars === 3).length;
        const dailyCount = Object.values(dailyChallengeProgress).filter(p => p.completed).length;

        // Original achievements
        if (completedCount >= 5 && !achievements.includes('novice')) newAchievements.push('novice');
        if (completedCount >= 50 && !achievements.includes('expert')) newAchievements.push('expert');
        if (completedCount >= 100 && !achievements.includes('veteran')) newAchievements.push('veteran');
        if (perfectCount >= 10 && !achievements.includes('perfectionist')) newAchievements.push('perfectionist');
        if (dailyCount >= 1 && !achievements.includes('daily_winner')) newAchievements.push('daily_winner');

        // Streak achievements
        if (currentStreak >= 3 && !achievements.includes('streak_3')) newAchievements.push('streak_3');
        if (currentStreak >= 7 && !achievements.includes('streak_7')) newAchievements.push('streak_7');
        if (currentStreak >= 30 && !achievements.includes('streak_30')) newAchievements.push('streak_30');

        // Creator achievement
        if (createdLevels.length >= 5 && !achievements.includes('creator_star')) newAchievements.push('creator_star');

        // Daily devotee
        if (dailyCount >= 7 && !achievements.includes('daily_devotee')) newAchievements.push('daily_devotee');

        // Weekly warrior
        if (weeklyChallenge.completed && !achievements.includes('weekly_warrior')) newAchievements.push('weekly_warrior');

        if (newAchievements.length !== achievements.length) {
          set({ achievements: newAchievements });
          if (get().isHapticsEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      },

      updateStreak: (dateKey: string) => {
        const { lastStreakDate, currentStreak, bestStreak } = get();
        
        if (lastStreakDate === dateKey) return; // Already counted today
        
        const today = new Date(dateKey);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        let newStreak: number;
        if (lastStreakDate === yesterdayStr) {
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
        const { lastOpenDate } = get();
        const today = new Date().toISOString().split('T')[0];
        
        let isComeback = false;
        let missedDays = 0;
        
        if (lastOpenDate) {
          const last = new Date(lastOpenDate);
          const now = new Date(today);
          const diffMs = now.getTime() - last.getTime();
          missedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          isComeback = missedDays >= 3;
        }
        
        set({ lastOpenDate: today });
        return { isComeback, missedDays };
      },

      useHintToken: () => {
        const { totalHintsUsed } = get();
        set({ totalHintsUsed: totalHintsUsed + 1 });
        return true;
      },

      addHintTokens: (amount: number) => {
        const { hintTokens } = get();
        set({ hintTokens: hintTokens + amount });
      },

      completeWeeklyChallenge: (weekKey: string, score: number, stars: number) => {
        const { weeklyChallenge } = get();
        set({
          weeklyChallenge: {
            ...weeklyChallenge,
            weekKey,
            completed: true,
            score: Math.max(weeklyChallenge.score, score),
            stars: Math.max(weeklyChallenge.stars, stars),
          }
        });
        get().checkAchievements();
      },

      addGeneratedLevel: (level) => {
        const { generatedLevels } = get();
        if (!generatedLevels.find((l) => l.id === level.id)) {
          set({ generatedLevels: [...generatedLevels, level] });
        }
      },

      addImportedLevel: (level) => {
        const { importedLevels } = get();
        if (!importedLevels.find(l => l.id === level.id)) {
          set({ importedLevels: [...importedLevels, { ...level, updatedAt: level.updatedAt || Date.now() }] });
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
          generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },
          dailyChallengeProgress: {},
          savedStates: {},
          currentStreak: 0,
          bestStreak: 0,
          lastStreakDate: null,
          lastOpenDate: null,
          hintTokens: 5,
          totalHintsUsed: 0,
          weeklyChallenge: { weekKey: null, level: null, completed: false, score: 0, stars: 0 },
        });
      },
    }),
    {
      name: 'rush-hour-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        progress: state.progress,
        maxUnlockedLevel: state.maxUnlockedLevel,
        lastPlayedLevelId: state.lastPlayedLevelId,
        generatedLevels: state.generatedLevels,
        importedLevels: state.importedLevels,
        createdLevels: state.createdLevels,
        dailyChallengeProgress: state.dailyChallengeProgress,
        achievements: state.achievements,
        currentDailyLevel: state.currentDailyLevel,
        dailyLevelDate: state.dailyLevelDate,
        savedStates: state.savedStates,
        isMusicEnabled: state.isMusicEnabled,
        isHapticsEnabled: state.isHapticsEnabled,
        generationState: state.generationState,
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        lastStreakDate: state.lastStreakDate,
        lastOpenDate: state.lastOpenDate,
        hintTokens: state.hintTokens,
        totalHintsUsed: state.totalHintsUsed,
        weeklyChallenge: state.weeklyChallenge,
      }),
    }
  )
);
