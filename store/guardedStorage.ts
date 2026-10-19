import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * Device storage for a persisted store whose writes are held until its save has been
 * read back: an update made before (app open, a deep link) or after a failed read would
 * overwrite the player's save with an empty state. Call allowWrites once it is loaded.
 *
 * With `delayMs`, the writes of a burst (a move updates the store several times, and
 * the whole save is serialized each time) are grouped: the latest state is kept as is
 * and serialized once, at most `delayMs` after the first change. Nothing waits while
 * the app is not in the foreground, where it can be killed without notice: the pending
 * state is written as soon as it leaves, and every write is immediate until it is back.
 */
export function createGuardedStorage<S>(options: { delayMs?: number } = {}): {
  storage: PersistStorage<S>;
  allowWrites: () => void;
} {
  const delayMs = options.delayMs ?? 0;
  let loaded = false;
  let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = (name: string, value: StorageValue<S>) => AsyncStorage.setItem(name, JSON.stringify(value))
    .catch((error) => console.warn(`[storage] ${name} not written`, error));

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const values = [...pending];
    pending.clear();
    await Promise.all(values.map(([name, value]) => write(name, value)));
  };

  if (delayMs > 0) {
    AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (!foreground) flush();
    });
  }

  return {
    storage: {
      getItem: async (name) => {
        const value = await AsyncStorage.getItem(name);
        return value === null ? null : JSON.parse(value);
      },
      setItem: (name, value) => {
        if (!loaded) return;
        if (delayMs <= 0 || !foreground) {
          pending.delete(name);
          return write(name, value);
        }
        pending.set(name, value);
        if (!timer) timer = setTimeout(flush, delayMs);
      },
      removeItem: (name) => {
        if (!loaded) return;
        pending.delete(name);
        return AsyncStorage.removeItem(name);
      },
    },
    allowWrites: () => { loaded = true; },
  };
}
