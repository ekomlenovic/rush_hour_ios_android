/**
 * Reserved level IDs for challenges (excluded from map progression).
 * Kept apart from the store so the game logic (generator, solver, collisions)
 * runs without React Native, e.g. on the multiplayer server (#46).
 */
export const DAILY_LEVEL_ID = 999999;
export const WEEKLY_LEVEL_ID = 999998;
/** A past daily replayed from the archives (see docs/GAME_DESIGN.md) */
export const ARCHIVE_LEVEL_ID = 999997;
/** The daily challenge of a multiplayer server (#46) */
export const MULTI_LEVEL_ID = 999996;
