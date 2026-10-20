/** Ids from this one up are daily / weekly challenges, never shown on the map */
const CHALLENGE_ID_START = 900000;

/**
 * Level the world map centers on when it opens: the last map level played while it is not won yet
 * (a game to finish), else the next one to play, the one the map marks as next.
 * The home Play button names the same level, so it leads where the map opens.
 */
export function getMapFocusLevel(
  lastPlayedLevelId: number | null,
  maxUnlockedLevel: number,
  isCompleted: (levelId: number) => boolean = () => false,
): number {
  const lastPlayed = lastPlayedLevelId && lastPlayedLevelId < CHALLENGE_ID_START ? lastPlayedLevelId : null;
  return lastPlayed !== null && !isCompleted(lastPlayed) ? lastPlayed : maxUnlockedLevel;
}

/**
 * Level after a map level just won, for the "Next level" button of the win screen: the following
 * one of the campaign or the generated levels (already unlocked by the win), null after the last one
 */
export function nextMapLevel(levelId: number, mapLevelCount: number): number | null {
  if (levelId < 1 || levelId >= CHALLENGE_ID_START) return null;
  return levelId < mapLevelCount ? levelId + 1 : null;
}

/** Levels playable past the next one: a player stuck on a hard level can go on and come back to it */
export const MAP_LOOKAHEAD = 2;

/** Whether a level of the map can be played: every level up to the next one, and MAP_LOOKAHEAD more */
export function isMapLevelUnlocked(levelId: number, maxUnlockedLevel: number): boolean {
  return levelId <= maxUnlockedLevel + MAP_LOOKAHEAD;
}
