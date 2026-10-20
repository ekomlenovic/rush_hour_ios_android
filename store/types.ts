/** Data types of the game store (persisted shapes: never rename a field) */

/** Light / dark choice of the interface ('system' follows the device) */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Describes a single vehicle/block on the grid */
export interface Vehicle {
  id: string;
  /** Row (for vertical) or Row (for horizontal) — top-left cell */
  row: number;
  /** Column — top-left cell */
  col: number;
  /** Number of cells this vehicle occupies (2 or 3 typically) */
  length: number;
  /** Movement axis */
  orientation: 'horizontal' | 'vertical';
  /** Whether this is the target vehicle that must exit */
  isTarget: boolean;
  /** Color used for rendering */
  color: string;
}

/** Describes a level */
export interface Level {
  id: number;
  /** Grid dimensions (e.g. 6 for 6×6, 7 for 7×7, etc.) */
  gridSize: number;
  /** Initial vehicle placements */
  vehicles: Vehicle[];
  /** Exit position: row & col of the exit cell on the grid edge */
  exitRow: number;
  exitCol: number;
  /** Minimum number of moves to solve (computed by BFS solver) */
  minMoves: number;
  /** Timestamp of creation/last modification */
  updatedAt: number;
  /** Whether the level is marked as a favorite */
  isFavorite?: boolean;
  /** Name given by the player (custom levels), travels in the share link */
  name?: string;
}

/** Player progress for a specific level */
export interface LevelProgress {
  levelId: number;
  completed: boolean;
  bestScore: number;
  stars?: number;
  /** Fastest win, in milliseconds of active play */
  bestTimeMs?: number;
  /** Won at least once without using a hint */
  noHint?: boolean;
  /** Won at least once without hint nor undo */
  noHelp?: boolean;
}

/** Help used during the current attempt of a level */
export interface AttemptStats {
  hints: number;
  undos: number;
  resets: number;
  /** Active play time (app in foreground, game screen open) */
  elapsedMs: number;
}

/**
 * One move of the move log: a vehicle slid by `delta` cells along its axis
 * (right / down is positive), `t` milliseconds after the start of the attempt.
 * A drag across several cells is a single move, as in the move counter.
 */
export interface MoveRecord {
  vehicleId: string;
  delta: number;
  t: number;
}

/** Saved state for an ongoing level session */
export interface LevelSaveState {
  vehicles: Vehicle[];
  moveCount: number;
  history: Vehicle[][];
  attempt?: AttemptStats;
  /** Moves since the start or the last reset (undo adds the opposite move); missing in saves from before 1.2 */
  moveLog?: MoveRecord[];
  /** Wall-clock start of the attempt (ms since epoch), the origin of the move times */
  startedAt?: number;
  /** Wall-clock time of the last change (ms since epoch); missing in saves from before v11 */
  savedAt?: number;
}

/** Result of a daily or weekly challenge */
export interface ChallengeResult {
  completed: boolean;
  score: number;
  stars: number;
  timeMs?: number;
  /** Moves of the best result and the level's optimum, for result sharing */
  moves?: number;
  minMoves?: number;
  /** Moves of the best result, to replay the player's own solution */
  moveLog?: MoveRecord[];
}

/** Extra details recorded with a challenge result */
export interface ChallengeDetails {
  moves: number;
  minMoves: number;
  moveLog?: MoveRecord[];
}

/** Lifetime player statistics */
export interface PlayerStats {
  totalPlayTimeMs: number;
  totalMoves: number;
  totalUndos: number;
  totalResets: number;
  totalWins: number;
  /** Wins without any reset during the attempt */
  firstTryWins: number;
  /** Wins per grid size, keyed by size ('6', '7', '8') */
  winsByGridSize: Record<string, number>;
  levelsShared: number;
  /** Daily / weekly results shared (Wordle-like text) */
  resultsShared: number;
  levelsImported: number;
  /** Highest minMoves of a level ever won */
  hardestWinMoves: number;
  /** Fastest win on a level of at least 10 optimal moves */
  fastestWinMs: number | null;
  /** Wins between midnight and 5 AM */
  nightWins: number;
  /** Wins on January 1st */
  newYearWins: number;
  /** Wins on special days, keyed by 'MM-DD' (e.g. '12-25') or 'fri13' */
  specialDayWins: Record<string, number>;
  /** Longest active time spent on a level before winning it */
  longestWinMs: number;
  /** Most resets during a winning attempt */
  maxResetsBeforeWin: number;
  /** Highest minMoves of a level won with 3 stars */
  hardestPerfectMoves: number;
  /** Daily challenges won between 5 and 7 AM */
  earlyDailyWins: number;
  /** Weekly challenges won on Sunday, the last day */
  lastMinuteWeeklies: number;
  /** Streak freezes earned and consumed */
  freezesEarned: number;
  freezesUsed: number;
  /** Days with all daily missions completed */
  missionDaysCompleted: number;
  /** Longest absence between two app opens, in days */
  longestAbsenceDays: number;
}

/** What happened since the last app open */
export interface AppOpenInfo {
  isComeback: boolean;
  missedDays: number;
  /** Missed days covered by streak freezes */
  frozenDays: number;
  /** Streak value lost because there were not enough freezes */
  lostStreak: number;
}
