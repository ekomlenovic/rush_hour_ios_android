/** Rankings: moves then time for a day, points for a week or a month (rules in #46) */

/** Points of the ranks 1 to 7 of a day; any other win scores 1, anything else 0 */
export const RANK_POINTS = [10, 8, 6, 5, 4, 3, 2];
export const WIN_POINTS = 1;

export const pointsForRank = (rank: number): number => RANK_POINTS[rank - 1] ?? WIN_POINTS;

import type { Flag } from './cheat';

export type GameStatus = 'playing' | 'won' | 'abandoned' | 'unfinished';

/** ⚠️ suspect: automatic, shown with its reasons; 🤡 cheater: confirmed by the admin */
export type Verdict = 'suspect' | 'cheater' | null;

export interface GameResult {
  playerId: number;
  pseudo: string;
  date: string;
  status: GameStatus;
  moves: number | null;
  timeMs: number | null;
  /** The game, to watch its replay */
  attemptId: number;
  verdict: Verdict;
  /** Why it is suspect (empty otherwise) */
  reasons: Flag[];
}

export interface DayRow extends GameResult {
  /** Null when not won */
  rank: number | null;
  points: number;
}

const STATUS_ORDER: Record<GameStatus, number> = { won: 0, playing: 1, unfinished: 2, abandoned: 3 };

/**
 * The ranking of one day: wins by moves then time (exact ties share a rank), then games
 * in progress, then the others. A confirmed cheater keeps their rank but scores 0: the
 * others do not move up.
 */
export function rankDay(results: GameResult[]): DayRow[] {
  const sorted = [...results].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || (a.status === 'won' ? a.moves! - b.moves! || a.timeMs! - b.timeMs! : 0)
    || a.pseudo.localeCompare(b.pseudo));

  let previous: DayRow | null = null;
  return sorted.map((result, index) => {
    let row: DayRow;
    if (result.status !== 'won') {
      row = { ...result, rank: null, points: 0 };
    } else {
      const tied = previous?.status === 'won' && previous.moves === result.moves && previous.timeMs === result.timeMs;
      const rank = tied ? previous!.rank! : index + 1;
      row = { ...result, rank, points: result.verdict === 'cheater' ? 0 : pointsForRank(rank) };
    }
    previous = row;
    return row;
  });
}

export interface PeriodRow {
  playerId: number;
  pseudo: string;
  rank: number;
  points: number;
  wins: number;
  played: number;
}

/** The ranking of a week or a month: sum of the points of each day, then wins */
export function rankPeriod(results: GameResult[]): PeriodRow[] {
  const byDate = new Map<string, GameResult[]>();
  for (const r of results) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  const totals = new Map<number, Omit<PeriodRow, 'rank'>>();
  for (const day of byDate.values()) {
    for (const row of rankDay(day)) {
      const total = totals.get(row.playerId) ?? { playerId: row.playerId, pseudo: row.pseudo, points: 0, wins: 0, played: 0 };
      total.points += row.points;
      total.wins += row.status === 'won' && row.verdict !== 'cheater' ? 1 : 0;
      total.played += 1;
      totals.set(row.playerId, total);
    }
  }

  const sorted = [...totals.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.pseudo.localeCompare(b.pseudo));
  const rows: PeriodRow[] = [];
  sorted.forEach((total, index) => {
    const previous = rows[index - 1];
    const tied = previous && previous.points === total.points && previous.wins === total.wins;
    rows.push({ ...total, rank: tied ? previous.rank : index + 1 });
  });
  return rows;
}
