import { calculateScore, getStars, starsFromScore } from '../utils/scoring';

describe('stars (rules in docs/GAME_DESIGN.md)', () => {
  it('3 stars for the optimal solution, 2 within a quarter of the optimum (rounded up), otherwise 1', () => {
    expect(getStars(12, 12)).toBe(3);
    expect(getStars(13, 12)).toBe(2);
    expect(getStars(15, 12)).toBe(2);
    expect(getStars(16, 12)).toBe(1);
  });

  it('gives harder levels a proportional margin for 2 stars', () => {
    expect(getStars(50, 40)).toBe(2);
    expect(getStars(51, 40)).toBe(1);
    expect(getStars(25, 20)).toBe(2);
    expect(getStars(26, 20)).toBe(1);
    expect(getStars(8, 6)).toBe(2);
    expect(getStars(9, 6)).toBe(1);
    expect(getStars(2, 1)).toBe(2);
  });

  it('can be found back from the score alone', () => {
    for (const minMoves of [6, 12, 20, 40]) {
      for (let moves = minMoves; moves < minMoves * 3; moves++) {
        expect(starsFromScore(calculateScore(moves, minMoves), minMoves)).toBe(getStars(moves, minMoves));
      }
    }
    expect(starsFromScore(0, 12)).toBe(1);
  });
});

describe('score', () => {
  it('is 100 per optimal move, minus 15 per extra move, never negative', () => {
    expect(calculateScore(12, 12)).toBe(1200);
    expect(calculateScore(14, 12)).toBe(1170);
    expect(calculateScore(500, 12)).toBe(0);
  });
});
