import {
  EMBLEM_BOLTS, EMBLEM_BOX, EMBLEM_STEPS, EMBLEM_TIERS, emblemLabel, emblemTiersMatchTitles, getEmblemStep, getEmblemTier,
} from '../theme/art/levelEmblem';
import { forgetSaidLevels, sayLevel, shownLevel } from '../utils/multi/level';

describe('emblem of a player level', () => {
  it('has one sign per title, at the level of the title', () => {
    expect(emblemTiersMatchTitles()).toBe(true);
    expect([1, 4, 5, 9, 10, 19, 20, 29, 30, 39, 40, 250].map(l => getEmblemTier(l).id)).toEqual([
      'apprentice', 'apprentice', 'driver', 'driver', 'pilot', 'navigator', 'road_expert', 'road_expert',
      'traffic_master', 'traffic_master', 'legend', 'legend',
    ]);
  });

  it('gains a bolt per level in the short tiers, one every 2 levels in the long ones, one every 5 at the end', () => {
    expect([1, 2, 3, 4].map(getEmblemStep)).toEqual([0, 1, 2, 3]);
    expect([5, 6, 7, 8, 9].map(getEmblemStep)).toEqual([0, 1, 2, 3, 4]);
    expect([10, 14, 15, 19].map(getEmblemStep)).toEqual([0, 4, 0, 4]);
    expect([20, 21, 22, 25, 28, 29].map(getEmblemStep)).toEqual([0, 0, 1, 2, 4, 4]);
    expect([30, 38, 39].map(getEmblemStep)).toEqual([0, 4, 4]);
    expect([40, 44, 45, 59, 60, 500].map(getEmblemStep)).toEqual([0, 0, 1, 3, 4, 4]);
  });

  it('never goes back: a level up keeps or changes the sign, the bolts only grow inside a sign', () => {
    for (let level = 1; level < 80; level++) {
      const [tier, next] = [getEmblemTier(level), getEmblemTier(level + 1)];
      if (tier === next) expect(getEmblemStep(level + 1)).toBeGreaterThanOrEqual(getEmblemStep(level));
      else expect(getEmblemStep(level + 1)).toBe(0);
    }
  });

  it('draws every bolt of every step inside the box', () => {
    expect(EMBLEM_BOLTS).toHaveLength(EMBLEM_STEPS + 1);
    EMBLEM_BOLTS.forEach((bolts, step) => expect(bolts).toHaveLength(step));
    for (const tier of EMBLEM_TIERS) {
      expect(tier.bolts).toHaveLength(EMBLEM_STEPS);
      for (const [x, y] of tier.bolts) {
        expect(x).toBeGreaterThan(3); expect(x).toBeLessThan(EMBLEM_BOX - 3);
        expect(y).toBeGreaterThan(3); expect(y).toBeLessThan(EMBLEM_BOX - 3);
      }
    }
  });

  it('draws a level that is not one as the nearest real one', () => {
    expect([0, -4, NaN, 12.9, 4000].map(emblemLabel)).toEqual(['1', '1', '1', '12', '999']);
    expect(getEmblemTier(NaN).id).toBe('apprentice');
  });
});

describe('level of the players of a server', () => {
  beforeEach(forgetSaidLevels);

  it('shows mine from this phone, the others from the server, none on an older server', () => {
    expect(shownLevel(12, false, 30)).toBe(12);
    expect(shownLevel(12, true, 30)).toBe(30);
    // The server keeps the levels but does not have mine yet
    expect(shownLevel(null, true, 30)).toBe(30);
    expect(shownLevel(null, false, 30)).toBeNull();
    // A server older than the levels: nobody has an emblem, me included
    expect(shownLevel(undefined, true, 30)).toBeNull();
    expect(shownLevel(undefined, false, 30)).toBeNull();
  });

  it('is said once per server and per level, only to a server that keeps the levels', async () => {
    const setLevel = jest.fn(async (level: number) => ({ level }));
    await sayLevel({ setLevel }, 'https://old.example', ['duel'], 12);
    await sayLevel({ setLevel }, 'https://old.example', undefined, 12);
    expect(setLevel).not.toHaveBeenCalled();
    await sayLevel({ setLevel }, 'https://a.example', ['duel', 'player_level'], 12);
    await sayLevel({ setLevel }, 'https://a.example', ['duel', 'player_level'], 12);
    await sayLevel({ setLevel }, 'https://b.example', ['player_level'], 12);
    await sayLevel({ setLevel }, 'https://a.example', ['duel', 'player_level'], 13);
    expect(setLevel.mock.calls).toEqual([[12], [12], [13]]);
  });

  it('is said again after a failure, which never breaks the screen', async () => {
    const setLevel = jest.fn<Promise<{ level: number }>, [number]>().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ level: 12 });
    await expect(sayLevel({ setLevel }, 'https://a.example', ['player_level'], 12)).resolves.toBeUndefined();
    await sayLevel({ setLevel }, 'https://a.example', ['player_level'], 12);
    await sayLevel({ setLevel }, 'https://a.example', ['player_level'], 12);
    expect(setLevel).toHaveBeenCalledTimes(2);
  });
});
