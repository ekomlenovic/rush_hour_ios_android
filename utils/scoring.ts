/**
 * Calculate the score based on moves vs optimal.
 * Perfect play = max score. Each extra move costs 15 points.
 */
export function calculateScore(moveCount: number, minMoves: number): number {
  const maxScore = minMoves * 100;
  const penalty = Math.max(0, moveCount - minMoves) * 15;
  return Math.max(0, maxScore - penalty);
}

/** Extra moves still worth 2 stars: a quarter of the optimum, rounded up (12 → 3, 40 → 10) */
export function twoStarTolerance(minMoves: number): number {
  return Math.max(1, Math.ceil(minMoves / 4));
}

/** 3 stars for the optimal solution, 2 within twoStarTolerance extra moves, otherwise 1 (see docs/GAME_DESIGN.md) */
export function getStars(moveCount: number, minMoves: number): number {
  return moveCount <= minMoves ? 3 : moveCount <= minMoves + twoStarTolerance(minMoves) ? 2 : 1;
}

/** Stars of a win known only by its score (calculateScore): a score of 0 hides the move count, far past 2 stars anyway */
export function starsFromScore(score: number, minMoves: number): number {
  if (score <= 0) return 1;
  const extraMoves = Math.max(0, Math.ceil((minMoves * 100 - score) / 15));
  return getStars(minMoves + extraMoves, minMoves);
}
