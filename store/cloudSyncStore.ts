import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Settings of the automatic sync with Play Jeux (issue 320), kept apart from the game store on
 * purpose: they belong to this phone (never in a .rushsave, never in the cloud save), and the game's
 * save keeps its shape (no STORE_VERSION change).
 */

/** Where the last sync stands, for the Sauvegarde section */
export type CloudSyncStatus =
  /** Not tried yet in this session */
  | 'idle'
  | 'syncing'
  | 'synced'
  /** The player is not signed in to Play Jeux: nothing is sent, the game plays as usual */
  | 'signed_out'
  /** The cloud save comes from a newer version of the game: it is left as is until this one is updated */
  | 'remote_newer'
  /** Over the size limit of Saved Games */
  | 'too_big'
  /** No network, Play Jeux not answering… tried again at the next occasion */
  | 'failed';

interface CloudSyncState {
  /** On by default: the progress follows the player without them doing anything; they can turn it off */
  enabled: boolean;
  /** Last successful sync (ms since epoch) */
  lastSyncAt: number | null;
  /** Not persisted */
  status: CloudSyncStatus;
  /** A phone that had not played got its progress back from the cloud, not said to the player yet (not persisted) */
  restored: boolean;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: CloudSyncStatus) => void;
  markSynced: (at: number) => void;
}

export const useCloudSyncStore = create<CloudSyncState>()(
  persist(
    (set) => ({
      enabled: true,
      lastSyncAt: null,
      status: 'idle',
      restored: false,
      setEnabled: (enabled) => set({ enabled }),
      setStatus: (status) => set({ status }),
      markSynced: (at) => set({ status: 'synced', lastSyncAt: at }),
    }),
    {
      name: 'rush-hours-cloud-sync',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ enabled: state.enabled, lastSyncAt: state.lastSyncAt }),
    },
  ),
);

/** Resolves once the settings are read back from the device */
export function whenCloudSettingsLoaded(): Promise<void> {
  if (useCloudSyncStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useCloudSyncStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
