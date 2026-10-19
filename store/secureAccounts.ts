import * as SecureStore from 'expo-secure-store';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * Secrets of the multiplayer accounts (#84): the token and the recovery code take over the
 * account, so they live in the Keychain (iOS) / Keystore (Android) rather than in AsyncStorage,
 * which is not encrypted and goes to the Android backups. The rest of the account stays in
 * the store, which gets them back from here when it is read.
 */

interface Secrets { token: string; recoveryCode: string }

/** SecureStore keys only allow letters, digits, '.', '-' and '_': the other characters of the address are escaped */
export function secretKey(url: string): string {
  const escaped = Array.from(url, c => (/[A-Za-z0-9.-]/.test(c) ? c : `_${c.codePointAt(0)!.toString(16)}_`)).join('');
  return `rush-hours-multi.${escaped}`;
}

const sameSecrets = (a: Secrets | undefined, b: Secrets) => !!a && a.token === b.token && a.recoveryCode === b.recoveryCode;

type StoredAccount = { url: string; token?: unknown; recoveryCode?: unknown } & Record<string, unknown>;

/** The accounts of a persisted multiplayer state, if it has any */
function accountsOf(state: unknown): StoredAccount[] | null {
  const accounts = (state as { accounts?: unknown } | null)?.accounts;
  return Array.isArray(accounts) ? (accounts as StoredAccount[]) : null;
}

/**
 * Wraps the storage of the multiplayer store: secrets are written to the secure storage and
 * left out of the save, then put back in the accounts when it is read. An account saved before
 * (v1) still has them in the save: they move at the next write. If the secure storage fails,
 * they stay in the save rather than being lost (the player stays signed in).
 */
export function createSecureAccountStorage<S>(base: PersistStorage<S>): PersistStorage<S> {
  /** Secrets as they are in the secure storage, by server: only changes are written */
  const stored = new Map<string, Secrets>();
  /** The save was read: before, the state written is the empty one of the first frames */
  let read = false;
  // Writes in order: a removed account must not come back from an older write still running
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = (task: () => Promise<unknown>) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run as Promise<void>;
  };

  async function write(name: string, value: StorageValue<S>) {
    const accounts = accountsOf(value.state);
    if (!accounts) return base.setItem(name, value);

    const kept = await Promise.all(accounts.map(async account => {
      const { token, recoveryCode, ...rest } = account;
      const secrets: Secrets = { token: typeof token === 'string' ? token : '', recoveryCode: typeof recoveryCode === 'string' ? recoveryCode : '' };
      // Nothing to keep for an account whose secrets were lost (Keystore reset): it is not signed in
      if (sameSecrets(stored.get(account.url), secrets) || (!secrets.token && !secrets.recoveryCode)) return rest;
      try {
        await SecureStore.setItemAsync(secretKey(account.url), JSON.stringify(secrets));
        stored.set(account.url, secrets);
        return rest;
      } catch (error) {
        console.warn('[multiStore] secure storage unavailable, secrets kept in the save', error);
        return account;
      }
    }));
    await base.setItem(name, { ...value, state: { ...value.state, accounts: kept } });

    // Forgotten servers: their secrets go too, once the save without them is written
    const urls = new Set(accounts.map(a => a.url));
    for (const url of [...stored.keys()].filter(u => !urls.has(u))) {
      stored.delete(url);
      await SecureStore.deleteItemAsync(secretKey(url)).catch(error => console.warn('[multiStore] secret not deleted', error));
    }
  }

  return {
    getItem: async (name) => {
      const value = await base.getItem(name);
      const accounts = accountsOf(value?.state);
      if (value && accounts) {
        for (const account of accounts) {
          // Secrets still in the save (v1, or kept there when the secure storage failed) move at the next write
          if (typeof account.token === 'string') continue;
          // A read error is thrown: the store is then not loaded and writes nothing until the next launch
          const raw = await SecureStore.getItemAsync(secretKey(account.url));
          const secrets: Secrets = raw ? JSON.parse(raw) : { token: '', recoveryCode: '' };
          if (raw) stored.set(account.url, secrets);
          account.token = secrets.token;
          account.recoveryCode = secrets.recoveryCode;
        }
      }
      read = true;
      return value;
    },
    // Before the save is read, nothing to move nor forget: the guarded storage drops the write anyway
    setItem: (name, value) => (read ? enqueue(() => write(name, value)) : base.setItem(name, value)),
    removeItem: (name) => (!read ? base.removeItem(name) : enqueue(async () => {
      await base.removeItem(name);
      for (const url of [...stored.keys()]) {
        stored.delete(url);
        await SecureStore.deleteItemAsync(secretKey(url)).catch(() => {});
      }
    })),
  };
}
