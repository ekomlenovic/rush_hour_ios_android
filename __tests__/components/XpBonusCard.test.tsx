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
    expect(screen.getByText(/Pas encore de bonus/)).toBeTruthy();
    expect(screen.getAllByText("0 jour d'affilée · +0 % d'XP")).toHaveLength(2);
    expect(screen.getByText(/Termine les 3 missions chaque jour\. Prochain palier : \+5 % à 2 jours/)).toBeTruthy();
  });

  it('shows what each streak adds, their total and the next tiers', async () => {
    useGameStore.setState({ currentStreak: 30, missionStreak: { count: 7, lastDate: '2026-11-09' } });
    await renderCard();
    expect(screen.getByText("+90 % sur toute l'XP que tu gagnes")).toBeTruthy();
    // Missions: a week in a row, the daily streak: 30 days
    expect(screen.getByText("7 jours d'affilée · +30 % d'XP")).toBeTruthy();
    expect(screen.getByText(/Prochain palier : \+60 % à 30 jours/)).toBeTruthy();
    expect(screen.getByText("30 jours d'affilée · +60 % d'XP")).toBeTruthy();
    expect(screen.getByText(/Prochain palier : \+100 % à 60 jours/)).toBeTruthy();
  });

  it('a mission streak left for a whole day is shown as lost, the top of a bonus as reached', async () => {
    useGameStore.setState({ currentStreak: 200, missionStreak: { count: 40, lastDate: '2026-11-08' } });
    await renderCard();
    expect(screen.getByText("0 jour d'affilée · +0 % d'XP")).toBeTruthy();
    expect(screen.getByText("+100 % sur toute l'XP que tu gagnes")).toBeTruthy();
    expect(screen.getByText(/Bonus maximum atteint/)).toBeTruthy();
  });
});
