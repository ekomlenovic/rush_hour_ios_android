/**
 * Daily missions: 3 small goals renewed every day, the same for everyone on a given date.
 * "Level" counters only count map and custom levels, never the daily / weekly challenges
 * (see docs/GAME_DESIGN.md).
 */

export type MissionCounter =
  | 'levelWins'
  | 'perfectWins'
  | 'noHintWins'
  | 'cleanWins'
  | 'bigGridWins'
  | 'dailyDone'
  | 'moves'
  | 'playMs';

export interface MissionDef {
  /** Also the i18n key: missions.list.<id> */
  id: string;
  icon: string;
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

/** IDs are persisted for the current day: never rename one, only add new ones. */
export const MISSIONS: MissionDef[] = [
  { id: 'win_3', icon: '🏁', counter: 'levelWins', target: 3 },
  { id: 'win_5', icon: '🚗', counter: 'levelWins', target: 5 },
  { id: 'perfect_2', icon: '⭐', counter: 'perfectWins', target: 2 },
  { id: 'no_hint', icon: '🧠', counter: 'noHintWins', target: 1 },
  { id: 'clean', icon: '🎯', counter: 'cleanWins', target: 1 },
  { id: 'big_grid', icon: '🗺️', counter: 'bigGridWins', target: 1 },
  { id: 'daily', icon: '📅', counter: 'dailyDone', target: 1 },
  { id: 'moves_100', icon: '👣', counter: 'moves', target: 100 },
  { id: 'play_10min', icon: '⏳', counter: 'playMs', target: 10 * 60 * 1000 },
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
