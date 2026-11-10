import './setup';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import i18n from '@/utils/i18n';
import XpBonusCard from '@/components/profile/XpBonusCard';
import { getUiColors } from '@/theme';
import { useGameStore } from '@/store/gameStore';
import { resetStore, setToday } from '../helpers';

const renderCard = () => render(<XpBonusCard colors={getUiColors('light')} />);

describe('XP bonuses of the profile', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    resetStore();
    setToday('2026-11-10');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a new player has no bonus yet and sees the first tier to reach', async () => {
    await renderCard();
    expect(screen.getByText("Bonus d'XP")).toBeTruthy();
    expect(screen.getAllByText('×1')).toHaveLength(2);
    expect(screen.getAllByText('Prochain palier : ×1 à 1 jour')).toHaveLength(2);
  });

  it('shows the multiplier of each streak and its next tier', async () => {
    useGameStore.setState({ currentStreak: 30, missionStreak: { count: 7, lastDate: '2026-11-09' } });
    await renderCard();
    // Missions: a week in a row, the daily streak: 30 days
    expect(screen.getByText("7 jours d'affilée · XP des 3 missions")).toBeTruthy();
    expect(screen.getAllByText('×2,5')).toHaveLength(2);
    expect(screen.getByText('Prochain palier : ×4 à 30 jours')).toBeTruthy();
    expect(screen.getByText("30 jours d'affilée · XP du défi du jour")).toBeTruthy();
    expect(screen.getByText('Prochain palier : ×3 à 60 jours')).toBeTruthy();
  });

  it('a mission streak left for a whole day is shown as lost, the top of a bonus as reached', async () => {
    useGameStore.setState({ currentStreak: 200, missionStreak: { count: 40, lastDate: '2026-11-08' } });
    await renderCard();
    expect(screen.getByText("0 jour d'affilée · XP des 3 missions")).toBeTruthy();
    expect(screen.getByText('Bonus maximum atteint')).toBeTruthy();
  });
});
