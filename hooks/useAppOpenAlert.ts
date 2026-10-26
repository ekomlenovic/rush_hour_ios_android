import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore, whenSaveLoaded } from '@/store/gameStore';

/**
 * Records the app open (settles the streak) and tells the player what happened
 * while away: comeback after 3+ days, freezes used, streak lost.
 * Mounted by the root layout, not the home screen: an app launched by the widget or a reminder
 * opens a challenge with no home screen underneath, and must record its open too (issue 188).
 * Shown at the open, before the challenge is won: never over its victory.
 * Done again when `today` changes, for an app left open past midnight, and when a daily
 * is opened or closed: one left open past midnight kept its day out of the streak until then.
 */
export function useAppOpenAlert(today: string) {
  const { t } = useTranslation();
  const openDailyDate = useGameStore(s => s.openDailyDate);
  useEffect(() => {
    let cancelled = false;
    // Settled on the loaded save, not on the empty state of the first frames
    whenSaveLoaded().then(() => {
      if (!cancelled) alertAppOpen();
    });
    return () => { cancelled = true; };
  }, [today, openDailyDate]);

  function alertAppOpen() {
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
  }
}
