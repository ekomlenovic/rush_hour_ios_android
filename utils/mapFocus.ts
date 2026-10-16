/** Ids from this one up are daily / weekly challenges, never shown on the map */
const CHALLENGE_ID_START = 900000;

/**
 * Level the world map centers on when it opens: the last map level played, else the next one to play.
 * The home Play button names the same level, so it leads where the map opens.
 */
export function getMapFocusLevel(lastPlayedLevelId: number | null, maxUnlockedLevel: number): number {
  return lastPlayedLevelId && lastPlayedLevelId < CHALLENGE_ID_START ? lastPlayedLevelId : maxUnlockedLevel;
}
