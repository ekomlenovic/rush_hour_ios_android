import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** Consecutive failed writes before the store is told the save is not reaching the device (issue 176) */
export const WRITE_FAILURES_BEFORE_ALERT = 3;

/** Device key of a field kept in its own entry (see `separateFields`) */
const fieldKey = (name: string, field: string) => `${name}:${field}`;

/**
 * Device storage for a persisted store whose writes are held until its save has been
 * read back: an update made before (app open, a deep link) or after a failed read would
 * overwrite the player's save with an empty state. Call allowWrites once it is loaded.
 *
 * With `delayMs`, the frequent updates of little value (a move: the whole save was
 * serialized at each one) can be grouped: `deferNextWrite` keeps the state of the next
 * write as is, serialized once, at most `delayMs` after the first change. Every other
 * write (a win, a reward, a setting) is immediate and carries what was pending. Nothing
 * waits while the app is not in the foreground, where it can be killed without notice:
 * the pending state is written as soon as it leaves, and every write is immediate until
 * it is back.
 *
 * `separateFields` are big and rarely changed: each is kept in its own entry, written
 * only when it changes (the store updates immutably, a field kept is the same object),
 * in the same call as the rest, before it. The state read back is the same as if it
 * were in one entry. A field still in the main entry (a save from before the split)
 * moves to its own entry at the next write. If its own entry exists too, an older
 * version installed back wrote the main entry without reading it: the richer of the
 * two is kept (see `richer`).
 *
 * A failed write is only logged at first: the next one rewrites the whole main entry and
 * every separate field not written yet, which repairs a passing error. After
 * `WRITE_FAILURES_BEFORE_ALERT` failures in a row (the phone storage is full, issue 176),
 * `onWriteFailed(true)` tells the store, and `onWriteFailed(false)` once a write succeeds.
 * The last state not written is written again when the app comes back to the foreground.
 */
export function createGuardedStorage<S>(options: {
  delayMs?: number;
  separateFields?: readonly string[];
  onWriteFailed?: (failed: boolean) => void;
} = {}): {
  storage: PersistStorage<S>;
  allowWrites: () => void;
  deferNextWrite: () => void;
} {
  const delayMs = options.delayMs ?? 0;
  const separateFields = options.separateFields ?? [];
  let loaded = false;
  let deferNext = false;
  let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** The value of each separate field as it is on the device */
  const onDevice = new Map<string, unknown>();
  let failures = 0;
  /** Number of the latest write of each entry, and the state of the latest one when it failed */
  const latest = new Map<string, number>();
  const notWritten = new Map<string, StorageValue<S>>();
  let writes = 0;

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

    const attempt = ++writes;
    latest.set(name, attempt);
    const saved = entries.length === 1 ? AsyncStorage.setItem(name, entries[0][1]) : AsyncStorage.multiSet(entries);
    return saved
      .then(() => {
        for (const [key, fieldValue] of written) onDevice.set(key, fieldValue);
        if (latest.get(name) === attempt) notWritten.delete(name);
        if (failures >= WRITE_FAILURES_BEFORE_ALERT) options.onWriteFailed?.(false);
        failures = 0;
      })
      .catch((error) => {
        console.warn(`[storage] ${name} not written`, error);
        if (latest.get(name) === attempt) notWritten.set(name, value);
        failures += 1;
        if (failures === WRITE_FAILURES_BEFORE_ALERT) options.onWriteFailed?.(true);
      });
  };

  /** Writes again what could not be written, the app back in the foreground */
  const retry = () => {
    for (const [name, value] of [...notWritten]) {
      if (pending.has(name)) continue;
      notWritten.delete(name);
      write(name, value);
    }
  };

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const values = [...pending];
    pending.clear();
    await Promise.all(values.map(([name, value]) => write(name, value)));
  };

  if (delayMs > 0 || options.onWriteFailed) {
    AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (!foreground) flush();
      else retry();
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
          if (fields[i] === null) return;
          const own = JSON.parse(fields[i]!);
          if (field in value.state) {
            value.state[field] = richer(value.state[field], own);
            return;
          }
          value.state[field] = own;
          onDevice.set(fieldKey(name, field), own);
        });
        return value;
      },
      setItem: (name, value) => {
        const deferred = deferNext;
        deferNext = false;
        if (!loaded) return;
        if (!deferred || delayMs <= 0 || !foreground) {
          pending.delete(name);
          return write(name, value);
        }
        pending.set(name, value);
        if (!timer) timer = setTimeout(flush, delayMs);
      },
      removeItem: (name) => {
        if (!loaded) return;
        pending.delete(name);
        notWritten.delete(name);
        const keys = separateFields.map(field => fieldKey(name, field));
        keys.forEach(key => onDevice.delete(key));
        return AsyncStorage.multiRemove([name, ...keys]);
      },
    },
    allowWrites: () => { loaded = true; },
    deferNextWrite: () => { deferNext = true; },
  };
}

/**
 * A separate field found in both entries: an older version, which does not know the
 * separate entries, saw the field empty and may have added to it. Nothing is dropped:
 * the longer list (lists only grow, levels of the map keep their id), or every entry of
 * both records (the main one's on the same key).
 */
function richer(main: unknown, own: unknown): unknown {
  if (Array.isArray(main) && Array.isArray(own)) return own.length > main.length ? own : main;
  const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (isRecord(main) && isRecord(own)) return { ...own, ...main };
  return main;
}
