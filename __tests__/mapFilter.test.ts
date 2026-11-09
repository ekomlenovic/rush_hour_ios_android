import {
  DEFAULT_MAP_FILTER, STARS_UNDER_THREE, filterMapLevels, moveRangeOf, nearestMatch, stepMatch, toggled,
  type MapFilter, type MapFilterContext,
} from '../utils/mapFilter';
import { MAP_LOOKAHEAD } from '../utils/mapFocus';

// A campaign of 10 levels (level 10 a boss) and 2 generated levels; levels 1 to 5 won
const levels = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, gridSize: i < 6 ? 6 : 7, minMoves: 10 + i * 4 })),
  { id: 11, gridSize: 8, minMoves: 12 },
  { id: 12, gridSize: 6, minMoves: 45 },
];
const ctx: MapFilterContext = {
  starsById: new Map([[1, 3], [2, 2], [3, 1], [4, 3], [5, 2], [11, 2]]),
  maxUnlockedLevel: 6,
  campaignSize: 10,
  isBoss: id => id === 10,
};
const find = (filter: Partial<MapFilter>) => filterMapLevels(levels, { ...DEFAULT_MAP_FILTER, ...filter }, ctx);

describe('search on the map', () => {
  it('opens on every level that can be played: the locked ones are left out, the generated ones are in', () => {
    expect(find({})).toEqual([1, 2, 3, 4, 5, 6, 6 + 1, 6 + MAP_LOOKAHEAD, 11, 12]);
    expect(find({ playableOnly: false })).toEqual(levels.map(l => l.id));
  });

  it('finds the levels without 3 stars: not won yet, or won with 1 or 2 stars', () => {
    expect(find({ stars: STARS_UNDER_THREE })).toEqual([2, 3, 5, 6, 7, 8, 11, 12]);
    expect(find({ stars: [1, 2] })).toEqual([2, 3, 5, 11]);
    expect(find({ stars: [3] })).toEqual([1, 4]);
    expect(find({ stars: [0] })).toEqual([6, 7, 8, 12]);
  });

  it('filters by grid size, by number of moves, by source and by boss', () => {
    expect(find({ gridSizes: [7, 8] })).toEqual([7, 8, 11]);
    expect(find({ moves: ['short'] })).toEqual([1, 2, 11]);
    expect(find({ moves: ['long', 'epic'], playableOnly: false })).toEqual([5, 6, 7, 8, 9, 10, 12]);
    expect(find({ source: 'generated' })).toEqual([11, 12]);
    expect(find({ source: 'campaign', stars: [2] })).toEqual([2, 5]);
    expect(find({ bossOnly: true })).toEqual([]);
    expect(find({ bossOnly: true, playableOnly: false })).toEqual([10]);
  });

  it('combines the criteria', () => {
    expect(find({ stars: STARS_UNDER_THREE, gridSizes: [6], moves: ['medium', 'long'] })).toEqual([3, 5, 6]);
  });

  it('ranges the optimal moves', () => {
    expect([1, 14, 15, 24, 25, 39, 40, 200].map(moveRangeOf)).toEqual(['short', 'short', 'medium', 'medium', 'long', 'long', 'epic', 'epic']);
  });
});

describe('going from a match to the next', () => {
  const matches = [2, 3, 5, 11];

  it('starts from the match closest to the level on screen', () => {
    expect(nearestMatch(matches, 4)).toBe(3);
    expect(nearestMatch(matches, 9)).toBe(11);
    expect(nearestMatch(matches, 1)).toBe(2);
    expect(nearestMatch([], 4)).toBeNull();
  });

  it('goes round at the ends', () => {
    expect(stepMatch(matches, 3, 1)).toBe(5);
    expect(stepMatch(matches, 11, 1)).toBe(2);
    expect(stepMatch(matches, 3, -1)).toBe(2);
    expect(stepMatch(matches, 2, -1)).toBe(11);
    expect(stepMatch([], 2, 1)).toBeNull();
  });

  it('goes on from a level that does not match any more (just won with 3 stars)', () => {
    expect(stepMatch(matches, 4, 1)).toBe(5);
    expect(stepMatch(matches, 4, -1)).toBe(3);
  });

  it('toggles a value of a multiple choice', () => {
    expect(toggled([6, 7], 7)).toEqual([6]);
    expect(toggled([6], 8)).toEqual([6, 8]);
  });
});
