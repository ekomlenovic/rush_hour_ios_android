/** Ids from this one up are daily / weekly challenges, never shown on the map */
const CHALLENGE_ID_START = 900000;

/**
 * Level the world map centers on when it opens: the last map level played, else the next one to play.
 * The home Play button names the same level, so it leads where the map opens.
 */
export function getMapFocusLevel(lastPlayedLevelId: number | null, maxUnlockedLevel: number): number {
  return lastPlayedLevelId && lastPlayedLevelId < CHALLENGE_ID_START ? lastPlayedLevelId : maxUnlockedLevel;
}

/** Levels playable past the next one: a player stuck on a hard level can go on and come back to it */
export const MAP_LOOKAHEAD = 2;

/** Whether a level of the map can be played: every level up to the next one, and MAP_LOOKAHEAD more */
export function isMapLevelUnlocked(levelId: number, maxUnlockedLevel: number): boolean {
  return levelId <= maxUnlockedLevel + MAP_LOOKAHEAD;
}
