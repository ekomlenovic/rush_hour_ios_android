import { createHash } from 'crypto';
import { CAMPAIGN_PACK } from '../data/campaignPack';
import { decodeCampaignLevel, encodeCampaignLevel } from '../data/levelCodec';
import { sampleLevels } from '../data/sampleLevels';
import { canonicalKey } from '../scripts/campaign/canonical';

/**
 * Levels already shipped: progress, savedStates and maxUnlockedLevel are indexed by level id,
 * so they never change. Each batch of new levels adds its line [count, sha256 of the first count codes].
 */
const SHIPPED: [number, string][] = [
  [309, 'c557ee8186583d5fe62346647c6c61a56c6c26e07f354a2f1b358d764f851ece'],
];

const OUTSIDE = 255;

describe('campaign pack', () => {
  it('never changes the levels already shipped', () => {
    for (const [count, hash] of SHIPPED) {
      expect(CAMPAIGN_PACK.length).toBeGreaterThanOrEqual(count);
      expect(createHash('sha256').update(CAMPAIGN_PACK.slice(0, count).join('\n')).digest('hex')).toBe(hash);
    }
  });

  it('numbers the levels 1..N without gaps', () => {
    expect(sampleLevels.map(l => l.id)).toEqual(CAMPAIGN_PACK.map((_, i) => i + 1));
  });

  it('decodes and encodes without loss', () => {
    CAMPAIGN_PACK.forEach((code, i) => expect(encodeCampaignLevel(decodeCampaignLevel(code, i + 1))).toBe(code));
  });

  it.each(sampleLevels.map(l => [l.id, l] as const))('level %i is a valid board', (_, level) => {
    const gs = level.gridSize;
    expect([6, 7, 8]).toContain(gs);
    const occupied = new Set<number>();
    for (const v of level.vehicles) {
      expect([2, 3]).toContain(v.length);
      for (let i = 0; i < v.length; i++) {
        const row = v.orientation === 'vertical' ? v.row + i : v.row;
        const col = v.orientation === 'horizontal' ? v.col + i : v.col;
        expect(row).toBeLessThan(gs);
        expect(col).toBeLessThan(gs);
        expect(occupied.has(row * gs + col)).toBe(false);
        occupied.add(row * gs + col);
      }
    }

    // The target comes first and drives towards the exit, on the same line
    const [target, ...others] = level.vehicles;
    expect(target.isTarget).toBe(true);
    expect(target.length).toBe(2);
    expect(others.every(v => !v.isTarget)).toBe(true);
    const sideways = level.exitCol === gs || level.exitCol === OUTSIDE;
    expect(target.orientation).toBe(sideways ? 'horizontal' : 'vertical');
    expect(sideways ? target.row : target.col).toBe(sideways ? level.exitRow : level.exitCol);
    expect(level.minMoves).toBeGreaterThanOrEqual(6);
  });

  it('has no duplicate, even up to a rotation or a mirror', () => {
    const seen = new Map<string, number>();
    for (const level of sampleLevels) {
      const key = canonicalKey(level);
      expect([level.id, seen.get(key)]).toEqual([level.id, undefined]);
      seen.set(key, level.id);
    }
  });
});
