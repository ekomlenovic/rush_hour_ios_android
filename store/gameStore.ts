import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  /** Daily challenge saved state (to prevent reset on leave) */
  dailyChallengeSaveState: { vehicles: Vehicle[]; moveCount: number; history: Vehicle[][] } | null;

  /** Audio Enabled state */
  isMusicEnabled: boolean;

  // Actions
  loadLevel: (level: Level, savedState?: { vehicles: Vehicle[]; moveCount: number; history: Vehicle[][] }) => void;
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
  setGenerationState: (state: Partial<GenerationState>) => void;
  saveDailyState: (vehicles: Vehicle[], moveCount: number, history: Vehicle[][]) => void;
  cancelGeneration: () => void;
  hardReset: () => void;
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
  dailyChallengeSaveState: null,
  isMusicEnabled: true,
  generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },

  loadLevel: (level: Level, savedState?: { vehicles: Vehicle[]; moveCount: number; history: Vehicle[][] }) => {
    set({
      currentLevel: level,
      vehicles: savedState ? savedState.vehicles : level.vehicles.map((v) => ({ ...v })),
      moveCount: savedState ? savedState.moveCount : 0,
      history: savedState ? savedState.history : [],
      lastPlayedLevelId: level.id === 999999 ? get().lastPlayedLevelId : level.id,
    });
  },


  moveVehicle: (vehicleId: string, newRow: number, newCol: number) => {
    const { vehicles, history, moveCount } = get();
    const snapshot = vehicles.map((v) => ({ ...v }));
    
    const updated = vehicles.map((v) =>
      v.id === vehicleId ? { ...v, row: newRow, col: newCol } : v
    );
    set({
      vehicles: updated,
      moveCount: moveCount + 1,
      history: [...history, snapshot],
    });
  },



  undo: () => {
    const { history, moveCount } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    set({
      vehicles: previous,
      history: history.slice(0, -1),
      // Undo still counts as a move (penalty)
      moveCount: moveCount + 1,
    });
  },

  resetLevel: () => {
    const { currentLevel } = get();
    if (!currentLevel) return;
    set({
      vehicles: currentLevel.vehicles.map((v) => ({ ...v })),
      moveCount: 0,
      history: [],
    });
  },

  completeLevel: (levelId: number, score: number, stars: number) => {
    const { progress, maxUnlockedLevel } = get();
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
    set({
      progress: updatedProgress,
      maxUnlockedLevel: Math.max(maxUnlockedLevel, levelId + 1),
    });
    get().checkAchievements();
  },

  completeDailyChallenge: (dateKey: string, score: number, stars: number) => {
    const { dailyChallengeProgress } = get();
    const existing = dailyChallengeProgress[dateKey];
    
    set({
      dailyChallengeProgress: {
        ...dailyChallengeProgress,
        [dateKey]: {
          completed: true,
          score: Math.max(existing?.score || 0, score),
          stars: Math.max(existing?.stars || 0, stars),
        }
      },
      dailyChallengeSaveState: null // Clear saved state when completed
    });
    get().checkAchievements();
  },

  checkAchievements: () => {
    const { progress, dailyChallengeProgress, achievements } = get();
    const newAchievements: string[] = [...achievements];
    
    const completedCount = progress.filter(p => p.completed).length;
    const perfectCount = progress.filter(p => p.stars === 3).length;
    const dailyCount = Object.values(dailyChallengeProgress).filter(p => p.completed).length;

    if (completedCount >= 5 && !achievements.includes('novice')) newAchievements.push('novice');
    if (completedCount >= 50 && !achievements.includes('expert')) newAchievements.push('expert');
    if (perfectCount >= 10 && !achievements.includes('perfectionist')) newAchievements.push('perfectionist');
    if (dailyCount >= 1 && !achievements.includes('daily_winner')) newAchievements.push('daily_winner');

    if (newAchievements.length !== achievements.length) {
      set({ achievements: newAchievements });
      // Logic for achievement notification could be added here
    }
  },

  addGeneratedLevel: (level: Level) => {
    const { generatedLevels } = get();
    // Prevent duplicates
    if (!generatedLevels.find((l) => l.id === level.id)) {
      set({ generatedLevels: [...generatedLevels, level] });
    }
  },

  addImportedLevel: (level: Level) => {
    const { importedLevels } = get();
    // Use a unique ID if it conflicts, or just push if it's new
    if (!importedLevels.find(l => l.id === level.id)) {
      set({ importedLevels: [...importedLevels, { ...level, updatedAt: level.updatedAt || Date.now() }] });
    }
  },

  saveCreatedLevel: (level: Level) => {
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
  },

  toggleFavorite: (id: number, type: 'imported' | 'created') => {
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

  deleteCustomLevel: (id: number, type: 'imported' | 'created') => {
    if (type === 'imported') {
      set({ importedLevels: get().importedLevels.filter(l => l.id !== id) });
    } else {
      set({ createdLevels: get().createdLevels.filter(l => l.id !== id) });
    }
  },

  purgeCustomLevels: (baseLevelCount: number) => {
    const { progress, maxUnlockedLevel } = get();
    // Keep only progress for base levels
    const cleanedProgress = progress.filter(p => p.levelId <= baseLevelCount);
    // Clamp max unlocked back to the final base level + 1 if they completed the base game
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

  setGenerationState: (state) => set((s) => ({ generationState: { ...s.generationState, ...state } })),

  saveDailyState: (vehicles, moveCount, history) => {
    set({ 
        dailyChallengeSaveState: { 
            vehicles: vehicles.map(v => ({ ...v })), 
            moveCount, 
            history: history.map(h => h.map(v => ({ ...v }))) 
        } 
    });
  },

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
      dailyChallengeSaveState: null,
    });
  },
}), {
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
    dailyChallengeSaveState: state.dailyChallengeSaveState,
    isMusicEnabled: state.isMusicEnabled,
    generationState: state.generationState,
  }),
}));
