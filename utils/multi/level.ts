import type { MultiApi } from './api';

/** The server keeps the level of each player and sends it with their nickname (absent on older servers) */
export const PLAYER_LEVEL_FEATURE = 'player_level';

/**
 * The level shown beside a player of a server. Mine is the one of this phone: the server
 * may not have the latest yet. Null (no emblem): a server older than the levels (`level`
 * absent), or a player whose app has not said theirs yet.
 */
export function shownLevel(level: number | null | undefined, mine: boolean, myLevel: number): number | null {
  if (level === undefined) return null;
  return mine ? myLevel : level;
}

/** The level last said to each server (by address), for this run of the app */
const said = new Map<string, number>();

/**
 * Says my level to the server, when it keeps them and does not have this one yet. Never
 * a reason to fail: the level is decoration, it is said again at the next visit.
 */
export async function sayLevel(api: Pick<MultiApi, 'setLevel'>, url: string, features: string[] | undefined, level: number): Promise<void> {
  if (!features?.includes(PLAYER_LEVEL_FEATURE) || said.get(url) === level) return;
  try {
    await api.setLevel(level);
    said.set(url, level);
  } catch {
    // Said again at the next visit
  }
}

/** For the tests */
export const forgetSaidLevels = () => said.clear();
