import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/**
 * Device storage for a persisted store whose writes are held until its save has been
 * read back: an update made before (app open, a deep link) or after a failed read would
 * overwrite the player's save with an empty state. Call allowWrites once it is loaded.
 */
export function createGuardedStorage(): { storage: StateStorage; allowWrites: () => void } {
  let loaded = false;
  return {
    storage: {
      getItem: (name) => AsyncStorage.getItem(name),
      setItem: (name, value) => (loaded ? AsyncStorage.setItem(name, value) : Promise.resolve()),
      removeItem: (name) => (loaded ? AsyncStorage.removeItem(name) : Promise.resolve()),
    },
    allowWrites: () => { loaded = true; },
  };
}
