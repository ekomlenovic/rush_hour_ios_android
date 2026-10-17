/**
 * Daily missions: 3 small goals renewed every day, the same for everyone on a given date.
 * "Level" counters only count map and custom levels, never the daily / weekly challenges
 * (see docs/GAME_DESIGN.md).
 */

import type { IoniconName } from '../utils/icons';

export type MissionCounter =
  | 'levelWins'
  | 'perfectWins'
  | 'noHintWins'
  | 'cleanWins'
  | 'bigGridWins'
  | 'newLevelWins'
  | 'fastWins'
  | 'dailyDone'
  | 'moves'
  | 'playMs';

export interface MissionDef {
  /** Also the i18n key: missions.list.<id> */
  id: string;
  icon: IoniconName;
  counter: MissionCounter;
  target: number;
}

export interface DailyMissionsState {
  /** YYYY-MM-DD */
  date: string;
  ids: string[];
  counters: Partial<Record<MissionCounter, number>>;
  /** Reward for completing all missions already granted */
  rewarded: boolean;
}

/** What completing the 3 missions of the day gave */
export interface MissionReward {
  /** False when the freeze stock was full */
  freezeGranted: boolean;
  xp: number;
}

export const MISSIONS_PER_DAY = 3;

/** A win counts for the "fast" missions under this time */
export const FAST_WIN_MS = 60 * 1000;

/** IDs are persisted for the current day: never rename one, only add new ones. */
export const MISSIONS: MissionDef[] = [
  { id: 'win_3', icon: 'flag', counter: 'levelWins', target: 3 },
  { id: 'win_5', icon: 'car', counter: 'levelWins', target: 5 },
  { id: 'perfect_2', icon: 'star', counter: 'perfectWins', target: 2 },
  { id: 'no_hint', icon: 'bulb', counter: 'noHintWins', target: 1 },
  { id: 'clean', icon: 'locate', counter: 'cleanWins', target: 1 },
  { id: 'big_grid', icon: 'map', counter: 'bigGridWins', target: 1 },
  { id: 'daily', icon: 'calendar', counter: 'dailyDone', target: 1 },
  { id: 'moves_100', icon: 'footsteps', counter: 'moves', target: 100 },
  { id: 'play_10min', icon: 'hourglass', counter: 'playMs', target: 10 * 60 * 1000 },
  { id: 'win_8', icon: 'trail-sign', counter: 'levelWins', target: 8 },
  { id: 'perfect_3', icon: 'sparkles', counter: 'perfectWins', target: 3 },
  { id: 'no_hint_3', icon: 'school', counter: 'noHintWins', target: 3 },
  { id: 'clean_3', icon: 'ribbon', counter: 'cleanWins', target: 3 },
  { id: 'big_grid_3', icon: 'compass', counter: 'bigGridWins', target: 3 },
  { id: 'moves_250', icon: 'walk', counter: 'moves', target: 250 },
  { id: 'play_20min', icon: 'time', counter: 'playMs', target: 20 * 60 * 1000 },
  { id: 'new_2', icon: 'add-circle', counter: 'newLevelWins', target: 2 },
  { id: 'new_4', icon: 'rocket', counter: 'newLevelWins', target: 4 },
  { id: 'fast_1', icon: 'flash', counter: 'fastWins', target: 1 },
  { id: 'fast_3', icon: 'speedometer', counter: 'fastWins', target: 3 },
];

export const MISSIONS_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map(m => [m.id, m]));

/** Small deterministic PRNG (mulberry32) seeded from a string */
function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The missions of a day: distinct counters, so no mission is a subset of another */
export function pickMissions(dateKey: string): string[] {
  const random = seededRandom(`missions-${dateKey}`);
  const pool = [...MISSIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked: MissionDef[] = [];
  for (const mission of pool) {
    if (picked.length === MISSIONS_PER_DAY) break;
    if (!picked.some(m => m.counter === mission.counter)) picked.push(mission);
  }
  return picked.map(m => m.id);
}

/** The saved missions if they are today's, otherwise a fresh set */
export function getMissionsForDay(state: DailyMissionsState | null, dateKey: string): DailyMissionsState {
  if (state && state.date === dateKey) return state;
  return { date: dateKey, ids: pickMissions(dateKey), counters: {}, rewarded: false };
}

export function getMissionProgress(mission: MissionDef, counters: DailyMissionsState['counters']): number {
  return Math.min(counters[mission.counter] || 0, mission.target);
}

export function isMissionDone(mission: MissionDef, counters: DailyMissionsState['counters']): boolean {
  return getMissionProgress(mission, counters) >= mission.target;
}

export function countMissionsDone(state: DailyMissionsState): number {
  return state.ids.filter(id => MISSIONS_BY_ID[id] && isMissionDone(MISSIONS_BY_ID[id], state.counters)).length;
}
