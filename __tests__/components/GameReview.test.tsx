import './setup';
import { AccessibilityInfo, Platform } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor, act } from 'expo-router/testing-library';
import * as StoreReview from 'expo-store-review';
import i18n from '@/utils/i18n';
import GameScreen from '@/app/game';
import { sampleLevels } from '@/data/sampleLevels';
import { ACHIEVEMENTS } from '@/data/achievements';
import { getMissionsForDay } from '@/data/missions';
import { totalXpForLevel } from '@/data/progression';
import { useGameStore } from '@/store/gameStore';
import { REVIEW_DELAY_MS } from '@/store/reviewPrompt';
import { addDays, getLocalDateString } from '@/utils/date';
import { describeVehicle, getVehicleLetters } from '@/utils/accessibility';
import { resetStore } from '../helpers';

/**
 * The Play Store review prompt decided by the game screen (issue 318, docs/GAME_DESIGN.md, Demande de note):
 * only on the Google Play build installed by the Play Store, on closing the win card of a map level won with
 * 3 stars that showed nothing else, for a player who has played long enough. Each test fails if its rule is
 * broken in app/game.tsx.
 */
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));
const mockInstaller = { package: 'com.android.vending' as string | null };
jest.mock('../../modules/rush-device', () => ({
  getScannerCamera: () => 'back',
  getInstallerPackage: () => mockInstaller.package,
}));

const TODAY = getLocalDateString();
const routes = { _layout: require('@/app/_layout'), game: GameScreen };

/** Level 1 solved one cell at a time, as with VoiceOver / TalkBack: [vehicle, action, cells] (6 moves, 3 stars) */
const SOLUTION: [string, 'left' | 'right' | 'up' | 'down', number][] = [
  ['v1', 'left', 1], ['v2', 'left', 1], ['v5', 'left', 1], ['v7', 'down', 1], ['v6', 'left', 2], ['target', 'up', 5],
];

async function act1(id: string, action: string) {
  const { vehicles } = useGameStore.getState();
  const vehicle = vehicles.find(v => v.id === id)!;
  await fireEvent(screen.getByLabelText(describeVehicle(i18n.t, vehicle, getVehicleLetters(vehicles)[id])), 'accessibilityAction', { nativeEvent: { actionName: action } });
}

/** Opens level 1 and wins it, after `detours` moves of a vehicle there and back */
async function winLevel1(detours = 0) {
  await renderRouter(routes, { initialUrl: '/game?levelId=1' });
  await waitFor(() => expect(screen.getByLabelText(i18n.t('a11y.target_car'))).toBeTruthy(), { timeout: 15_000 });
  for (let i = 0; i < detours; i++) {
    // Two moves (a drag each), not merged as the screen reader steps of a vehicle are
    const v1 = useGameStore.getState().vehicles.find(v => v.id === 'v1')!;
    await act(async () => {
      expect(useGameStore.getState().moveVehicle('v1', v1.row, v1.col - 1)).toBe(true);
      expect(useGameStore.getState().moveVehicle('v1', v1.row, v1.col)).toBe(true);
    });
  }
  for (const [id, action, cells] of SOLUTION) {
    for (let i = 0; i < cells; i++) await act1(id, action);
  }
  await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('game.next_level') })).toBeTruthy());
}

/** Closes the win card back to the map, on Android, past the delay of the review */
async function closeWinCard() {
  jest.replaceProperty(Platform, 'OS', 'android');
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('game.back_to_map') }));
  // renderRouter runs the screen on fake timers
  await act(async () => { jest.advanceTimersByTime(REVIEW_DELAY_MS + 100); });
  await act(async () => {});
}

/**
 * A player installed for 10 days, 6 days played, 30 levels won (not level 1): nothing left for the win of
 * level 1 to show but its stars (every achievement already unlocked, missions of the day rewarded, XP at
 * the start of a player level)
 */
function veteran(review: Partial<ReturnType<typeof useGameStore.getState>['reviewPrompt']> = {}, levelsWon = 30) {
  useGameStore.setState({
    progress: sampleLevels.slice(1, 1 + levelsWon).map(l => ({ levelId: l.id, completed: true, bestScore: 1000, stars: 3 })),
    maxUnlockedLevel: 60,
    achievements: ACHIEVEMENTS.map(a => a.id),
    seenAchievements: ACHIEVEMENTS.map(a => a.id),
    dailyMissions: { ...getMissionsForDay(null, TODAY), rewarded: true },
    xp: totalXpForLevel(30),
    lastOpenDate: TODAY,
    reviewPrompt: { firstOpenDate: addDays(TODAY, -10), playDays: 6, askCount: 0, lastAskDate: null, ...review },
  });
}

describe('review prompt on the game screen (issue 318)', () => {
  beforeEach(() => {
    resetStore();
    mockInstaller.package = 'com.android.vending';
    jest.mocked(StoreReview.requestReview).mockClear();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks Google once the 3-star win card of a map level is closed, and counts it', async () => {
    veteran();
    await winLevel1();
    // Never while the win card is open
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    await closeWinCard();
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().reviewPrompt).toMatchObject({ askCount: 1, lastAskDate: TODAY });
  }, 30_000);

  it('never on an APK installed by hand (GitHub release, test build)', async () => {
    veteran();
    mockInstaller.package = null;
    await winLevel1();
    await closeWinCard();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(useGameStore.getState().reviewPrompt.askCount).toBe(0);
  }, 30_000);

  it('never after a win with less than 3 stars', async () => {
    veteran();
    await winLevel1(2);
    expect(useGameStore.getState().moveCount).toBe(10);
    expect(useGameStore.getState().progress.find(p => p.levelId === 1)?.stars).toBeLessThan(3);
    await closeWinCard();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  }, 30_000);

  it('never after a win card that showed an achievement', async () => {
    // 49 levels won: the 50th unlocks "expert" on the win card
    veteran({}, 49);
    useGameStore.setState({
      achievements: ACHIEVEMENTS.map(a => a.id).filter(id => id !== 'expert'),
      // 143 stars, 146 with the win: no garage style unlocked with it (150)
      progress: useGameStore.getState().progress.map((p, i) => (i < 4 ? { ...p, stars: 2 } : p)),
    });
    await winLevel1();
    expect(useGameStore.getState().achievements).toContain('expert');
    await closeWinCard();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  }, 30_000);

  it('never for a player installed for less than a week', async () => {
    veteran({ firstOpenDate: addDays(TODAY, -3) });
    await winLevel1();
    await closeWinCard();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  }, 30_000);

  it('not a second time before 120 days', async () => {
    veteran({ askCount: 1, lastAskDate: addDays(TODAY, -60) });
    await winLevel1();
    await closeWinCard();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  }, 30_000);

  it('never a third time', async () => {
    veteran({ askCount: 2, lastAskDate: addDays(TODAY, -400) });
    await winLevel1();
    await closeWinCard();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  }, 30_000);

  it('a second time 120 days after the first', async () => {
    veteran({ askCount: 1, lastAskDate: addDays(TODAY, -120) });
    await winLevel1();
    await closeWinCard();
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().reviewPrompt.askCount).toBe(2);
  }, 30_000);
});
