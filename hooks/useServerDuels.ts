import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Difficulty, DuelListing, DuelMetric, MultiApi } from '@/utils/multi/api';

interface ServerDuels {
  duels: DuelListing[] | null;
  /** Puzzles ready by difficulty: a duel of a difficulty with none waits for its puzzle */
  ready: Partial<Record<Difficulty, number>> | null;
  /** What can decide the winner of a new duel; only the time on an older server */
  metrics: DuelMetric[];
  loadedAt: number;
}

/** The list follows the server this often while the Duels tab is shown */
const REFRESH_MS = 4000;
/** On the other tabs, only the number on the Duels tab needs it: much less often (issue 165) */
export const BACKGROUND_REFRESH_MS = 45_000;

/** How often the list is read: often on the Duels tab, rarely elsewhere */
export const refreshInterval = (duelsTabShown: boolean) => (duelsTabShown ? REFRESH_MS : BACKGROUND_REFRESH_MS);

/**
 * The duels of the server (open ones, ones being played), kept up to date while the
 * screen is shown. null until loaded; an older server without duels gives an empty list.
 * A read waits for the one before to answer: a slow server is never asked twice at once.
 */
export function useServerDuels(api: MultiApi | null, duelsTabShown = true): ServerDuels {
  const [state, setState] = useState<ServerDuels>({ duels: null, ready: null, metrics: ['time'], loadedAt: 0 });

  useFocusEffect(useCallback(() => {
    if (!api) return;
    let active = true;
    let loading = false;
    const load = () => {
      if (loading) return;
      loading = true;
      api.duels()
        .then(r => { if (active) setState({ duels: r.duels, ready: r.ready ?? null, metrics: r.metrics ?? ['time'], loadedAt: Date.now() }); })
        .catch(() => { if (active) setState(s => ({ ...s, duels: s.duels ?? [], loadedAt: Date.now() })); })
        .finally(() => { loading = false; });
    };
    load();
    const timer = setInterval(load, refreshInterval(duelsTabShown));
    return () => { active = false; clearInterval(timer); };
  }, [api, duelsTabShown]));

  return state;
}

/** Open duels I can join: the number on the Duels tab */
export const joinableCount = (duels: DuelListing[] | null) => duels?.filter(d => d.status === 'waiting' && !d.mine).length ?? 0;
