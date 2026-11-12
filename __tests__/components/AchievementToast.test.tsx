import './setup';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '@/utils/i18n';
import AchievementToast from '@/components/AchievementToast';
import { useGameStore } from '@/store/gameStore';
import { getLocalDateString } from '@/utils/date';
import { resetStore } from '../helpers';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe('AchievementToast: a mission completed outside a win', () => {
  beforeEach(() => {
    resetStore();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  it('says which mission and how many of the day are done, and announces it to screen readers', async () => {
    await render(<SafeAreaProvider initialMetrics={metrics}><AchievementToast /></SafeAreaProvider>);
    expect(screen.queryByRole('button')).toBeNull();

    // « Play 100 moves » reached while playing, the second mission of the day
    await act(async () => {
      useGameStore.setState({
        dailyMissions: {
          date: getLocalDateString(new Date()), ids: ['win_3', 'perfect_2', 'moves_100'], counters: { levelWins: 3, moves: 100 }, rewarded: false,
        },
        missionDoneQueue: ['moves_100'],
      });
    });
    const label = i18n.t('missions.done_progress', { done: 2, total: 3 });
    const name = i18n.t('missions.list.moves_100');
    expect(screen.getByRole('button', { name: `${label} ${name}` })).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(`${label} ${name}`);
    // Shown once
    expect(useGameStore.getState().missionDoneQueue).toEqual([]);
  });
});
