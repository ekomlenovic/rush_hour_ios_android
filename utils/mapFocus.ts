/** Ids from this one up are daily / weekly challenges, never shown on the map */
const CHALLENGE_ID_START = 900000;

/** The generated levels of the map: the ids after the campaign, up to the last level */
export interface GeneratedRange {
  campaignSize: number;
  mapLevelCount: number;
}

/**
 * Level the world map centers on when it opens: the last map level played while it is not won yet
 * (a game to finish), else the next one to play, the one the map marks as next.
 * A player on the generated levels with the campaign still going stays on them: a generated level
 * does not move the "next" marker (it does not unlock the campaign), so after one is won the map
 * opens on the first generated level after it not won yet, rather than back at the campaign.
 * The home Play button names the same level, so it leads where the map opens.
 */
export function getMapFocusLevel(
  lastPlayedLevelId: number | null,
  maxUnlockedLevel: number,
  isCompleted: (levelId: number) => boolean = () => false,
  generated?: GeneratedRange,
): number {
  const lastPlayed = lastPlayedLevelId && lastPlayedLevelId < CHALLENGE_ID_START ? lastPlayedLevelId : null;
  if (lastPlayed !== null && !isCompleted(lastPlayed)) return lastPlayed;
  if (generated && lastPlayed !== null && lastPlayed > generated.campaignSize && maxUnlockedLevel <= generated.campaignSize) {
    for (let id = lastPlayed + 1; id <= generated.mapLevelCount; id++) if (!isCompleted(id)) return id;
  }
  return maxUnlockedLevel;
}

/**
 * Level after a map level just won, for the "Next level" button of the win screen: the following
 * one of the campaign (unlocked by the win) or the generated levels (always playable), null after the last one
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
