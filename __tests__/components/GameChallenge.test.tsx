import './setup';
import { AccessibilityInfo } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import i18n from '@/utils/i18n';
import { addDays, getLocalDateString } from '@/utils/date';
import GameScreen from '@/app/game';
import { useGameStore } from '@/store/gameStore';
import { solvePuzzle } from '@/utils/solver';
import { describeVehicle, getVehicleLetters } from '@/utils/accessibility';
import type { Move } from '@/utils/solver';
import { resetStore } from '../helpers';

/**
 * The daily challenge rules decided by the game screen (issue 201): one try, no hint nor undo nor reset,
 * the board locked once won, a past day opened as its archive, the win recorded as the daily's, and the
 * day kept "open" for the streak while it is played. Each test fails if its rule is broken in app/game.tsx.
 */
// The real day: the screen reads the clock in many places (fake timers would stall its animations)
const TODAY = getLocalDateString();
const YESTERDAY = addDays(TODAY, -1);
const routes = { _layout: require('@/app/_layout'), game: GameScreen };
const board = () => screen.getByLabelText(i18n.t('a11y.target_car'));

/** Plays a solution move one cell at a time, with the vehicle's screen reader actions */
async function playMove(move: Move) {
  const { vehicles } = useGameStore.getState();
  const vehicle = vehicles.find(v => v.id === move.vehicleId)!;
  const label = describeVehicle(i18n.t, vehicle, getVehicleLetters(vehicles)[vehicle.id]);
  const delta = vehicle.orientation === 'horizontal' ? move.toCol - vehicle.col : move.toRow - vehicle.row;
  const action = vehicle.orientation === 'horizontal' ? (delta > 0 ? 'right' : 'left') : (delta > 0 ? 'down' : 'up');
  for (let i = 0; i < Math.abs(delta); i++) {
    await fireEvent(screen.getByLabelText(label), 'accessibilityAction', { nativeEvent: { actionName: action } });
  }
}

describe('daily challenge on the game screen (issue 201)', () => {
  beforeEach(() => {
    resetStore();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('has no hint, undo nor reset, and keeps its day open for the streak while played', async () => {
    await renderRouter(routes, { initialUrl: `/game?levelId=daily&date=${TODAY}` });
    await waitFor(() => expect(board()).toBeTruthy(), { timeout: 15_000 });
    for (const label of ['game.undo', 'game.hint', 'common.reset']) {
      expect(screen.queryByRole('button', { name: i18n.t(label) })).toBeNull();
    }
    expect(screen.getByText(i18n.t('game.daily_rules'))).toBeTruthy();
    expect(useGameStore.getState().openDailyDate).toBe(TODAY);
  }, 20_000);

  it('a won daily is recorded as the daily, not as a map level, and its day is no longer open', async () => {
    await renderRouter(routes, { initialUrl: `/game?levelId=daily&date=${TODAY}` });
    await waitFor(() => expect(board()).toBeTruthy(), { timeout: 15_000 });
    const level = useGameStore.getState().currentLevel!;
    const { moves } = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
    for (const move of moves) await playMove(move);

    await waitFor(() => expect(useGameStore.getState().dailyChallengeProgress[TODAY]?.completed).toBe(true));
    expect(useGameStore.getState().progress.some(p => p.levelId === level.id)).toBe(false);
    expect(useGameStore.getState().openDailyDate).toBeNull();
  }, 30_000);

  it('a daily already won is shown locked: the board refuses moves', async () => {
    useGameStore.getState().completeDailyChallenge(TODAY, 1000, 3);
    await renderRouter(routes, { initialUrl: `/game?levelId=daily&date=${TODAY}` });
    await waitFor(() => expect(board()).toBeTruthy(), { timeout: 15_000 });
    const level = useGameStore.getState().currentLevel!;
    const [first] = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol).moves;
    await playMove(first);
    expect(useGameStore.getState().moveCount).toBe(0);
    expect(useGameStore.getState().openDailyDate).toBeNull();
    expect(screen.queryByText(i18n.t('game.daily_rules'))).toBeNull();
  }, 20_000);

  it('a past day opens as its archive, never as the daily', async () => {
    await renderRouter(routes, { initialUrl: `/game?levelId=daily&date=${YESTERDAY}` });
    await waitFor(() => expect(screen).toHavePathnameWithParams(`/game?levelId=archive&date=${YESTERDAY}`), { timeout: 15_000 });
    expect(useGameStore.getState().openDailyDate).toBeNull();
  }, 20_000);
});
