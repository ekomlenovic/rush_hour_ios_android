import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** Consecutive failed writes before the store is told the save is not reaching the device (issue 176) */
export const WRITE_FAILURES_BEFORE_ALERT = 3;

/** Device key of a field kept in its own entry (see `separateFields`) */
const fieldKey = (name: string, field: string) => `${name}:${field}`;
/** Device keys of a list kept in chunks (see `chunkedFields`): the manifest, and each chunk */
const manifestKey = (name: string, field: string) => `${name}:${field}:packed`;
const chunkKey = (name: string, field: string, index: number) => `${name}:${field}:packed:${index}`;

/** How a list kept in chunks is written: each item as a short text, `chunkSize` items per entry */
export interface ChunkedField {
  encode: (item: never) => string;
  decode: (text: string) => unknown;
  chunkSize: number;
}

/**
 * The manifest of a list kept in chunks, written after its chunks in the same call: the
 * chunks to read (a chunk past them is a leftover), and the length of the list in its
 * former single entry when the chunks took over (null: there was none), which is never
 * written again but read by an older version installed back.
 */
interface Manifest {
  chunks: number;
  legacyLength: number | null;
}

/** What is on the device of a list kept in chunks */
interface ChunkedOnDevice {
  /** The items of each chunk written (compared by identity: the store updates immutably) */
  chunks: unknown[][];
  legacyLength: number | null;
}

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
 *
 * `chunkedFields` are separate fields (lists) that can outgrow the 2 MB an entry can hold
 * on Android: each item is written in a short form (`encode`), `chunkSize` items per
 * entry, and only the chunks that changed are written, with the manifest that says how
 * many to read (see `Manifest`). The list in its former single entry (`name:field`, up to
 * 2.1.0) is read when there are no chunks yet, and moves to them at the next write; it
 * is left as it was, for an older version installed back. If that version changed it
 * since (its length is not the one of the manifest), the richer of the two is kept.
 */
export function createGuardedStorage<S>(options: {
  delayMs?: number;
  separateFields?: readonly string[];
  chunkedFields?: Readonly<Record<string, ChunkedField>>;
  onWriteFailed?: (failed: boolean) => void;
} = {}): {
  storage: PersistStorage<S>;
  allowWrites: () => void;
  deferNextWrite: () => void;
} {
  const delayMs = options.delayMs ?? 0;
  const chunkedFields = options.chunkedFields ?? {};
  const chunkedNames = Object.keys(chunkedFields);
  const separateFields = (options.separateFields ?? []).filter(field => !(field in chunkedFields));
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
  /** The chunks on the device of each list kept in chunks, by its manifest key */
  const chunksOnDevice = new Map<string, ChunkedOnDevice>();
  /** The short form of each item already encoded */
  const encoded = new WeakMap<object, string>();

  const encodeItem = (codec: ChunkedField, item: unknown) => {
    if (!item || typeof item !== 'object') return codec.encode(item as never);
    let text = encoded.get(item);
    if (text === undefined) {
      text = codec.encode(item as never);
      encoded.set(item, text);
    }
    return text;
  };

  const write = (name: string, value: StorageValue<S>) => {
    const state: Record<string, unknown> = { ...(value.state as Record<string, unknown>) };
    const entries: [string, string][] = [];
    const written: [string, unknown][] = [];
    /** Lists kept in chunks written by this call: what will be on the device, and the leftover chunks */
    const chunked: [string, ChunkedOnDevice, string[]][] = [];
    for (const field of chunkedNames) {
      const fieldValue = state[field];
      delete state[field];
      const key = manifestKey(name, field);
      if (fieldValue === undefined || onDevice.get(key) === fieldValue) continue;
      const list = Array.isArray(fieldValue) ? fieldValue : [];
      const { chunkSize } = chunkedFields[field];
      const before = chunksOnDevice.get(key) ?? { chunks: [], legacyLength: null };
      const chunks: unknown[][] = [];
      for (let start = 0; start < list.length; start += chunkSize) chunks.push(list.slice(start, start + chunkSize));
      chunks.forEach((items, i) => {
        const was = before.chunks[i];
        if (was && was.length === items.length && was.every((item, j) => item === items[j])) return;
        entries.push([chunkKey(name, field, i), JSON.stringify(items.map(item => encodeItem(chunkedFields[field], item)))]);
      });
      const manifest: Manifest = { chunks: chunks.length, legacyLength: before.legacyLength };
      entries.push([key, JSON.stringify(manifest)]);
      written.push([key, fieldValue]);
      const leftovers = before.chunks.slice(chunks.length).map((_, i) => chunkKey(name, field, chunks.length + i));
      chunked.push([key, { chunks, legacyLength: before.legacyLength }, leftovers]);
    }
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
        for (const [key, device] of chunked) chunksOnDevice.set(key, device);
        // The chunks past the manifest are never read: removed to free the space, if this is still the latest write
        const leftovers = chunked.flatMap(([, , keys]) => keys);
        if (leftovers.length > 0 && latest.get(name) === attempt) {
          AsyncStorage.multiRemove(leftovers).catch((error) => console.warn(`[storage] ${name} leftovers not removed`, error));
        }
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

  /** Reads a list kept in chunks into the state (see `chunkedFields`) */
  const readChunked = async (name: string, field: string, state: Record<string, unknown>) => {
    const key = manifestKey(name, field);
    const [manifestText, legacyText] = await Promise.all([AsyncStorage.getItem(key), AsyncStorage.getItem(fieldKey(name, field))]);
    const manifest = manifestText === null ? null : (JSON.parse(manifestText) as Manifest);
    const legacy: unknown = legacyText === null ? null : JSON.parse(legacyText);
    const legacyLength = Array.isArray(legacy) ? legacy.length : null;

    let fromChunks: unknown[] | null = null;
    const chunks: unknown[][] = [];
    if (manifest) {
      const texts = await Promise.all(
        Array.from({ length: manifest.chunks }, (_, i) => AsyncStorage.getItem(chunkKey(name, field, i))),
      );
      for (const text of texts) {
        if (text === null) throw new Error(`[storage] ${name}: a chunk of ${field} is missing`);
        chunks.push((JSON.parse(text) as string[]).map(item => chunkedFields[field].decode(item)));
      }
      fromChunks = chunks.flat();
    }

    // In order of preference, the longer one kept: the chunks, the former entry (if an older version changed it), the main entry
    const candidates: unknown[] = [];
    if (fromChunks) candidates.push(fromChunks);
    if (legacy !== null && (!manifest || manifest.legacyLength !== legacyLength)) candidates.push(legacy);
    if (field in state) candidates.push(state[field]);
    if (candidates.length === 0) return;
    const chosen = candidates.reduce((kept, other) => richer(kept, other));
    state[field] = chosen;

    // The legacy length the manifest keeps: the former entry as it is now (an older version changed it), or as it was
    chunksOnDevice.set(key, { chunks: manifest ? chunks : [], legacyLength: legacyText !== null ? legacyLength : manifest?.legacyLength ?? null });
    if (chosen === fromChunks) onDevice.set(key, chosen);
  };

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
        for (const field of chunkedNames) await readChunked(name, field, value.state);
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
        const chunkedKeys = chunkedNames.flatMap((field) => {
          const key = manifestKey(name, field);
          const device = chunksOnDevice.get(key);
          onDevice.delete(key);
          chunksOnDevice.delete(key);
          return [fieldKey(name, field), key, ...(device?.chunks ?? []).map((_, i) => chunkKey(name, field, i))];
        });
        return AsyncStorage.multiRemove([name, ...keys, ...chunkedKeys]);
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
