import { sampleLevels } from './sampleLevels';

/** A campaign level this many moves above the levels before it is a boss */
export const BOSS_JUMP = 8;
/** Number of levels before a level that set its expected difficulty (their median) */
const BOSS_WINDOW = 5;

/**
 * Ids of the bosses among levels given in campaign order (id = position, from 1): the levels much
 * harder than the ones before them. Levels are only ever added at the end of the campaign, so a
 * level that is a boss stays one.
 */
export function findBossLevels(minMoves: number[]): Set<number> {
  const bosses = new Set<number>();
  for (let i = BOSS_WINDOW; i < minMoves.length; i++) {
    const before = minMoves.slice(i - BOSS_WINDOW, i).sort((a, b) => a - b);
    const median = before[Math.floor(BOSS_WINDOW / 2)];
    if (minMoves[i] - median >= BOSS_JUMP) bosses.add(i + 1);
  }
  return bosses;
}

const BOSS_LEVEL_IDS = findBossLevels(sampleLevels.map(l => l.minMoves));

/** Whether a map level is a boss: announced on the map, extra XP on its first win */
export const isBossLevel = (levelId: number): boolean => BOSS_LEVEL_IDS.has(levelId);
