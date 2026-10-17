import type { MoveRecord } from '../../store/types';

/**
 * Replay of a duel: the moves of the two players on one timeline (their times are
 * both from the start of the duel), so that both boards play at the real pace.
 */

/** A move of the timeline, and whose it is (index of the player) */
export interface DuelStep { player: number; move: MoveRecord }

/** The moves of all players in the order they were played (the first player first on a tie) */
export function mergeDuelMoves(players: readonly { moves: readonly MoveRecord[] }[]): DuelStep[] {
  return players
    .flatMap((p, player) => p.moves.map((move, index) => ({ player, move, index })))
    .sort((a, b) => a.move.t - b.move.t || a.player - b.player || a.index - b.index)
    .map(({ player, move }) => ({ player, move }));
}

/** How many moves each player has played after the first `step` moves of the timeline */
export function movesPlayedAt(steps: readonly DuelStep[], step: number, playerCount: number): number[] {
  const counts = Array(playerCount).fill(0);
  for (const s of steps.slice(0, Math.max(0, step))) counts[s.player]++;
  return counts;
}
