import './setup';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '@/utils/i18n';
import FreezeSheet from '@/components/home/FreezeSheet';
import { getUiColors } from '@/theme';

describe('freeze sheet of the home screen', () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const renderSheet = (freezes: number, capacity: number, playerLevel: number) => render(
    <SafeAreaProvider initialMetrics={metrics}>
      <FreezeSheet visible colors={getUiColors('light')} isDark={false} freezes={freezes} capacity={capacity} playerLevel={playerLevel} onClose={jest.fn()} />
    </SafeAreaProvider>,
  );

  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  it('explains the freezes, shows the stock and the player level of the next slot', async () => {
    await renderSheet(1, 3, 7);
    expect(screen.getByText(/Un gel protège ton streak.*Tu en as 1 sur 3\./)).toBeTruthy();
    expect(screen.getByText('Gels : 1 sur 3 emplacements')).toBeTruthy();
    expect(screen.getByText(/Un gel garde aussi le bonus d'XP de ton streak\. \+1 emplacement de gel au niveau joueur 10\./)).toBeTruthy();
  });

  it('tells no next slot once they are all unlocked', async () => {
    await renderSheet(6, 6, 32);
    expect(screen.getByText('Gels : 6 sur 6 emplacements')).toBeTruthy();
    expect(screen.queryByText(/emplacement de gel au niveau/)).toBeNull();
  });
});
