import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createGuardedStorage } from './guardedStorage';
import { createSecureAccountStorage } from './secureAccounts';
import type { Level, MoveRecord, Vehicle } from './types';

/**
 * Multiplayer (#46): the servers joined and the games in progress.
 * Kept apart from the game store on purpose: an exported save (.rushsave) never
 * carries these identities, and the multiplayer mode never touches the progress.
 */

/** The identity of the player on one server */
export interface ServerAccount {
  /** Base address, https://… (utils/multi/serverUrl.ts) */
  url: string;
  name: string;
  playerId: number;
  pseudo: string;
  /** Token and recovery code are kept in the secure storage, not in the save (store/secureAccounts.ts) */
  token: string;
  recoveryCode: string;
  joinedAt: number;
  /** Became admin with ADMIN_TOKEN (#50) */
  isAdmin?: boolean;
}

/** A player hidden on this phone (their pseudo, to unblock them from the account screen) */
export interface BlockedPlayer { playerId: number; pseudo: string }

/** A multiplayer game in progress, resumed where it was left */
export interface MultiGame {
  serverUrl: string;
  date: string;
  number: number;
  level: Level;
  vehicles: Vehicle[];
  /** Times from the start given by the server */
  moveLog: MoveRecord[];
  /** Start of the game, server clock */
  startedAt: number;
  /** Server clock minus phone clock */
  clockOffset: number;
  /** Start of the game, phone clock (the time measured by the app) */
  localStartedAt: number;
  deadline: number;
  /** Time spent out of the app during the game */
  backgroundMs: number;
}

interface MultiState {
  accounts: ServerAccount[];
  activeUrl: string | null;
  /** The explanation of the mode was shown */
  introSeen: boolean;
  games: Record<string, MultiGame>;
  /** Players hidden on this phone, by server (#50) */
  blocked: Record<string, BlockedPlayer[]>;
  /** The accounts could not be read back: nothing is written until the next launch (not persisted) */
  loadFailed: boolean;
  /** The last writes all failed, the phone storage is likely full (not persisted, issue 176) */
  writeFailed: boolean;

  /** Adds an account or replaces the one on the same server, and makes it the active one */
  addAccount: (account: ServerAccount) => void;
  /** Forgets a server and its games */
  removeAccount: (url: string) => void;
  setActive: (url: string) => void;
  updateAccount: (url: string, patch: Partial<Omit<ServerAccount, 'url'>>) => void;
  setIntroSeen: () => void;
  saveGame: (game: MultiGame) => void;
  removeGame: (serverUrl: string, date: string) => void;
  setBlocked: (serverUrl: string, player: BlockedPlayer, blocked: boolean) => void;
}

export const gameKey = (serverUrl: string, date: string) => `${serverUrl}|${date}`;

const multiStorage = createGuardedStorage<Partial<MultiState>>({
  onWriteFailed: (failed) => useMultiStore.setState({ writeFailed: failed }),
});
/** Token and recovery code kept apart, in the secure storage (#84) */
const accountStorage = createSecureAccountStorage(multiStorage.storage);

export const useMultiStore = create<MultiState>()(
  persist(
    (set) => ({
      accounts: [],
      activeUrl: null,
      introSeen: false,
      games: {},
      blocked: {},
      loadFailed: false,
      writeFailed: false,

      addAccount: (account) => set(state => ({
        accounts: [...state.accounts.filter(a => a.url !== account.url), account],
        activeUrl: account.url,
      })),

      removeAccount: (url) => set(state => {
        const accounts = state.accounts.filter(a => a.url !== url);
        const games = Object.fromEntries(Object.entries(state.games).filter(([, g]) => g.serverUrl !== url));
        const { [url]: _blocked, ...blocked } = state.blocked;
        return {
          accounts,
          games,
          blocked,
          activeUrl: state.activeUrl === url ? (accounts[0]?.url ?? null) : state.activeUrl,
        };
      }),

      setActive: (url) => set(state => (state.accounts.some(a => a.url === url) ? { activeUrl: url } : {})),

      updateAccount: (url, patch) => set(state => ({
        accounts: state.accounts.map(a => (a.url === url ? { ...a, ...patch } : a)),
      })),

      setIntroSeen: () => set({ introSeen: true }),

      saveGame: (game) => set(state => ({ games: { ...state.games, [gameKey(game.serverUrl, game.date)]: game } })),

      removeGame: (serverUrl, date) => set(state => {
        const { [gameKey(serverUrl, date)]: _removed, ...games } = state.games;
        return { games };
      }),

      setBlocked: (serverUrl, player, blocked) => set(state => {
        const others = (state.blocked[serverUrl] ?? []).filter(p => p.playerId !== player.playerId);
        return { blocked: { ...state.blocked, [serverUrl]: blocked ? [...others, player] : others } };
      }),
    }),
    {
      name: 'rush-hours-multi',
      version: 2,
      // v2: token and recovery code move to the secure storage (#84). The storage puts them back
      // in the accounts when it reads the save, and moves those of a v1 save at its first write
      // (right after loading): the accounts read here are already complete, nothing to convert.
      migrate: (persisted) => persisted as MultiState,
      storage: accountStorage,
      // Accounts (token, recovery code) are only written once read back: never overwritten by an empty list
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.warn('[multiStore] accounts not loaded, writes held until the next launch', error);
          useMultiStore.setState({ loadFailed: true });
          return;
        }
        multiStorage.allowWrites();
        useMultiStore.setState({});
      },
      partialize: ({ accounts, activeUrl, introSeen, games, blocked }) => ({ accounts, activeUrl, introSeen, games, blocked }),
    },
  ),
);

/** The account of the server shown in the multiplayer screen */
export const selectActiveAccount = (state: Pick<MultiState, 'accounts' | 'activeUrl'>): ServerAccount | null =>
  state.accounts.find(a => a.url === state.activeUrl) ?? state.accounts[0] ?? null;
