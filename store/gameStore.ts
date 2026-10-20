import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Haptics from 'expo-haptics';
import { sampleLevels } from '../data/sampleLevels';
import { isBossLevel } from '../data/bosses';
import { ACHIEVEMENTS, buildAchievementContext } from '../data/achievements';
import { DEFAULT_REMINDER_HOUR } from '../utils/reminders';
import { DailyMissionsState, FAST_WIN_MS, MissionCounter, MissionReward, MISSIONS_BY_ID, getMissionsForDay, isMissionDone } from '../data/missions';
import { getLocalDateString, daysBetween } from '../utils/date';
import { diffMove, toMoveRecord } from '../utils/moveLog';
import { cleanLevelName, isSameBoard } from '../utils/sharing';
import type {
  AppOpenInfo, AttemptStats, ChallengeDetails, ChallengeResult, Level, LevelProgress, LevelSaveState, MoveRecord, PeriodStats, PlayerStats, RecapsSeen,
  ThemeMode, Vehicle,
} from './types';
import { MAX_STREAK_FREEZES, settleStreak, advanceStreak } from './streak';
import {
  ACHIEVEMENT_XP, BOSS_WIN_XP, archiveWinXp, dailyWinXp, getFreezeCapacity, getPlayerLevel, levelWinXp, missionsXp, weeklyWinXp,
} from '../data/progression';
import { isArchiveDateAvailable } from '../utils/archives';
import { isDailyWinnable, isWeeklyWinnable } from '../utils/challengeDates';
import {
  CosmeticKind, CosmeticSelection, COSMETICS_BY_KEY, DEFAULT_COSMETICS, buildCosmeticContext, getUnlockedCosmetics, isCosmeticUnlocked, sanitizeSelection,
} from '../data/cosmetics';
import { emptyAttempt, initialStats, withWinStats, mergeChallengeResult } from './stats';
import { addToPeriods, monthKeyOf, winIncrements } from './periodStats';
import { STORE_VERSION, migrateState, relocateGeneratedLevels } from './migrations';
import { compactSavedStates, dropOldUndoStacks, isWellFormedSave, savedUndoSteps, undoStackOf } from './savedStates';
import { createGuardedStorage } from './guardedStorage';
import { DAILY_LEVEL_ID, WEEKLY_LEVEL_ID, ARCHIVE_LEVEL_ID } from './levelIds';

export type * from './types';
export { MAX_STREAK_FREEZES };
export { DAILY_LEVEL_ID, WEEKLY_LEVEL_ID, ARCHIVE_LEVEL_ID };

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
  /** Timed moves of the attempt, replayable with applyMoves (multiplayer, #46) */
  moveLog: MoveRecord[];
  /** Wall-clock start of the attempt (ms since epoch), the origin of the move times */
  attemptStartedAt: number;
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
  /** Past dailies won from the archives, keyed by date (YYYY-MM-DD). Never mixed with dailyChallengeProgress */
  archiveProgress: Record<string, ChallengeResult>;

  /** List of unlocked achievement IDs */
  achievements: string[];
  /** Achievements unlocked but not shown to the player yet (not persisted) */
  unlockQueue: string[];

  /** Lifetime statistics */
  stats: PlayerStats;
  /** Recap counters of the last months (RECAP_MONTHS_KEPT), keyed by YYYY-MM (store/periodStats.ts) */
  monthlyStats: Record<string, PeriodStats>;
  /** Recap counters of every year, keyed by YYYY */
  yearlyStats: Record<string, PeriodStats>;
  /** Month each achievement was unlocked (YYYY-MM), by achievement id */
  achievementMonths: Record<string, string>;
  /** Day the recap counters started (YYYY-MM-DD): the update that added them; null when counted from the start */
  recapSince: string | null;
  /** Latest recaps opened, the home screen stops announcing them */
  recapsSeen: RecapsSeen;

  /** Daily challenge state for caching */
  currentDailyLevel: Level | null;
  dailyLevelDate: string | null;
  /** Weekly challenge state for caching */
  currentWeeklyLevel: Level | null;
  weeklyLevelKey: string | null;
  /** Archive levels already generated, keyed by date: the puzzle of a day never changes once played */
  archiveLevels: Record<string, Level>;
  /** The save could not be read back: nothing is written until the next launch (not persisted) */
  saveLoadFailed: boolean;
  /** Date of the archive being played (not persisted) */
  archiveDate: string | null;
  generationState: GenerationState;

  /** Per-level saved state (to prevent reset on leave), keyed by levelId, "daily-YYYY-MM-DD", "weekly-YYYY-Www" or "archive-YYYY-MM-DD" */
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
  pendingMissionReward: MissionReward | null;

  /** Last time the app was opened (ISO date YYYY-MM-DD) for comeback detection */
  lastOpenDate: string | null;

  /** Total number of hints ever used */
  totalHintsUsed: number;

  /** Experience points: the player level is derived from them (data/progression.ts) */
  xp: number;
  /** Player levels reached but not shown to the player yet (not persisted) */
  levelUpQueue: number[];
  /** XP before and after the last win, for the win screen (not persisted) */
  lastXpGain: { from: number; to: number } | null;
  /** Selected board theme, car skin, palette and win effect */
  cosmetics: CosmeticSelection;
  /** Unlocked cosmetics already seen in the garage ('kind:id'): touched once, the "new" badge goes */
  seenCosmetics: string[];
  /** Unlocked achievements already seen in the profile: touched once, the "new" badge goes */
  seenAchievements: string[];

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
  /** Wins a past daily from the archives: training only, no streak, daily missions or daily achievements */
  completeArchiveChallenge: (dateKey: string, score: number, stars: number, timeMs?: number, details?: ChallengeDetails) => void;
  checkAchievements: (options?: { silent?: boolean }) => void;
  consumeUnlockQueue: () => string[];
  recordLevelShared: () => void;
  recordResultShared: () => void;
  /** The recap of a month (YYYY-MM) or a year (YYYY) was opened */
  markRecapSeen: (key: string) => void;
  addGeneratedLevel: (level: Level) => void;
  /** Adds a checked level (see parseSharedLevel); returns the id to open: the existing one for a board already imported */
  addImportedLevel: (level: Level) => number;
  saveCreatedLevel: (level: Level) => void;
  renameCustomLevel: (id: number, type: 'imported' | 'created', name: string | undefined) => void;
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
  /** Replaces the progress with an imported save (utils/saveTransfer.ts), keeping the device settings */
  importProgress: (imported: Record<string, unknown>) => void;
  updateStreak: (dateKey: string) => void;
  recordAppOpen: () => AppOpenInfo;
  addStreakFreeze: () => boolean;
  consumeMissionReward: () => MissionReward | null;
  consumeLevelUps: () => number[];
  selectCosmetic: (kind: CosmeticKind, id: string) => boolean;
  markCosmeticsSeen: (keys: string[]) => void;
  markAchievementSeen: (id: string) => void;
}

/** Key under which a level's in-progress state is saved */
function getLevelKey(level: Level, state: Pick<GameState, 'dailyLevelDate' | 'weeklyLevelKey' | 'archiveDate'>): string | number {
  if (level.id === DAILY_LEVEL_ID && state.dailyLevelDate) return `daily-${state.dailyLevelDate}`;
  if (level.id === WEEKLY_LEVEL_ID && state.weeklyLevelKey) return `weekly-${state.weeklyLevelKey}`;
  if (level.id === ARCHIVE_LEVEL_ID && state.archiveDate) return `archive-${state.archiveDate}`;
  return level.id;
}

/**
 * Whether a saved state belongs to this level: same vehicles, each on its own lane.
 * A daily or weekly save is keyed by date only: if the level was regenerated differently
 * (another app version, a cache miss), its save describes another puzzle.
 */
export function isSaveForLevel(level: Pick<Level, 'vehicles'>, saved: Pick<LevelSaveState, 'vehicles'>): boolean {
  if (saved.vehicles.length !== level.vehicles.length) return false;
  const byId = new Map(level.vehicles.map(v => [v.id, v]));
  return saved.vehicles.every(s => {
    const v = byId.get(s.id);
    return !!v && v.length === s.length && v.orientation === s.orientation && v.isTarget === s.isTarget
      && (v.orientation === 'horizontal' ? v.row === s.row : v.col === s.col);
  });
}

/** Moves, undos, hints and play time are written grouped, at most this long after (see guardedStorage) */
const SAVE_WRITE_DELAY_MS = 1000;
/**
 * Big, rarely changed, each in its own entry: the infinite map, the archive days played, and the
 * challenge results (one more each day, with its move log, never dropped)
 */
export const SEPARATE_SAVE_FIELDS: readonly (keyof GameState)[] = [
  'generatedLevels', 'archiveLevels', 'dailyChallengeProgress', 'weeklyChallengeProgress', 'archiveProgress',
];
const saveStorage = createGuardedStorage<Partial<GameState>>({ delayMs: SAVE_WRITE_DELAY_MS, separateFields: SEPARATE_SAVE_FIELDS });

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      /** The in-progress state updated and mirrored into savedStates (nothing without a level loaded) */
      const withSnapshot = (partial: Partial<Pick<GameState, 'vehicles' | 'moveCount' | 'history' | 'moveLog' | 'currentAttempt' | 'stats' | 'totalHintsUsed'>>): Partial<GameState> => {
        const state = get();
        if (!state.currentLevel) return {};
        const next = { ...state, ...partial };
        const levelKey = getLevelKey(state.currentLevel, state);

        return {
          ...partial,
          savedStates: {
            ...state.savedStates,
            [levelKey]: {
              vehicles: next.vehicles.map(v => ({ ...v })),
              moveCount: next.moveCount,
              // Kept empty for the older versions, which read the undo stack there: they resume without it
              history: [],
              undoSteps: savedUndoSteps(levelKey, next.vehicles, next.history),
              attempt: { ...next.currentAttempt },
              moveLog: next.moveLog.map(m => ({ ...m })),
              startedAt: next.attemptStartedAt,
              savedAt: Date.now(),
            }
          }
        };
      };

      /** Updates the in-progress state and mirrors it into savedStates, written with the next moves */
      const saveSnapshot = (partial: Parameters<typeof withSnapshot>[0]) => {
        saveStorage.deferNextWrite();
        set(withSnapshot(partial));
      };

      /**
       * Advances today's mission counters; completing them all grants XP and a streak freeze (more XP if the stock is full).
       * `update` is applied in the same set: a move is written once, with its mission counters.
       */
      const bumpMissions = (increments: Partial<Record<MissionCounter, number>>, update: Partial<GameState> = {}) => {
        const state = { ...get(), ...update };
        const missions = getMissionsForDay(state.dailyMissions, getLocalDateString(new Date()));
        const counters = { ...missions.counters };
        for (const [counter, amount] of Object.entries(increments) as [MissionCounter, number][]) {
          if (amount) counters[counter] = (counters[counter] || 0) + amount;
        }

        const allDone = missions.ids.every(id => MISSIONS_BY_ID[id] && isMissionDone(MISSIONS_BY_ID[id], counters));
        if (!allDone || missions.rewarded) {
          set({ ...update, dailyMissions: { ...missions, counters } });
          return;
        }

        const cosmeticsBefore = unlockedCosmetics();
        set({
          ...update,
          dailyMissions: { ...missions, counters, rewarded: true },
          stats: { ...state.stats, missionDaysCompleted: state.stats.missionDaysCompleted + 1 },
        });
        const freezeGranted = get().addStreakFreeze();
        const xp = missionsXp(freezeGranted);
        set({ pendingMissionReward: { freezeGranted, xp } });
        addXp(xp);
        get().checkAchievements();
        recordNewCosmetics(cosmeticsBefore);
      };

      /** Adds XP; each level reached gives a streak freeze (if there is room) and is queued for display */
      const addXp = (amount: number, options?: { silent?: boolean }) => {
        if (amount <= 0) return;
        const state = get();
        const fromLevel = getPlayerLevel(state.xp);
        const xp = state.xp + Math.round(amount);
        const toLevel = getPlayerLevel(xp);
        set({ xp });
        if (toLevel <= fromLevel) return;

        const reached = Array.from({ length: toLevel - fromLevel }, (_, i) => fromLevel + i + 1);
        for (let i = 0; i < reached.length; i++) get().addStreakFreeze();
        if (!options?.silent) set({ levelUpQueue: [...get().levelUpQueue, ...reached] });
      };

      /** Records the XP of a win (level, missions and achievements included) for the win screen */
      const recordXpGain = (from: number) => set({ lastXpGain: { from, to: get().xp } });

      /** Adds to the recap of this month and this year */
      const periodsWith = (increments: Partial<PeriodStats>, state: GameState = get()) => addToPeriods(state, increments);

      /** Styles unlocked now: compared after a win, the new ones go to the recap */
      const unlockedCosmetics = () => getUnlockedCosmetics(buildCosmeticContext(get())).length;
      const recordNewCosmetics = (before: number) => {
        const gained = unlockedCosmetics() - before;
        if (gained > 0) set(periodsWith({ cosmetics: gained }));
      };

      return {
      currentLevel: null,
      vehicles: [],
      moveCount: 0,
      history: [],
      moveLog: [],
      attemptStartedAt: 0,
      currentAttempt: emptyAttempt(),
      progress: [],
      maxUnlockedLevel: 1,
      lastPlayedLevelId: null,
      generatedLevels: [],
      importedLevels: [],
      createdLevels: [],
      dailyChallengeProgress: {},
      weeklyChallengeProgress: {},
      archiveProgress: {},
      achievements: [],
      unlockQueue: [],
      stats: initialStats(),
      monthlyStats: {},
      yearlyStats: {},
      achievementMonths: {},
      recapSince: null,
      recapsSeen: {},
      currentDailyLevel: null,
      dailyLevelDate: null,
      currentWeeklyLevel: null,
      weeklyLevelKey: null,
      archiveLevels: {},
      archiveDate: null,
      saveLoadFailed: false,
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
      xp: 0,
      levelUpQueue: [],
      lastXpGain: null,
      cosmetics: { ...DEFAULT_COSMETICS },
      seenCosmetics: [],
      seenAchievements: [],
      generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },

      loadLevel: (level, savedState) => {
        const state = get();
        const levelKey = getLevelKey(level, state);
        const stored = state.savedStates[levelKey];
        // Never replay the save of another puzzle on this one: start it fresh instead
        const storedIsValid = isWellFormedSave(stored) && isSaveForLevel(level, stored);
        const resolvedSavedState = savedState || (storedIsValid ? stored : undefined);
        if (stored && !storedIsValid) {
          const { [levelKey]: _stale, ...savedStates } = state.savedStates;
          set({ savedStates });
        }

        set({
          currentLevel: level,
          vehicles: resolvedSavedState ? resolvedSavedState.vehicles.map(v => ({...v})) : level.vehicles.map((v) => ({ ...v })),
          moveCount: resolvedSavedState ? resolvedSavedState.moveCount : 0,
          history: resolvedSavedState ? undoStackOf(resolvedSavedState) : [],
          moveLog: resolvedSavedState?.moveLog ? resolvedSavedState.moveLog.map(m => ({ ...m })) : [],
          attemptStartedAt: resolvedSavedState?.startedAt ?? Date.now(),
          currentAttempt: resolvedSavedState?.attempt ? { ...resolvedSavedState.attempt } : emptyAttempt(),
          lastPlayedLevelId: (level.id >= 900000) ? state.lastPlayedLevelId : level.id,
        });
      },

      moveVehicle: (vehicleId, newRow, newCol) => {
        const { vehicles, history, moveLog, attemptStartedAt, moveCount, currentLevel, stats } = get();
        if (!currentLevel) return;

        const snapshot = vehicles.map((v) => ({ ...v }));
        const updated = vehicles.map((v) =>
          v.id === vehicleId ? { ...v, row: newRow, col: newCol } : v
        );
        const moved = vehicles.find(v => v.id === vehicleId);
        const record = moved && toMoveRecord(moved, newRow, newCol, Date.now() - attemptStartedAt);

        saveStorage.deferNextWrite();
        bumpMissions({ moves: 1 }, {
          ...withSnapshot({
            vehicles: updated,
            moveCount: moveCount + 1,
            history: [...history, snapshot],
            moveLog: record ? [...moveLog, record] : moveLog,
            stats: { ...stats, totalMoves: stats.totalMoves + 1 },
          }),
          ...periodsWith({ moves: 1 }),
        });
      },

      undo: () => {
        const { vehicles, history, moveLog, attemptStartedAt, moveCount, currentLevel, currentAttempt, stats } = get();
        if (history.length === 0 || !currentLevel) return;

        // Undo counts as a move (see docs/GAME_DESIGN.md): the log gets the opposite move
        const previous = history[history.length - 1];
        const record = diffMove(vehicles, previous, Date.now() - attemptStartedAt);
        saveSnapshot({
          vehicles: previous,
          history: history.slice(0, -1),
          moveLog: record ? [...moveLog, record] : moveLog,
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
          moveLog: [],
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
        saveStorage.deferNextWrite();
        bumpMissions({ playMs: ms }, {
          ...withSnapshot({
            currentAttempt: { ...currentAttempt, elapsedMs: currentAttempt.elapsedMs + ms },
            stats: { ...stats, totalPlayTimeMs: stats.totalPlayTimeMs + ms },
          }),
          ...periodsWith({ playTimeMs: ms }),
        });
      },

      completeLevel: (levelId, score, stars, timeMs) => {
        const { progress, maxUnlockedLevel, savedStates, currentLevel, currentAttempt, stats, xp: xpBefore } = get();
        const cosmeticsBefore = unlockedCosmetics();

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
          ...periodsWith({
            ...(isCurrentLevel && currentLevel ? winIncrements(currentLevel, stars, 'level') : {}),
            newLevels: existing?.completed ? 0 : 1,
            starsGained: Math.max(0, stars - (existing?.completed ? existing.stars || 0 : 0)),
          }),
        });
        if (isCurrentLevel && currentLevel) {
          const isFirstWin = !existing?.completed;
          addXp(levelWinXp(currentLevel.minMoves, stars, isFirstWin) + (isFirstWin && isBossLevel(levelId) ? BOSS_WIN_XP : 0));
          bumpMissions({
            levelWins: 1,
            perfectWins: stars === 3 ? 1 : 0,
            noHintWins: noHint ? 1 : 0,
            cleanWins: noHelp ? 1 : 0,
            bigGridWins: currentLevel.gridSize >= 7 ? 1 : 0,
            newLevelWins: existing?.completed ? 0 : 1,
            fastWins: timeMs !== undefined && timeMs < FAST_WIN_MS ? 1 : 0,
          });
        }
        get().checkAchievements();
        recordNewCosmetics(cosmeticsBefore);
        recordXpGain(xpBefore);
      },

      completeDailyChallenge: (dateKey, score, stars, timeMs, details) => {
        // A day to come (a forged link) would break the streak and the export of the save (issue 119)
        if (!isDailyWinnable(dateKey)) return;
        const { dailyChallengeProgress, savedStates, currentLevel, currentAttempt, stats, xp: xpBefore } = get();
        const firstWin = !dailyChallengeProgress[dateKey]?.completed;
        const cosmeticsBefore = unlockedCosmetics();
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
          ...(currentLevel?.id === DAILY_LEVEL_ID && periodsWith(winIncrements(currentLevel, stars, 'daily'))),
        });

        // Update streak
        get().updateStreak(dateKey);
        if (firstWin) addXp(dailyWinXp(stars));
        if (dateKey === getLocalDateString(new Date())) {
          bumpMissions({ dailyDone: 1 });
        }

        get().checkAchievements();
        recordNewCosmetics(cosmeticsBefore);
        recordXpGain(xpBefore);
      },

      completeWeeklyChallenge: (weekKey, score, stars, timeMs, details) => {
        if (!isWeeklyWinnable(weekKey)) return;
        const { weeklyChallengeProgress, savedStates, currentLevel, currentAttempt, stats, xp: xpBefore } = get();
        const firstWin = !weeklyChallengeProgress[weekKey]?.completed;
        const cosmeticsBefore = unlockedCosmetics();
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
          ...(currentLevel?.id === WEEKLY_LEVEL_ID && periodsWith(winIncrements(currentLevel, stars, 'weekly'))),
        });
        if (firstWin) addXp(weeklyWinXp(stars));
        get().checkAchievements();
        recordNewCosmetics(cosmeticsBefore);
        recordXpGain(xpBefore);
      },

      completeArchiveChallenge: (dateKey, score, stars, timeMs, details) => {
        // Only past days: today's daily is a one-shot challenge, never an archive
        if (!isArchiveDateAvailable(dateKey, getLocalDateString(new Date()))) return;
        const { archiveProgress, savedStates, currentLevel, currentAttempt, stats, xp: xpBefore } = get();
        const firstWin = !archiveProgress[dateKey]?.completed;
        const cosmeticsBefore = unlockedCosmetics();
        const newSavedStates = { ...savedStates };
        delete newSavedStates[`archive-${dateKey}`];
        const isCurrentLevel = currentLevel?.id === ARCHIVE_LEVEL_ID;

        set({
          archiveProgress: {
            ...archiveProgress,
            [dateKey]: mergeChallengeResult(archiveProgress[dateKey], score, stars, timeMs, details),
          },
          savedStates: newSavedStates,
          stats: isCurrentLevel ? withWinStats(stats, currentLevel, currentAttempt, timeMs, stars, 'archive') : stats,
          currentAttempt: emptyAttempt(),
          ...(isCurrentLevel && periodsWith(winIncrements(currentLevel, stars, 'archive'))),
        });

        // No streak, freeze or mission: playing a missed day afterwards does not make up for it
        if (firstWin) addXp(archiveWinXp(details?.minMoves ?? currentLevel?.minMoves ?? 0, stars));
        get().checkAchievements();
        recordNewCosmetics(cosmeticsBefore);
        recordXpGain(xpBefore);
      },

      checkAchievements: (options) => {
        const state = get();
        const context = buildAchievementContext(state);
        const newlyUnlocked = ACHIEVEMENTS
          .filter(a => !state.achievements.includes(a.id) && a.value(context) >= a.target)
          .map(a => a.id);

        if (newlyUnlocked.length === 0) return;

        // The month of each one, for the recap
        const month = monthKeyOf(new Date());
        set({
          achievementMonths: { ...state.achievementMonths, ...Object.fromEntries(newlyUnlocked.map(id => [id, month])) },
          ...periodsWith({ achievements: newlyUnlocked.length }, state),
        });

        if (options?.silent) {
          set({ achievements: [...state.achievements, ...newlyUnlocked] });
          addXp(newlyUnlocked.length * ACHIEVEMENT_XP, { silent: true });
          return;
        }

        set({
          achievements: [...state.achievements, ...newlyUnlocked],
          unlockQueue: [...state.unlockQueue, ...newlyUnlocked],
        });
        addXp(newlyUnlocked.length * ACHIEVEMENT_XP);
        if (state.isHapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },

      consumeMissionReward: () => {
        const { pendingMissionReward } = get();
        if (pendingMissionReward) set({ pendingMissionReward: null });
        return pendingMissionReward;
      },

      consumeLevelUps: () => {
        const { levelUpQueue } = get();
        if (levelUpQueue.length > 0) set({ levelUpQueue: [] });
        return levelUpQueue;
      },

      selectCosmetic: (kind, id) => {
        const state = get();
        const def = COSMETICS_BY_KEY[`${kind}:${id}`];
        if (!def || !isCosmeticUnlocked(def, buildCosmeticContext(state))) return false;
        set({ cosmetics: { ...state.cosmetics, [kind]: id } });
        return true;
      },

      markCosmeticsSeen: (keys) => {
        const seen = new Set(get().seenCosmetics);
        if (keys.every(k => seen.has(k))) return;
        keys.forEach(k => seen.add(k));
        set({ seenCosmetics: [...seen] });
      },

      markAchievementSeen: (id) => {
        const { seenAchievements } = get();
        if (!seenAchievements.includes(id)) set({ seenAchievements: [...seenAchievements, id] });
      },

      consumeUnlockQueue: () => {
        const { unlockQueue } = get();
        if (unlockQueue.length > 0) set({ unlockQueue: [] });
        return unlockQueue;
      },

      recordResultShared: () => {
        const { stats } = get();
        set({ stats: { ...stats, resultsShared: stats.resultsShared + 1 }, ...periodsWith({ resultsShared: 1 }) });
        get().checkAchievements();
      },

      markRecapSeen: (key) => {
        const field = key.length === 4 ? 'year' : 'month';
        const seen = get().recapsSeen[field];
        // Opening an older recap again from the profile does not announce the latest one again
        if (seen && seen >= key) return;
        set({ recapsSeen: { ...get().recapsSeen, [field]: key } });
      },

      recordLevelShared: () => {
        const { stats } = get();
        set({ stats: { ...stats, levelsShared: stats.levelsShared + 1 } });
        get().checkAchievements();
      },

      updateStreak: (dateKey: string) => {
        set(advanceStreak(get(), dateKey, getFreezeCapacity(getPlayerLevel(get().xp))));
      },

      addStreakFreeze: () => {
        const { streakFreezes, stats, xp } = get();
        if (streakFreezes >= getFreezeCapacity(getPlayerLevel(xp))) return false;
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
          // Keeps the save small: past challenges cleared, no undo stack for the levels played long ago
          savedStates: dropOldUndoStacks(compactSavedStates(get().savedStates)),
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
        // Only the imported ones: a level modified from an import (in the created ones) stays a separate level
        const existing = importedLevels.find(l => l.id === level.id || isSameBoard(l, level));
        if (existing) return existing.id;
        set({
          importedLevels: [...importedLevels, { ...level, name: cleanLevelName(level.name), updatedAt: level.updatedAt || Date.now() }],
          stats: { ...stats, levelsImported: stats.levelsImported + 1 },
        });
        get().checkAchievements();
        return level.id;
      },

      saveCreatedLevel: (level) => {
        const { createdLevels } = get();
        const index = createdLevels.findIndex(l => l.id === level.id);
        const updatedLevel = { ...level, name: cleanLevelName(level.name), updatedAt: Date.now() };
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

      renameCustomLevel: (id, type, name) => {
        const rename = (levels: Level[]) => levels.map(l => l.id === id ? { ...l, name: cleanLevelName(name) } : l);
        if (type === 'imported') {
          set({ importedLevels: rename(get().importedLevels) });
        } else {
          set({ createdLevels: rename(get().createdLevels) });
        }
      },

      deleteCustomLevel: (id, type) => {
        // The game in progress goes with the level (stars and wins stay in the stats)
        const savedStates = { ...get().savedStates };
        delete savedStates[id];
        if (type === 'imported') {
          set({ importedLevels: get().importedLevels.filter(l => l.id !== id), savedStates });
        } else {
          set({ createdLevels: get().createdLevels.filter(l => l.id !== id), savedStates });
        }
      },

      purgeCustomLevels: (baseLevelCount) => {
        const { progress, maxUnlockedLevel, savedStates, lastPlayedLevelId } = get();
        const isGenerated = (id: number) => id > baseLevelCount && id < 900000;
        const cleanedProgress = progress.filter(p => p.levelId <= baseLevelCount);
        const clampedUnlocked = Math.min(maxUnlockedLevel, baseLevelCount + 1);
        // The games in progress go with the levels, and the map no longer opens on one of them
        const keptSaves = Object.fromEntries(Object.entries(savedStates).filter(([key]) => !isGenerated(Number(key))));

        set({
          generatedLevels: [],
          progress: cleanedProgress,
          maxUnlockedLevel: clampedUnlocked,
          savedStates: keptSaves,
          lastPlayedLevelId: lastPlayedLevelId !== null && isGenerated(lastPlayedLevelId) ? null : lastPlayedLevelId,
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

      setGenerationState: (state) => {
        saveStorage.deferNextWrite();
        set((s) => ({ generationState: { ...s.generationState, ...state } }));
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
          moveLog: [],
          attemptStartedAt: 0,
          currentAttempt: emptyAttempt(),
          generationState: { isRunning: false, current: 0, total: 0, shouldCancel: false, estimatedRemainingSeconds: 0 },
          dailyChallengeProgress: {},
          weeklyChallengeProgress: {},
          archiveProgress: {},
          achievements: [],
          unlockQueue: [],
          stats: initialStats(),
          monthlyStats: {},
          yearlyStats: {},
          achievementMonths: {},
          recapSince: null,
          recapsSeen: {},
          currentDailyLevel: null,
          dailyLevelDate: null,
          currentWeeklyLevel: null,
          weeklyLevelKey: null,
          archiveLevels: {},
          archiveDate: null,
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
          xp: 0,
          levelUpQueue: [],
          lastXpGain: null,
          cosmetics: { ...DEFAULT_COSMETICS },
          seenCosmetics: [],
          seenAchievements: [],
        });
      },

      importProgress: (imported) => {
        get().hardReset();
        const state = { ...get(), ...(imported as Partial<GameState>) };
        set({
          ...(imported as Partial<GameState>),
          stats: { ...initialStats(), ...state.stats },
          cosmetics: sanitizeSelection(state.cosmetics, buildCosmeticContext(state)),
        });
        // Achievements the progress already earns (no toast flood), then the days missed since the export
        get().checkAchievements({ silent: true });
        get().recordAppOpen();
      },
      };
    },
    {
      name: 'rush-hour-storage',
      storage: saveStorage.storage,
      version: STORE_VERSION,
      migrate: (persistedState, version) => migrateState(persistedState, version) as unknown as GameState,
      // Relocate generated levels if the official pack grew, and deep-merge stats
      // so fields added in later versions get their defaults
      merge: (persistedState, currentState) => {
        const persisted = relocateGeneratedLevels((persistedState || {}) as Partial<GameState>);
        const merged = {
          ...currentState,
          ...persisted,
          stats: { ...currentState.stats, ...persisted.stats },
        };
        // A selected cosmetic that is no longer unlocked falls back to its default
        return { ...merged, cosmetics: sanitizeSelection(merged.cosmetics, buildCosmeticContext(merged)) };
      },
      // Unlock achievements already earned (e.g. new ones after an update) without a toast flood
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          // Starting empty would overwrite the save at the first write: keep writes held
          console.warn('[gameStore] save not loaded, writes held until the next launch', error);
          useGameStore.setState({ saveLoadFailed: true });
          return;
        }
        saveStorage.allowWrites();
        state.checkAchievements({ silent: true });
        // Writes the loaded state (migrated if needed) now that writes are allowed
        useGameStore.setState({});
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
        archiveProgress: state.archiveProgress,
        achievements: state.achievements,
        stats: state.stats,
        monthlyStats: state.monthlyStats,
        yearlyStats: state.yearlyStats,
        achievementMonths: state.achievementMonths,
        recapSince: state.recapSince,
        recapsSeen: state.recapsSeen,
        currentDailyLevel: state.currentDailyLevel,
        dailyLevelDate: state.dailyLevelDate,
        currentWeeklyLevel: state.currentWeeklyLevel,
        weeklyLevelKey: state.weeklyLevelKey,
        archiveLevels: state.archiveLevels,
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
        xp: state.xp,
        cosmetics: state.cosmetics,
        seenCosmetics: state.seenCosmetics,
        seenAchievements: state.seenAchievements,
      }),
    }
  )
);

/** Resolves once the save is loaded from the device storage (never if it could not be read) */
export function whenSaveLoaded(): Promise<void> {
  if (useGameStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useGameStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
