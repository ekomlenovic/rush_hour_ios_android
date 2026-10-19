import { useGameStore, Level, ARCHIVE_LEVEL_ID, whenSaveLoaded } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { generateLevel, DIFFICULTY_LEVELS, generateDailyLevel } from '@/utils/generator';
import { generateWeeklyLevel } from '@/utils/weekly';
import { parseSharedLevelAsync } from '@/utils/solver.background';
import { isArchiveDateAvailable } from '@/utils/archives';

export interface GameRouteParams {
  levelId: string;
  date?: string;
  week?: string;
  data?: string;
}

/**
 * A past daily from the archives, or null for today and the future (see docs/GAME_DESIGN.md).
 * Generated once per date and cached: the puzzle of a day never changes once played.
 */
export async function resolveArchiveLevel(dateKey: string): Promise<Level | null> {
  if (!isArchiveDateAvailable(dateKey)) return null;
  const state = useGameStore.getState();

  let level: Level | null = state.archiveLevels[dateKey] ?? null;
  if (!level) {
    // The daily really played that day, if it is still cached
    const daily = state.currentDailyLevel && state.dailyLevelDate === dateKey
      ? state.currentDailyLevel
      : await generateDailyLevel(dateKey);
    if (!daily) return null;
    level = { ...daily, id: ARCHIVE_LEVEL_ID };
    // Days too old to be replayed leave the cache
    const cached = Object.entries(useGameStore.getState().archiveLevels).filter(([date]) => isArchiveDateAvailable(date));
    useGameStore.setState({ archiveLevels: { ...Object.fromEntries(cached), [dateKey]: level } });
  }
  // The save of an archive is keyed by its date
  useGameStore.setState({ archiveDate: dateKey });
  return level;
}

/**
 * Finds the level a game route points to: daily / weekly challenge (cached in the store),
 * archive, campaign, generated, created or imported level, or a level generated on the fly.
 */
export async function resolveLevel(params: GameRouteParams): Promise<Level | null> {
  // Opened right at launch (deep link, notification), the cached daily / weekly level
  // may not be loaded yet: regenerating it could give another puzzle than the saved game
  await whenSaveLoaded();

  const { levelId: idParam, date: dateParam, week: weekParam, data: dataParamInUrl } = params;
  const id = Number(idParam);
  const state = useGameStore.getState();

  let level: Level | null = null;

  // 0. Primary: Check if level data is passed directly in URL (Deep Link fallback)
  if (dataParamInUrl) {
    level = await parseSharedLevelAsync(dataParamInUrl, 999998);
  }

  if (idParam === 'daily' && dateParam) {
    // Use cache if available and date matches
    if (state.currentDailyLevel && state.dailyLevelDate === dateParam) {
      level = state.currentDailyLevel;
    } else {
      level = await generateDailyLevel(dateParam);
      if (level) {
        useGameStore.setState({ currentDailyLevel: level, dailyLevelDate: dateParam });
      }
    }
  } else if (idParam === 'archive' && dateParam) {
    level = await resolveArchiveLevel(dateParam);
  } else if (idParam === 'weekly' && weekParam) {
    if (state.currentWeeklyLevel && state.weeklyLevelKey === weekParam) {
      level = state.currentWeeklyLevel;
    } else {
      level = await generateWeeklyLevel(weekParam);
      if (level) {
        useGameStore.setState({ currentWeeklyLevel: level, weeklyLevelKey: weekParam });
      }
    }
  } else {
    // 1. Try to find it in the pre-baked JSON
    level = sampleLevels.find((l) => l.id === id) ?? null;

    // 2. Try to find it in the generated Zustand memory cache
    if (!level) {
      level = state.generatedLevels.find((l) => l.id === id) ?? null;
    }

    // 3. Try to find it in created or imported levels (use string comparison for robustness)
    if (!level && id) {
      level = state.createdLevels.find((l) => String(l.id) === String(id)) ||
              state.importedLevels.find((l) => String(l.id) === String(id)) ||
              null;
    }

    // 4. Fallback: Generate it right now (Infinite Map support)
    // Adjust difficulty based on level ID range
    if (!level && id > 0 && id <= 2000) {
      let difficulty = DIFFICULTY_LEVELS.EASY;
      if (id > 1500) difficulty = DIFFICULTY_LEVELS.MASTER;
      else if (id > 800) difficulty = DIFFICULTY_LEVELS.EXPERT;
      else if (id > 400) difficulty = DIFFICULTY_LEVELS.HARD;
      else if (id > 100) difficulty = DIFFICULTY_LEVELS.NORMAL;

      level = generateLevel(id || 1, difficulty) || sampleLevels[0];
      if (level && level.id !== sampleLevels[0].id) {
        state.addGeneratedLevel(level);
      }
    }
  }

  return level && level.vehicles && level.vehicles.length > 0 ? level : null;
}
