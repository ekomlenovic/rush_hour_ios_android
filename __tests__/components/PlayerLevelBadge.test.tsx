import './setup';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import i18n from '@/utils/i18n';
import PlayerLevelBadge from '@/components/progression/PlayerLevelBadge';
import { getUiColors } from '@/theme';
import { useGameStore } from '@/store/gameStore';
import { resetStore, setToday } from '../helpers';

describe('player level badge of the home screen', () => {
  const onPress = jest.fn();
  const onBonusPress = jest.fn();
  const renderBadge = () => render(<PlayerLevelBadge colors={getUiColors('light')} onPress={onPress} onBonusPress={onBonusPress} />);

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetStore();
    setToday('2026-11-10');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows no XP bonus when there is none', async () => {
    await renderBadge();
    expect(screen.queryByLabelText(/Bonus d'XP/)).toBeNull();
    await fireEvent.press(screen.getByLabelText(/Niveau 1/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows both XP bonuses added up, with its own target to the bonus card of the profile', async () => {
    useGameStore.setState({ currentStreak: 30, missionStreak: { count: 7, lastDate: '2026-11-09' } });
    await renderBadge();
    expect(screen.getByText('+90 %')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Bonus d'XP de +90 %, voir le détail"));
    expect(onBonusPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
