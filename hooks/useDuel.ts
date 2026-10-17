import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import type { ServerAccount } from '@/store/multiStore';
import { multiApi } from '@/utils/multi/api';
import {
  duelReducer, duelSocketUrl, initialDuelState, myMove,
  type DuelClientMessage, type DuelDifficulty, type DuelMetric, type DuelServerMessage, type DuelState,
} from '@/utils/multi/duel';

/** Waits between two tries to connect again: 1 s, 2 s, 4 s… up to 15 s */
const retryDelay = (attempt: number) => Math.min(15_000, 1000 * 2 ** attempt);

export interface DuelControls {
  state: DuelState;
  /** Why the server cannot be reached for duels: too old, or WebSockets blocked on the way (reverse proxy) */
  unreachable: 'update_server' | 'duel_unreachable' | null;
  create: (difficulty: DuelDifficulty, metric: DuelMetric, isPrivate: boolean) => void;
  join: (code: string) => void;
  /** Watch a duel without playing it */
  watch: (code: string) => void;
  move: (vehicleId: string, row: number, col: number) => void;
  leave: () => void;
  rematch: () => void;
  clearError: () => void;
}

/**
 * The connection to the duels of a server: one WebSocket, opened again when it drops
 * (network, app back from the background) so that a duel goes on where it was.
 */
export function useDuel(account: ServerAccount | null): DuelControls {
  const [state, dispatch] = useReducer(duelReducer, initialDuelState);
  const [unreachable, setUnreachable] = useReducer(
    (_: DuelControls['unreachable'], next: DuelControls['unreachable']) => next, null,
  );
  const socketRef = useRef<WebSocket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!account) return;
    let stopped = false;
    let attempt = 0;
    let everOpened = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (stopped || socketRef.current) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      dispatch({ type: 'connection', status: 'connecting' });
      const socket = new WebSocket(duelSocketUrl(account.url));
      socketRef.current = socket;

      socket.onopen = () => {
        everOpened = true;
        attempt = 0;
        setUnreachable(null);
        socket.send(JSON.stringify({ type: 'auth', token: account.token } satisfies DuelClientMessage));
      };
      socket.onmessage = (event) => {
        let message: DuelServerMessage;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        // Connected again while watching a duel: watched again
        const watched = stateRef.current.duel;
        if (message.type === 'ready' && !message.duel && watched?.spectating && watched.status !== 'over') {
          socket.send(JSON.stringify({ type: 'watch', code: watched.code } satisfies DuelClientMessage));
        }
        dispatch({ type: 'message', message, now: Date.now() });
      };
      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (stopped) return;
        dispatch({ type: 'connection', status: 'offline' });
        // Refused by the server (unknown token, banned, another phone, flooding): no point trying again
        if (event.code >= 4000 && event.code < 5000) {
          dispatch({ type: 'refused', reason: event.reason });
          return;
        }
        if (!everOpened && attempt === 0) {
          // Never reached: an old server, or a reverse proxy that does not let WebSockets through
          multiApi(account.url, account.token).info()
            .then(info => setUnreachable(info.features?.includes('duel') ? 'duel_unreachable' : 'update_server'))
            .catch(() => setUnreachable('duel_unreachable'));
        }
        retryTimer = setTimeout(open, retryDelay(attempt++));
      };
    };

    open();
    // Back in the app: the system may have closed the connection meanwhile
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active' && !socketRef.current) open();
    });

    return () => {
      stopped = true;
      subscription.remove();
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close(1000, 'bye');
      socketRef.current = null;
    };
  }, [account?.url, account?.token]);

  const send = useCallback((message: DuelClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const move = useCallback((vehicleId: string, row: number, col: number) => {
    const duel = stateRef.current.duel;
    if (!duel || duel.status !== 'playing' || duel.spectating) return;
    const record = myMove(duel, vehicleId, row, col, Date.now());
    if (!record) return;
    dispatch({ type: 'local_move', move: record });
    send({ type: 'move', vehicleId: record.vehicleId, delta: record.delta });
  }, [send]);

  return {
    state,
    unreachable,
    create: useCallback(
      (difficulty: DuelDifficulty, metric: DuelMetric, isPrivate: boolean) => send({ type: 'create', difficulty, metric, private: isPrivate }),
      [send],
    ),
    join: useCallback((code: string) => send({ type: 'join', code }), [send]),
    watch: useCallback((code: string) => send({ type: 'watch', code }), [send]),
    move,
    leave: useCallback(() => {
      send({ type: 'leave' });
      dispatch({ type: 'left' });
    }, [send]),
    rematch: useCallback(() => send({ type: 'rematch' }), [send]),
    clearError: useCallback(() => dispatch({ type: 'clear_error' }), []),
  };
}
