import type { Level } from '../store/types';
import { WEEKLY_LEVEL_ID } from '../store/levelIds';
import { sampleLevels } from '../data/sampleLevels';
import { COLORS, createPRNG, shuffleWith, transformLevel } from './generator';

/** Campaign levels at least this hard feed the weekly challenge */
const WEEKLY_MIN_MOVES = 25;
/** Stride through the pool: consecutive weeks get unrelated levels */
const WEEKLY_POOL_STRIDE = 23;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Number of weeks between 1970 and the Monday of an ISO week key ('2026-W42') */
function getWeekIndex(weekKey: string): number {
  const [year, week] = weekKey.split('-W').map(Number);
  // January 4th is always in ISO week 1
  const jan4 = Date.UTC(year, 0, 4);
  const jan4DayOfWeek = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (jan4DayOfWeek - 1) * 86400000 + (week - 1) * WEEK_MS;
  return Math.round(monday / WEEK_MS);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Weekly challenge: same puzzle for everyone during an ISO week, harder than the daily.
 * Built from a hard campaign level, disguised by a symmetry and new colors:
 * instant to produce and the minimum number of moves is already known.
 */
export async function generateWeeklyLevel(weekKey: string): Promise<Level | null> {
  const pool = sampleLevels.filter(l => l.minMoves >= WEEKLY_MIN_MOVES);
  if (pool.length === 0) return null;

  const weekIndex = getWeekIndex(weekKey);
  // A stride coprime with the pool size visits every level before repeating one
  const stride = gcd(WEEKLY_POOL_STRIDE, pool.length) === 1 ? WEEKLY_POOL_STRIDE : 1;
  const source = pool[(weekIndex * stride) % pool.length];
  // Never the identity, so the level does not look like its campaign version
  const symmetry = 1 + (weekIndex % 7);

  const transformed = transformLevel(source, symmetry);

  // Shuffle the colors of the other vehicles
  const random = createPRNG(`weekly-${weekKey}`);
  const colors = shuffleWith(COLORS, random);
  let colorIndex = 0;
  const vehicles = transformed.vehicles.map(v =>
    v.isTarget ? v : { ...v, color: colors[colorIndex++ % colors.length] }
  );

  return { ...transformed, id: WEEKLY_LEVEL_ID, vehicles, updatedAt: Date.now() };
}
