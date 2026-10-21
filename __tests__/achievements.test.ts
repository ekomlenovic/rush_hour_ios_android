import { ACHIEVEMENTS, buildAchievementContext } from '../data/achievements';
import { useGameStore } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { resetStore, setToday, winDaily, winMapLevel } from './helpers';
import { matchSecretCode } from '../store/stats';

const state = () => useGameStore.getState();

describe('achievement definitions', () => {
  it('have unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it.each([['en', en], ['fr', fr]] as const)('are translated in %s', (_, locale) => {
    const strings = (locale as Record<string, any>).achievements;
    for (const a of ACHIEVEMENTS) {
      expect(strings[a.id]).toEqual(expect.any(String));
      expect(strings[`${a.id}_desc`]).toEqual(expect.any(String));
    }
  });

  it('none is unlocked on a fresh install', () => {
    const context = buildAchievementContext(useGameStore.getInitialState());
    expect(ACHIEVEMENTS.filter(a => a.value(context) >= a.target).map(a => a.id)).toEqual([]);
  });
});

describe('achievements in the store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
    setToday('2026-10-14');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('are unlocked once, and queued for the toast', () => {
    winMapLevel();
    expect(state().achievements).toContain('first_win');
    expect(state().consumeUnlockQueue()).toContain('first_win');
    expect(state().consumeUnlockQueue()).toEqual([]);

    winMapLevel(sampleLevels[1]);
    state().checkAchievements();
    expect(state().achievements.filter(id => id === 'first_win')).toHaveLength(1);
    expect(state().unlockQueue).not.toContain('first_win');
  });

  it('are unlocked silently after an update (no toast flood)', () => {
    useGameStore.setState({ progress: [{ levelId: 1, completed: true, bestScore: 300, stars: 3 }] });
    state().checkAchievements({ silent: true });
    expect(state().achievements).toContain('first_win');
    expect(state().unlockQueue).toEqual([]);
  });

  it('"without help" achievements count distinct levels: replaying cannot farm them', () => {
    for (let i = 0; i < 30; i++) winMapLevel(sampleLevels[0]);
    const context = buildAchievementContext(state());
    expect(context.noHintLevels).toBe(1);
    expect(context.noHelpLevels).toBe(1);
    expect(state().achievements).not.toContain('no_hint_25');
  });

  it('a hint or an undo during the winning attempt breaks "clean run"', () => {
    winMapLevel(sampleLevels[0], { hints: 1 });
    winMapLevel(sampleLevels[1], { undos: 1 });
    expect(state().achievements).not.toContain('clean_run');
    winMapLevel(sampleLevels[2]);
    expect(state().achievements).toContain('clean_run');
  });

  it('a perfect zone needs every level of a full zone with 3 stars (#40)', () => {
    const win = (id: number, stars = 3) => ({ levelId: id, completed: true, bestScore: 300, stars });
    const zone1 = Array.from({ length: 20 }, (_, i) => win(i + 1));
    const context = (progress: ReturnType<typeof win>[]) =>
      buildAchievementContext({ ...useGameStore.getInitialState(), progress });

    expect(context(zone1).perfectZones).toBe(1);
    expect(context([...zone1.slice(0, 19), win(20, 2)]).perfectZones).toBe(0);
    // Levels 21-40 won with 3 stars but one missing: the zone does not count
    expect(context([...zone1, ...Array.from({ length: 19 }, (_, i) => win(i + 21))]).perfectZones).toBe(1);
    // The last zone of the campaign, still growing, does not count yet
    const lastFull = Math.floor(sampleLevels.length / 20) * 20;
    const tail = Array.from({ length: sampleLevels.length - lastFull }, (_, i) => win(lastFull + i + 1));
    expect(context(tail).perfectZones).toBe(0);
  });

  it('streak achievements are reachable', () => {
    winDaily('2026-10-12');
    winDaily('2026-10-13');
    winDaily('2026-10-14');
    expect(state().achievements).toEqual(expect.arrayContaining(['daily_winner', 'streak_3', 'monday_survivor']));
  });

  it('the weekly challenge unlocks "weekly warrior"', () => {
    state().completeWeeklyChallenge('2026-W42', 300, 3);
    expect(state().achievements).toEqual(expect.arrayContaining(['weekly_warrior', 'weekly_perfect']));
  });

  it('minimum-moves achievements follow the hardest level won, and won with 3 stars', () => {
    const hard = sampleLevels.find(l => l.minMoves >= 30 && l.minMoves < 40)!;
    winMapLevel(hard, { stars: 2 });
    expect(state().achievements).toEqual(expect.arrayContaining(['min_moves_20', 'min_moves_30']));
    expect(state().achievements).not.toContain('optimal_20');
    expect(state().achievements).not.toContain('min_moves_50');

    winMapLevel(hard);
    expect(state().achievements).toEqual(expect.arrayContaining(['optimal_20', 'optimal_30']));
    expect(state().achievements).not.toContain('optimal_50');
  });

  it('"optimal hard" counts distinct map levels of 30+ minimum moves won with 3 stars', () => {
    const hardLevels = sampleLevels.filter(l => l.minMoves >= 30);
    for (let i = 0; i < 9; i++) winMapLevel(hardLevels[i]);
    winMapLevel(hardLevels[0]);
    winMapLevel(sampleLevels.find(l => l.minMoves < 30)!);
    expect(state().achievements).not.toContain('optimal_hard_10');
    winMapLevel(hardLevels[9]);
    expect(state().achievements).toContain('optimal_hard_10');
  });

  it('secret: a win on Halloween', () => {
    setToday('2026-10-31');
    winMapLevel();
    expect(state().achievements).toContain('halloween');
  });

  it('secret: "mafia" typed in the level import unlocks the Mafia skin, palette and win effect', () => {
    expect(matchSecretCode('  MaFiA ')).toBe('mafia');
    expect(matchSecretCode('mafia2')).toBeNull();
    state().recordSecretCode('omerta');
    expect(state().achievements).not.toContain('mafia');
    expect(state().selectCosmetic('skin', 'mafia')).toBe(false);

    state().recordSecretCode('mafia');
    expect(state().achievements).toContain('mafia');
    expect(state().stats.secretCodes).toEqual({ mafia: 1 });
    expect(state().selectCosmetic('skin', 'mafia')).toBe(true);
    expect(state().selectCosmetic('palette', 'mafia')).toBe(true);
    expect(state().selectCosmetic('effect', 'tommy')).toBe(true);
  });
});
