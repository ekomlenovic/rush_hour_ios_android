import './setup';
import { AccessibilityInfo } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
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
    const level = sampleLevels[0];
    // Under the real root layout, as in the app (gesture root, audio, toasts)
    await renderRouter({ _layout: require('@/app/_layout'), game: GameScreen }, { initialUrl: '/game?levelId=1' });
    await waitFor(() => expect(screen.getByLabelText(i18n.t('a11y.target_car'))).toBeTruthy());

    expect(screen.queryByRole('header', { name: i18n.t('game.level_complete') })).toBeNull();
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
    const stars = getStars(moveCount, level.minMoves);
    await waitFor(() => expect(screen.getByRole('header', { name: i18n.t('game.level_complete') })).toBeTruthy());
    expect(screen.getByText(i18n.t('game.win_moves', { count: moveCount, best: level.minMoves }))).toBeTruthy();
    expect(screen.getByLabelText(i18n.t('a11y.level_stars', { count: stars }))).toBeTruthy();
    // Not in the minimum: the level can be replayed for 3 stars, and level 2 comes next
    expect(screen.getByRole('button', { name: i18n.t('solution.retry') })).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('game.next_level') })).toBeTruthy();

    const progress = useGameStore.getState().progress.find(p => p.levelId === level.id);
    expect(progress).toMatchObject({ completed: true, stars });
    expect(useGameStore.getState().xp).toBeGreaterThan(0);
  }, 20_000);
});
