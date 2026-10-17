import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Difficulty, DuelListing, MultiApi } from '@/utils/multi/api';

interface ServerDuels {
  duels: DuelListing[] | null;
  /** Puzzles ready by difficulty: a duel of a difficulty with none waits for its puzzle */
  ready: Partial<Record<Difficulty, number>> | null;
  loadedAt: number;
}

/** The list follows the server this often while the screen is shown */
const REFRESH_MS = 4000;

/**
 * The duels of the server (open ones, ones being played), kept up to date while the
 * screen is shown. null until loaded; an older server without duels gives an empty list.
 */
export function useServerDuels(api: MultiApi | null): ServerDuels {
  const [state, setState] = useState<ServerDuels>({ duels: null, ready: null, loadedAt: 0 });

  useFocusEffect(useCallback(() => {
    if (!api) return;
    let active = true;
    const load = () => api.duels()
      .then(r => { if (active) setState({ duels: r.duels, ready: r.ready ?? null, loadedAt: Date.now() }); })
      .catch(() => { if (active) setState(s => ({ ...s, duels: s.duels ?? [], loadedAt: Date.now() })); });
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, [api]));

  return state;
}

/** Open duels I can join: the number on the Duels tab */
export const joinableCount = (duels: DuelListing[] | null) => duels?.filter(d => d.status === 'waiting' && !d.mine).length ?? 0;
