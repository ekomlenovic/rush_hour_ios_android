import { describe, expect, it } from 'vitest';
import { pointsForRank, rankDay, rankPeriod, type GameResult } from '../src/leaderboard';

const win = (playerId: number, moves: number, timeMs: number, date = '2026-10-16', verdict: GameResult['verdict'] = null): GameResult =>
  ({ playerId, pseudo: `p${playerId}`, date, status: 'won', moves, timeMs, attemptId: playerId, verdict, reasons: [] });
const other = (playerId: number, status: GameResult['status'], date = '2026-10-16'): GameResult =>
  ({ playerId, pseudo: `p${playerId}`, date, status, moves: null, timeMs: null, attemptId: playerId, verdict: null, reasons: [] });

describe('ranking of a day', () => {
  it('moves first, then time', () => {
    const rows = rankDay([win(1, 20, 10_000), win(2, 15, 90_000), win(3, 15, 60_000)]);
    expect(rows.map(r => [r.playerId, r.rank, r.points])).toEqual([[3, 1, 10], [2, 2, 8], [1, 3, 6]]);
  });

  it('F1 points for the first 7, then 1 point per win', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 20].map(pointsForRank)).toEqual([10, 8, 6, 5, 4, 3, 2, 1, 1]);
  });

  it('an exact tie shares the rank and the points, the next rank is skipped', () => {
    const rows = rankDay([win(1, 15, 60_000), win(2, 15, 60_000), win(3, 16, 1000)]);
    expect(rows.map(r => [r.rank, r.points])).toEqual([[1, 10], [1, 10], [3, 6]]);
  });

  it('games in progress, unfinished and abandoned come last with no rank nor points', () => {
    const rows = rankDay([other(1, 'abandoned'), other(2, 'unfinished'), win(3, 30, 1000), other(4, 'playing')]);
    expect(rows.map(r => [r.playerId, r.rank, r.points])).toEqual([[3, 1, 10], [4, null, 0], [2, null, 0], [1, null, 0]]);
  });
});

describe('cheaters', () => {
  it('a confirmed cheater keeps their rank but scores nothing: the others do not move up', () => {
    const rows = rankDay([win(1, 10, 5000, '2026-10-16', 'cheater'), win(2, 12, 1000), win(3, 14, 1000, '2026-10-16', 'suspect')]);
    expect(rows.map(r => [r.playerId, r.rank, r.points, r.verdict])).toEqual([[1, 1, 0, 'cheater'], [2, 2, 8, null], [3, 3, 6, 'suspect']]);
  });

  it('their wins do not count in the week', () => {
    const rows = rankPeriod([win(1, 10, 5000, '2026-10-12', 'cheater'), win(2, 12, 1000, '2026-10-12')]);
    expect(rows.map(r => [r.playerId, r.points, r.wins])).toEqual([[2, 8, 1], [1, 0, 0]]);
  });
});

describe('ranking of a week or a month', () => {
  it('adds up the points of each day, then the number of wins', () => {
    const rows = rankPeriod([
      win(1, 10, 1000, '2026-10-12'), win(2, 12, 1000, '2026-10-12'),           // 1: 10, 2: 8
      win(2, 10, 1000, '2026-10-13'), win(1, 11, 1000, '2026-10-13'),           // 2: 10, 1: 8
      win(3, 10, 1000, '2026-10-14'), other(1, 'abandoned', '2026-10-14'),       // 3: 10, 1: 0
    ]);
    expect(rows.map(r => [r.playerId, r.rank, r.points, r.wins, r.played])).toEqual([
      [1, 1, 18, 2, 3], [2, 1, 18, 2, 2], [3, 3, 10, 1, 1],
    ]);
  });

  it('a missed day scores nothing', () => {
    const rows = rankPeriod([win(1, 10, 1000, '2026-10-12'), win(2, 10, 2000, '2026-10-12'), win(2, 10, 1000, '2026-10-13')]);
    expect(rows.map(r => [r.playerId, r.points])).toEqual([[2, 18], [1, 10]]);
  });

  it('gives the points of each day played, in order', () => {
    const rows = rankPeriod([
      win(1, 10, 1000, '2026-10-14'), other(1, 'abandoned', '2026-10-12'), win(2, 10, 1000, '2026-10-12'),
    ]);
    expect(rows.find(r => r.playerId === 1)!.days).toEqual([
      { date: '2026-10-12', points: 0, status: 'abandoned' }, { date: '2026-10-14', points: 10, status: 'won' },
    ]);
    expect(rows.find(r => r.playerId === 2)!.days).toEqual([{ date: '2026-10-12', points: 10, status: 'won' }]);
  });
});
