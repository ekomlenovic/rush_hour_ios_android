import type { Database } from './db';
import type { Level, MoveRecord } from './core';
import type { DuelLook, DuelMetric, DuelRecord, EndReason, HeadToHead } from './duel';
import { localDate } from './time';

/**
 * The finished duels, kept in the database: the score of two players against each
 * other, the rankings of duels, the history and the replays of a player.
 */

interface DuelRow {
  id: number;
  date: string;
  difficulty: string;
  metric: DuelMetric;
  level_json: string;
  min_moves: number;
  started_at: number;
  ended_at: number;
  reason: EndReason;
  winner_id: number | null;
  player1_id: number;
  player2_id: number;
  moves1: number;
  moves2: number;
  moves1_json: string | null;
  moves2_json: string | null;
  look1_json: string | null;
  look2_json: string | null;
}

export interface DuelStats { playerId: number; pseudo: string; wins: number; losses: number; draws: number; played: number }
export interface DuelRankRow extends DuelStats { rank: number }

/** Duel rankings: wins, then fewer losses; the same wins and losses share a rank */
export function rankDuels(stats: DuelStats[]): DuelRankRow[] {
  const sorted = [...stats].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.pseudo.localeCompare(b.pseudo));
  const rows: DuelRankRow[] = [];
  sorted.forEach((s, index) => {
    const previous = rows[index - 1];
    const tied = previous && previous.wins === s.wins && previous.losses === s.losses;
    rows.push({ ...s, rank: tied ? previous.rank : index + 1 });
  });
  return rows;
}

export interface DuelHistoryItem {
  id: number;
  endedAt: number;
  difficulty: string;
  metric: DuelMetric;
  reason: EndReason;
  winnerId: number | null;
  opponent: { id: number; pseudo: string };
  myMoves: number;
  theirMoves: number;
  timeMs: number | null;
  hasReplay: boolean;
}

export interface DuelRecordLine { opponent: { id: number; pseudo: string }; wins: number; losses: number; draws: number }

export interface DuelReplay {
  id: number;
  date: string;
  difficulty: string;
  metric: DuelMetric;
  level: Level;
  reason: EndReason;
  winnerId: number | null;
  /** look: null for a duel before the looks were kept, or a player with an app older than them */
  players: { id: number; pseudo: string; moves: MoveRecord[]; look: DuelLook | null }[];
}

const lastTime = (moves: MoveRecord[]) => (moves.length ? moves[moves.length - 1].t : null);

export class DuelStore {
  constructor(private readonly db: Database, private readonly timeZone: string) {}

  save(record: DuelRecord): { id: number; score: HeadToHead } {
    const [a, b] = record.players;
    const result = this.db.prepare(`
      INSERT INTO duels (date, difficulty, metric, level_json, min_moves, started_at, ended_at, reason, winner_id,
        player1_id, player2_id, moves1, moves2, moves1_json, moves2_json, look1_json, look2_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      localDate(record.endedAt, this.timeZone), record.difficulty, record.metric, JSON.stringify(record.level), record.level.minMoves,
      record.startedAt, record.endedAt, record.reason, record.winnerId,
      a.id, b.id, a.moves.length, b.moves.length, JSON.stringify(a.moves), JSON.stringify(b.moves),
      a.look ? JSON.stringify(a.look) : null, b.look ? JSON.stringify(b.look) : null,
    );
    return { id: Number(result.lastInsertRowid), score: this.headToHead(a.id, b.id) };
  }

  /** All the duels of two players against each other */
  headToHead(a: number, b: number): HeadToHead {
    const rows = this.db.prepare(`
      SELECT winner_id AS winner, COUNT(*) AS count FROM duels
      WHERE (player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?) GROUP BY winner_id
    `).all(a, b, b, a) as { winner: number | null; count: number }[];
    const count = (id: number | null) => rows.find(r => r.winner === id)?.count ?? 0;
    return { wins: [{ playerId: a, count: count(a) }, { playerId: b, count: count(b) }], draws: count(null) };
  }

  /** Wins, losses and draws of each player between two days (players excluded by the admin are left out) */
  stats(from: string, to: string): DuelStats[] {
    const rows = this.db.prepare(`
      SELECT p.id AS playerId, p.pseudo AS pseudo,
        SUM(d.winner_id = p.id) AS wins,
        SUM(d.winner_id IS NOT NULL AND d.winner_id != p.id) AS losses,
        SUM(d.winner_id IS NULL) AS draws,
        COUNT(*) AS played
      FROM duels d JOIN players p ON p.id IN (d.player1_id, d.player2_id)
      WHERE d.date BETWEEN ? AND ? AND p.banned = 0
      GROUP BY p.id
    `).all(from, to) as unknown as DuelStats[];
    return rows.map(r => ({ ...r, wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws), played: Number(r.played) }));
  }

  /** The last duels of a player, newest first */
  history(playerId: number, limit = 20): DuelHistoryItem[] {
    const rows = this.db.prepare(`
      SELECT d.*, CASE WHEN d.player1_id = ? THEN d.player2_id ELSE d.player1_id END AS opponent_id,
        p.pseudo AS opponent_pseudo
      FROM duels d JOIN players p ON p.id = CASE WHEN d.player1_id = ? THEN d.player2_id ELSE d.player1_id END
      WHERE ? IN (d.player1_id, d.player2_id)
      ORDER BY d.ended_at DESC, d.id DESC LIMIT ?
    `).all(playerId, playerId, playerId, limit) as unknown as (DuelRow & { opponent_id: number; opponent_pseudo: string })[];
    return rows.map(d => {
      const first = d.player1_id === playerId;
      const winnerMoves = d.winner_id === d.player1_id ? d.moves1_json : d.winner_id === d.player2_id ? d.moves2_json : null;
      return {
        id: d.id,
        endedAt: d.ended_at,
        difficulty: d.difficulty,
        metric: d.metric,
        reason: d.reason,
        winnerId: d.winner_id,
        opponent: { id: d.opponent_id, pseudo: d.opponent_pseudo },
        myMoves: first ? d.moves1 : d.moves2,
        theirMoves: first ? d.moves2 : d.moves1,
        timeMs: d.reason === 'won' && winnerMoves ? lastTime(JSON.parse(winnerMoves) as MoveRecord[]) : null,
        hasReplay: d.moves1_json !== null,
      };
    });
  }

  /** The score of a player against each of their opponents, the most played first */
  records(playerId: number): DuelRecordLine[] {
    const rows = this.db.prepare(`
      SELECT p.id AS id, p.pseudo AS pseudo,
        SUM(d.winner_id = ?) AS wins,
        SUM(d.winner_id = p.id) AS losses,
        SUM(d.winner_id IS NULL) AS draws
      FROM duels d JOIN players p ON p.id = CASE WHEN d.player1_id = ? THEN d.player2_id ELSE d.player1_id END
      WHERE ? IN (d.player1_id, d.player2_id)
      GROUP BY p.id ORDER BY COUNT(*) DESC, p.pseudo
    `).all(playerId, playerId, playerId) as { id: number; pseudo: string; wins: number; losses: number; draws: number }[];
    return rows.map(r => ({ opponent: { id: r.id, pseudo: r.pseudo }, wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws) }));
  }

  /** A duel with the moves of both players; null if unknown */
  replay(id: number): (DuelReplay & { hasReplay: boolean }) | null {
    const d = this.db.prepare(`
      SELECT d.*, p1.pseudo AS pseudo1, p2.pseudo AS pseudo2 FROM duels d
      JOIN players p1 ON p1.id = d.player1_id JOIN players p2 ON p2.id = d.player2_id WHERE d.id = ?
    `).get(id) as (DuelRow & { pseudo1: string; pseudo2: string }) | undefined;
    if (!d) return null;
    const moves = (json: string | null) => (json ? JSON.parse(json) as MoveRecord[] : []);
    const look = (json: string | null) => (json ? JSON.parse(json) as DuelLook : null);
    return {
      id: d.id,
      date: d.date,
      difficulty: d.difficulty,
      metric: d.metric,
      level: JSON.parse(d.level_json) as Level,
      reason: d.reason,
      winnerId: d.winner_id,
      players: [
        { id: d.player1_id, pseudo: d.pseudo1, moves: moves(d.moves1_json), look: look(d.look1_json) },
        { id: d.player2_id, pseudo: d.pseudo2, moves: moves(d.moves2_json), look: look(d.look2_json) },
      ],
      hasReplay: d.moves1_json !== null,
    };
  }
}
