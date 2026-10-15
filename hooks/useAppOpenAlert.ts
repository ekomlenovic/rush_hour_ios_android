import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';

/**
 * Records the app open (settles the streak) and tells the player what happened
 * while away: comeback after 3+ days, freezes used, streak lost.
 */
export function useAppOpenAlert() {
  const { t } = useTranslation();
  useEffect(() => {
    const info = useGameStore.getState().recordAppOpen();
    const lines = [
      info.isComeback ? t('home.welcome_back_desc', { days: info.missedDays }) : null,
      info.frozenDays > 0 ? t('home.freeze_used', { count: info.frozenDays, streak: useGameStore.getState().currentStreak }) : null,
      info.lostStreak > 0 ? t('home.streak_lost', { count: info.lostStreak }) : null,
    ].filter(Boolean);
    if (lines.length > 0) {
      setTimeout(() => {
        Alert.alert(
          info.isComeback ? t('home.welcome_back') : info.frozenDays > 0 ? '❄️' : '🔥',
          lines.join('\n\n')
        );
      }, 500);
    }
  }, []);
}
