import './setup';
import { AccessibilityInfo } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor, act } from 'expo-router/testing-library';
import i18n from '@/utils/i18n';
import GameScreen from '@/app/game';
import { sampleLevels } from '@/data/sampleLevels';
import { useGameStore } from '@/store/gameStore';
import { getStars } from '@/utils/scoring';
import { describeVehicle, getVehicleLetters } from '@/utils/accessibility';
import { resetStore } from '../helpers';

/** Level 1 solved one cell at a time, as with VoiceOver / TalkBack: [vehicle, action, cells] */
const SOLUTION: [string, 'left' | 'right' | 'up' | 'down', number][] = [
  ['v1', 'left', 1], ['v2', 'left', 1], ['v5', 'left', 1], ['v7', 'down', 1], ['v6', 'left', 2], ['target', 'up', 5],
];

describe('game screen', () => {
  beforeEach(() => {
    resetStore();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  it('a won map level: the win card opens and the progress is saved', async () => {
    // The steps of a vehicle make one move (issue 158): the optimal solution, 3 stars
    const level = sampleLevels[0];
    // Under the real root layout, as in the app (gesture root, audio, toasts)
    await renderRouter({ _layout: require('@/app/_layout'), game: GameScreen }, { initialUrl: '/game?levelId=1' });
    await waitFor(() => expect(screen.getByLabelText(i18n.t('a11y.target_car'))).toBeTruthy());

    expect(screen.queryByRole('header', { name: i18n.t('game.perfect') })).toBeNull();
    // Each vehicle is found by what the screen reader says of it, and moved with its accessibility actions
    const letters = getVehicleLetters(level.vehicles);
    for (const [id, action, cells] of SOLUTION) {
      for (let i = 0; i < cells; i++) {
        const before = useGameStore.getState().vehicles.find(v => v.id === id)!;
        await fireEvent(screen.getByLabelText(describeVehicle(i18n.t, before, letters[id])), 'accessibilityAction', { nativeEvent: { actionName: action } });
        expect(useGameStore.getState().vehicles.find(v => v.id === id)).not.toEqual(before);
      }
    }

    const { moveCount } = useGameStore.getState();
    expect(moveCount).toBe(level.minMoves);
    const stars = getStars(moveCount, level.minMoves);
    expect(stars).toBe(3);
    await waitFor(() => expect(screen.getByRole('header', { name: i18n.t('game.perfect') })).toBeTruthy());
    expect(screen.getByText(i18n.t('game.win_moves_optimal', { count: moveCount }))).toBeTruthy();
    expect(screen.getByLabelText(i18n.t('a11y.level_stars', { count: stars }))).toBeTruthy();
    // In the minimum: nothing to replay for, and level 2 comes next
    expect(screen.queryByRole('button', { name: i18n.t('solution.retry') })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('game.next_level') })).toBeTruthy();

    const progress = useGameStore.getState().progress.find(p => p.levelId === level.id);
    expect(progress).toMatchObject({ completed: true, stars });
    expect(useGameStore.getState().xp).toBeGreaterThan(0);
  }, 20_000);
  it('a generation going on keeps running while a level is played, its bubble on screen until Cancel', async () => {
    // A generation really going on (not a state left over by a closed app)
    const active = jest.spyOn(require('@/hooks/useLevelGenerator'), 'isGenerationActive').mockReturnValue(true);
    try {
      useGameStore.getState().setGenerationState({ isRunning: true, current: 3, total: 10, shouldCancel: false });
      await renderRouter({ _layout: require('@/app/_layout'), game: GameScreen }, { initialUrl: '/game?levelId=1' });
      await waitFor(() => expect(screen.getByLabelText(i18n.t('a11y.target_car'))).toBeTruthy());
      expect(useGameStore.getState().generationState).toMatchObject({ isRunning: true, shouldCancel: false });

      // The bubble over the game: its progress, the details on a touch, and Cancel
      const label = `${i18n.t('map.generating_levels')}, ${i18n.t('map.generation_progress', { current: 3, total: 10 })}`;
      expect(screen.getByText('3/10')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(screen.getByText(i18n.t('common.cancel'))).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: label }));

      // Minimized on an edge: a tab with the progress, its arrow brings the bubble back
      await fireEvent(screen.getByRole('button', { name: label }), 'accessibilityAction', { nativeEvent: { actionName: 'dock' } });
      expect(screen.getByText('30 %')).toBeTruthy();
      expect(screen.queryByText('3/10')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(screen.getByText('3/10')).toBeTruthy();

      // Cancel: the bubble goes at once, the generation stops after the call going on
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('a11y.cancel_generation') }));
      expect(useGameStore.getState().generationState.shouldCancel).toBe(true);
      expect(screen.queryByText('3/10')).toBeNull();
      expect(screen.queryByRole('button', { name: i18n.t('a11y.cancel_generation') })).toBeNull();
      // The generation stops: nothing comes back, no end shown (a second touch on ✕ was needed)
      active.mockReturnValue(false);
      await act(async () => { useGameStore.getState().setGenerationState({ isRunning: false, shouldCancel: false }); });
      expect(screen.queryByText('3/10')).toBeNull();
      expect(screen.queryByText(i18n.t('map.generation_progress', { current: 3, total: 10 }))).toBeNull();
    } finally {
      active.mockRestore();
    }
  }, 20_000);

  it('a generation that ends shows its levels ready, then goes', async () => {
    const active = jest.spyOn(require('@/hooks/useLevelGenerator'), 'isGenerationActive').mockReturnValue(true);
    try {
      useGameStore.getState().setGenerationState({ isRunning: true, current: 9, total: 10, shouldCancel: false });
      await renderRouter({ _layout: require('@/app/_layout'), game: GameScreen }, { initialUrl: '/game?levelId=1' });
      await waitFor(() => expect(screen.getByText('9/10')).toBeTruthy());
      active.mockReturnValue(false);
      await act(async () => { useGameStore.getState().setGenerationState({ isRunning: false, current: 10 }); });
      expect(screen.getByText(i18n.t('map.generation_progress', { current: 10, total: 10 }))).toBeTruthy();
      await waitFor(() => expect(screen.queryByText(i18n.t('map.generation_progress', { current: 10, total: 10 }))).toBeNull(), { timeout: 5000 });
    } finally {
      active.mockRestore();
    }
  }, 20_000);

  it('the app closed, the generation going on stops', async () => {
    const active = jest.spyOn(require('@/hooks/useLevelGenerator'), 'isGenerationActive').mockReturnValue(true);
    try {
      useGameStore.getState().setGenerationState({ isRunning: true, current: 3, total: 10, shouldCancel: false });
      const app = await renderRouter({ _layout: require('@/app/_layout'), game: GameScreen }, { initialUrl: '/game?levelId=1' });
      await waitFor(() => expect(screen.getByText('3/10')).toBeTruthy());
      await act(async () => { app.unmount(); });
      expect(useGameStore.getState().generationState.shouldCancel).toBe(true);
    } finally {
      active.mockRestore();
    }
  }, 20_000);

  it('a generation left over by a closed app shows no bubble', async () => {
    useGameStore.getState().setGenerationState({ isRunning: true, current: 3, total: 10, shouldCancel: false });
    await renderRouter({ _layout: require('@/app/_layout'), game: GameScreen }, { initialUrl: '/game?levelId=1' });
    await waitFor(() => expect(screen.getByLabelText(i18n.t('a11y.target_car'))).toBeTruthy());
    expect(useGameStore.getState().generationState.isRunning).toBe(false);
    expect(screen.queryByText('3/10')).toBeNull();
  }, 20_000);
});
