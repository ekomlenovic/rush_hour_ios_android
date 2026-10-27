import './setup';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import i18n from '@/utils/i18n';
import WinModal from '@/components/game/WinModal';
import { getUiColors } from '@/theme';
import { totalXpForLevel } from '@/data/progression';
import { useGameStore } from '@/store/gameStore';
import { resetStore } from '../helpers';

type Props = React.ComponentProps<typeof WinModal>;

/** The win card of a map level played in the minimum, as the game screen opens it */
function renderWin(props: Partial<Props> = {}) {
  const handlers = {
    onOpenGarage: jest.fn(),
    onShareResult: jest.fn(),
    onShowSolution: jest.fn(),
    onContinue: jest.fn(),
    onRequestClose: jest.fn(),
  };
  const all: Props = {
    visible: true,
    colors: getUiColors('light'),
    stars: 3,
    moveCount: 8,
    minMoves: 8,
    score: 300,
    timeMs: 42_000,
    unlocks: [],
    cosmeticUnlocks: [],
    missionReward: null,
    xpGain: null,
    levelUps: [],
    effect: 'confetti',
    effectColors: ['#ff0000'],
    canShareResult: false,
    ...handlers,
    ...props,
  };
  return render(<WinModal {...all} />).then(() => ({ ...handlers, ...props }));
}

const button = (key: string) => screen.getByRole('button', { name: i18n.t(key) });

describe('WinModal', () => {
  beforeEach(() => {
    resetStore();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  it('a perfect game: title, three stars, moves, time, and the win announced to screen readers', async () => {
    await renderWin();
    expect(screen.getByRole('header', { name: i18n.t('game.perfect') })).toBeTruthy();
    expect(screen.getByLabelText(i18n.t('a11y.level_stars', { count: 3 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('game.win_moves_optimal', { count: 8 }))).toBeTruthy();
    expect(screen.getByText('0:42')).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(i18n.t('a11y.win', {
      title: i18n.t('game.perfect'),
      stars: 3,
      stats: i18n.t('game.win_moves_optimal', { count: 8 }),
    }));
    // Nothing to do better: no retry
    expect(screen.queryByRole('button', { name: i18n.t('solution.retry') })).toBeNull();
  });

  it('not in the minimum: says the best, and Retry replays the level', async () => {
    const { onRetry } = await renderWin({ stars: 2, moveCount: 11, onRetry: jest.fn() });
    expect(screen.getByRole('header', { name: i18n.t('game.level_complete') })).toBeTruthy();
    expect(screen.getByText(i18n.t('game.win_moves', { count: 11, best: 8 }))).toBeTruthy();

    await fireEvent.press(button('solution.retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('a map level with a next one: Back to the map and Next level', async () => {
    const { onNextLevel, onContinue } = await renderWin({ onNextLevel: jest.fn() });
    expect(screen.queryByRole('button', { name: i18n.t('common.continue') })).toBeNull();

    await fireEvent.press(button('game.next_level'));
    expect(onNextLevel).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('game.back_to_map'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('a challenge: the result can be shared, Continue closes', async () => {
    const { onShareResult, onContinue, onShowSolution } = await renderWin({ canShareResult: true });
    await fireEvent.press(button('share.share_result'));
    expect(onShareResult).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('solution.show'));
    expect(onShowSolution).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('common.continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('the XP gained and a player level reached are shown and announced', async () => {
    const from = totalXpForLevel(9) + 10;
    const to = totalXpForLevel(10) + 5;
    await renderWin({ xpGain: { from, to }, levelUps: [10] });
    expect(screen.getByText(i18n.t('progression.xp_gain', { xp: to - from }))).toBeTruthy();
    expect(screen.getByText(i18n.t('progression.level_up', { level: 10 }))).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(i18n.t('progression.level_up', { level: 10 }));
  });

  it('a cosmetic unlocked by the win is equipped from the card', async () => {
    useGameStore.setState({ xp: totalXpForLevel(10) });
    const { onOpenGarage } = await renderWin({ cosmeticUnlocks: ['board:neon'] });
    const name = i18n.t('cosmetics.board.neon');
    expect(screen.getByText(name)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: `${i18n.t('cosmetics.equip')} : ${name}` }));
    expect(useGameStore.getState().cosmetics.board).toBe('neon');
    expect(useGameStore.getState().seenCosmetics).toContain('board:neon');
    expect(screen.getByText(`✓ ${i18n.t('cosmetics.equipped')}`)).toBeTruthy();

    await fireEvent.press(screen.getByRole('link', { name: `${i18n.t('cosmetics.open_garage')} →` }));
    expect(onOpenGarage).toHaveBeenCalledTimes(1);
  });
});
