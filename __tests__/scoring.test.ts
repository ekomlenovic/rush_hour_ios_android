import { calculateScore, getStars } from '../utils/scoring';

describe('stars (rules in docs/GAME_DESIGN.md)', () => {
  it('3 stars for the optimal solution, 2 within 3 extra moves, otherwise 1', () => {
    expect(getStars(12, 12)).toBe(3);
    expect(getStars(13, 12)).toBe(2);
    expect(getStars(15, 12)).toBe(2);
    expect(getStars(16, 12)).toBe(1);
  });
});

describe('score', () => {
  it('is 100 per optimal move, minus 15 per extra move, never negative', () => {
    expect(calculateScore(12, 12)).toBe(1200);
    expect(calculateScore(14, 12)).toBe(1170);
    expect(calculateScore(500, 12)).toBe(0);
  });
});
