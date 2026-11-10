import './setup';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '@/utils/i18n';
import StreakSheet from '@/components/home/StreakSheet';
import { getUiColors } from '@/theme';

describe('streak sheet of the home screen', () => {
  const onSeeBonuses = jest.fn();
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const renderSheet = (streak: number) => render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StreakSheet visible colors={getUiColors('light')} isDark={false} streak={streak} onSeeBonuses={onSeeBonuses} onClose={jest.fn()} />
    </SafeAreaProvider>,
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('fr');
  });

  it('without a streak: how to start it, and the first tier of its bonus', async () => {
    await renderSheet(0);
    expect(screen.getByText("Réussis le défi du jour aujourd'hui pour lancer ton streak.")).toBeTruthy();
    expect(screen.getByText('Pas encore de bonus de streak')).toBeTruthy();
    expect(screen.getByText(/Prochain palier : \+5 % à 2 jours/)).toBeTruthy();
  });

  it('with a streak: the XP bonus it gives, its next tier and a link to all the bonuses', async () => {
    await renderSheet(34);
    expect(screen.getByText("Streak : 34 jours · +60 % d'XP")).toBeTruthy();
    expect(screen.getByText(/augmente toute l'XP que tu gagnes.*Prochain palier : \+100 % à 60 jours/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Voir tous mes bonus d'XP"));
    expect(onSeeBonuses).toHaveBeenCalledTimes(1);
  });

  it('at the top of the bonus', async () => {
    await renderSheet(75);
    expect(screen.getByText("Streak : 75 jours · +100 % d'XP")).toBeTruthy();
    expect(screen.getByText(/Bonus maximum atteint/)).toBeTruthy();
  });
});
