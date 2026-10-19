import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** Device key of a field kept in its own entry (see `separateFields`) */
const fieldKey = (name: string, field: string) => `${name}:${field}`;

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
 *
 * `separateFields` are big and rarely changed: each is kept in its own entry, written
 * only when it changes (the store updates immutably, a field kept is the same object),
 * in the same call as the rest, before it. The state read back is the same as if it
 * were in one entry. A field still in the main entry (a save from before the split)
 * comes first, and moves to its own entry at the next write.
 */
export function createGuardedStorage<S>(options: { delayMs?: number; separateFields?: readonly string[] } = {}): {
  storage: PersistStorage<S>;
  allowWrites: () => void;
} {
  const delayMs = options.delayMs ?? 0;
  const separateFields = options.separateFields ?? [];
  let loaded = false;
  let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** The value of each separate field as it is on the device */
  const onDevice = new Map<string, unknown>();

  const write = (name: string, value: StorageValue<S>) => {
    const state: Record<string, unknown> = { ...(value.state as Record<string, unknown>) };
    const entries: [string, string][] = [];
    const written: [string, unknown][] = [];
    for (const field of separateFields) {
      const fieldValue = state[field];
      delete state[field];
      const key = fieldKey(name, field);
      if (fieldValue === undefined || onDevice.get(key) === fieldValue) continue;
      entries.push([key, JSON.stringify(fieldValue)]);
      written.push([key, fieldValue]);
    }
    entries.push([name, JSON.stringify({ ...value, state })]);

    const saved = entries.length === 1 ? AsyncStorage.setItem(name, entries[0][1]) : AsyncStorage.multiSet(entries);
    return saved
      .then(() => { for (const [key, fieldValue] of written) onDevice.set(key, fieldValue); })
      .catch((error) => console.warn(`[storage] ${name} not written`, error));
  };

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
        const [main, ...fields] = await Promise.all(
          [name, ...separateFields.map(field => fieldKey(name, field))].map(key => AsyncStorage.getItem(key)),
        );
        if (main === null) return null;
        const value = JSON.parse(main);
        if (!value || typeof value.state !== 'object' || value.state === null) return value;
        separateFields.forEach((field, i) => {
          if (field in value.state || fields[i] === null) return;
          value.state[field] = JSON.parse(fields[i]!);
          onDevice.set(fieldKey(name, field), value.state[field]);
        });
        return value;
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
        const keys = separateFields.map(field => fieldKey(name, field));
        keys.forEach(key => onDevice.delete(key));
        return AsyncStorage.multiRemove([name, ...keys]);
      },
    },
    allowWrites: () => { loaded = true; },
  };
}
