import type { Level } from '../store/types';
import { DAILY_LEVEL_ID } from '../store/levelIds';
import { parseLocalDateString } from './date';
import { DIFFICULTY_LEVELS, generateSeededLevelSync, type DifficultyConfig } from './generator.core';
import { runOnSolverRuntime } from './solver.background';

/**
 * The generator of the app. Its logic is in generator.core.ts, free of react-native: the
 * server (#47) and the scripts import that one.
 */
export * from './generator.core';

/**
 * The level of the daily challenge of a date: NORMAL usually, HARD on Mondays.
 * Generated in the background, as it takes seconds on a Monday (issue 159).
 */
export async function generateDailyLevel(dateStr: string): Promise<Level | null> {
  const isMonday = parseLocalDateString(dateStr).getDay() === 1;
  const difficulty = isMonday ? DIFFICULTY_LEVELS.HARD : DIFFICULTY_LEVELS.NORMAL;

  return generateSeededLevel(dateStr, DAILY_LEVEL_ID, difficulty);
}

/** generateSeededLevelSync on the solver runtime: the JS thread (touches, back button) stays free */
export function generateSeededLevel(seed: string, id: number, difficulty: DifficultyConfig): Promise<Level | null> {
  return runOnSolverRuntime(generateSeededLevelSync, seed, id, difficulty);
}
