import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { useCloudSyncStore } from '@/store/cloudSyncStore';
import { isCloudSyncAvailable, syncProgress } from '@/utils/cloudSync';

/** A win is synced a little after it: the win screen first, and the writes of the win done */
export const WIN_SYNC_DELAY_MS = 3000;

/**
 * Automatic sync with Play Jeux (issue 320): at launch (a new phone gets its progress back), when the
 * app leaves the foreground, and after a win; never during a game. Nothing on a phone where it is
 * not available (iOS, the web, the APK from GitHub).
 */
export function useCloudSync() {
  const { t } = useTranslation();
  const restored = useCloudSyncStore(s => s.restored);

  useEffect(() => {
    if (!isCloudSyncAvailable()) return;
    syncProgress('launch');

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') syncProgress('background');
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useGameStore.subscribe((state, previous) => {
      if (state.stats.totalWins <= previous.stats.totalWins) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        syncProgress('win');
      }, WIN_SYNC_DELAY_MS);
    });

    return () => {
      subscription.remove();
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!restored) return;
    useCloudSyncStore.setState({ restored: false });
    Alert.alert(t('save.cloud_restored_title'), t('save.cloud_restored_body'));
  }, [restored, t]);
}
