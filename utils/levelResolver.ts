import { useGameStore, Level, ARCHIVE_LEVEL_ID, whenSaveLoaded } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { generateDailyLevel } from '@/utils/generator';
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
 * Imports the level of a shared link (rush-hours://game?data=…), checked and solved again
 * in the background: the id of the level to open (the existing one for a board already
 * imported), null for a broken or forged link. Waits for the save: a level added before it
 * is loaded is lost (issue 118).
 */
export async function importSharedLevel(data: string): Promise<number | null> {
  await whenSaveLoaded();
  const level = await parseSharedLevelAsync(data);
  return level ? useGameStore.getState().addImportedLevel(level) : null;
}

/**
 * Finds the level a game route points to: daily / weekly challenge (cached in the store),
 * archive, campaign, generated, created or imported level; null for any other id (a deleted
 * level, a broken link). Never generated on the fly: it froze the app and its id left a hole
 * in the generated levels (see docs/GAME_DESIGN.md).
 */
export async function resolveLevel(params: GameRouteParams): Promise<Level | null> {
  // Opened right at launch (deep link, notification), the cached daily / weekly level
  // may not be loaded yet: regenerating it could give another puzzle than the saved game
  await whenSaveLoaded();

  const { levelId: idParam, date: dateParam, week: weekParam } = params;
  const id = Number(idParam);
  const state = useGameStore.getState();

  let level: Level | null = null;

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
  }

  return level && level.vehicles && level.vehicles.length > 0 ? level : null;
}
