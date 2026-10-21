import { BOSS_JUMP, findBossLevels, isBossLevel } from '../data/bosses';
import { sampleLevels } from '../data/sampleLevels';
import { MAP_LOOKAHEAD, isMapLevelUnlocked } from '../utils/mapFocus';

describe('boss levels (rules in docs/GAME_DESIGN.md)', () => {
  it('is a level well above the median of the 5 before it', () => {
    expect([...findBossLevels([10, 10, 10, 10, 10, 10 + BOSS_JUMP])]).toEqual([6]);
    expect([...findBossLevels([10, 10, 10, 10, 10, 10 + BOSS_JUMP - 1])]).toEqual([]);
    // One easy level among hard ones does not lower the bar
    expect([...findBossLevels([20, 20, 6, 20, 20, 20 + BOSS_JUMP - 1])]).toEqual([]);
  });

  it('marks the jumps of the campaign, not its first levels', () => {
    for (const id of [30, 46, 101, 287, 306]) expect(isBossLevel(id)).toBe(true);
    for (let id = 1; id < 30; id++) expect(isBossLevel(id)).toBe(false);
  });

  it('only marks campaign levels', () => {
    expect(isBossLevel(sampleLevels.length + 1)).toBe(false);
    expect(isBossLevel(0)).toBe(false);
  });

  it('does not change when levels are added at the end of the campaign', () => {
    const moves = sampleLevels.map(l => l.minMoves);
    const shorter = findBossLevels(moves.slice(0, 300));
    const all = findBossLevels(moves);
    expect([...all].filter(id => id <= 300)).toEqual([...shorter]);
  });
});

describe('map unlocking', () => {
  it('opens the next level and the ones after it', () => {
    expect(isMapLevelUnlocked(101, 101)).toBe(true);
    expect(isMapLevelUnlocked(101 + MAP_LOOKAHEAD, 101)).toBe(true);
    expect(isMapLevelUnlocked(102 + MAP_LOOKAHEAD, 101)).toBe(false);
    expect(isMapLevelUnlocked(1, 1)).toBe(true);
    expect(isMapLevelUnlocked(3, 1)).toBe(true);
    expect(isMapLevelUnlocked(4, 1)).toBe(false);
  });
});
