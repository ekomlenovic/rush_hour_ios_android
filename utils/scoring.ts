/**
 * Calculate the score based on moves vs optimal.
 * Perfect play = max score. Each extra move costs 15 points.
 */
export function calculateScore(moveCount: number, minMoves: number): number {
  const maxScore = minMoves * 100;
  const penalty = Math.max(0, moveCount - minMoves) * 15;
  return Math.max(0, maxScore - penalty);
}

/** 3 stars for the optimal solution, 2 within 3 extra moves, otherwise 1 (see docs/GAME_DESIGN.md) */
export function getStars(moveCount: number, minMoves: number): number {
  return moveCount <= minMoves ? 3 : moveCount <= minMoves + 3 ? 2 : 1;
}
