import type { Level, MoveRecord } from '../../store/types';

/** Version of the server API this app speaks (server/src/app.ts) */
export const API_VERSION = 1;
const TIMEOUT_MS = 15_000;

/**
 * An error of the server ({ error: code }), or of the network:
 * 'network' (no answer), 'timeout', 'bad_response' (not a Rush Hours server?)
 */
export class MultiApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly details: Record<string, unknown> = {}) {
    super(code);
  }
}

export interface ServerInfo { name: string; apiVersion: number; minAppVersion: string }
export interface ApiPlayer { id: number; pseudo: string; createdAt: number }
export interface JoinResult { token: string; recoveryCode?: string; player: ApiPlayer; server: { name: string } }

export type GameStatus = 'playing' | 'won' | 'abandoned' | 'unfinished';

export interface DayRow {
  playerId: number;
  pseudo: string;
  date: string;
  status: GameStatus;
  rank: number | null;
  moves: number | null;
  timeMs: number | null;
  points: number;
}

export interface PeriodRow { playerId: number; pseudo: string; rank: number; points: number; wins: number; played: number }

export interface MyGame {
  status: GameStatus;
  startedAt: number;
  deadline: number;
  moves: number | null;
  timeMs: number | null;
  minMoves: number | null;
}

export interface Today {
  date: string;
  number: number;
  status: 'ready' | 'preparing';
  releasedAt: number;
  closesAt: number;
  serverNow: number;
  me: MyGame | null;
  /** A game of the previous challenge that can still be finished */
  pending: { date: string; deadline: number } | null;
  results: DayRow[];
}

export interface StartResult { date: string; number: number; startedAt: number; deadline: number; serverNow: number; level: Level }
export interface SubmitResult { status: 'won'; moves: number; timeMs: number; minMoves: number; rank: number; points: number }
export type Period = 'day' | 'week' | 'month';
export type Leaderboard =
  | { period: 'day'; from: string; to: string; rows: DayRow[] }
  | { period: 'week' | 'month'; from: string; to: string; rows: PeriodRow[] };

type Fetch = typeof fetch;

/** A client for one server, with the token of the player (none to join) */
export function multiApi(serverUrl: string, token?: string, fetchImpl: Fetch = fetch) {
  async function call<T>(method: string, path: string, body?: object): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(`${serverUrl}/api/v1${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      throw new MultiApiError(controller.signal.aborted ? 'timeout' : 'network', 0);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new MultiApiError('bad_response', response.status);
    }
    if (!response.ok) {
      const { error, ...details } = (data ?? {}) as { error?: unknown };
      throw new MultiApiError(typeof error === 'string' ? error : 'bad_response', response.status, details);
    }
    return data as T;
  }

  return {
    info: () => call<ServerInfo>('GET', '/info'),
    join: (inviteCode: string, pseudo: string) => call<JoinResult>('POST', '/join', { inviteCode, pseudo }),
    recover: (recoveryCode: string) => call<JoinResult>('POST', '/recover', { recoveryCode }),
    me: () => call<ApiPlayer>('GET', '/me'),
    rename: (pseudo: string) => call<ApiPlayer>('PATCH', '/me', { pseudo }),
    renewRecoveryCode: () => call<{ recoveryCode: string }>('POST', '/me/recovery'),
    deleteAccount: () => call<void>('DELETE', '/me'),
    invite: () => call<{ inviteCode: string }>('GET', '/invite'),
    today: () => call<Today>('GET', '/challenge/today'),
    start: (date?: string) => call<StartResult>('POST', '/challenge/start', date ? { date } : {}),
    submit: (date: string, moves: MoveRecord[], clientMs: number, backgroundMs: number) =>
      call<SubmitResult>('POST', '/challenge/submit', { date, moves, clientMs: Math.round(clientMs), backgroundMs: Math.round(backgroundMs) }),
    abandon: (date: string) => call<{ status: 'abandoned'; minMoves: number | null }>('POST', '/challenge/abandon', { date }),
    leaderboard: (period: Period, date?: string) =>
      call<Leaderboard>('GET', `/leaderboard?period=${period}${date ? `&date=${date}` : ''}`),
  };
}

export type MultiApi = ReturnType<typeof multiApi>;

/** 'a.b.c' versions: is a older than b? */
export function isOlderVersion(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** Can this app talk to a server? Otherwise, which side must be updated */
export function checkCompatibility(info: ServerInfo, appVersion: string): 'ok' | 'update_app' | 'update_server' {
  if (typeof info?.apiVersion !== 'number') return 'update_server';
  if (info.apiVersion > API_VERSION || isOlderVersion(appVersion, info.minAppVersion ?? '0')) return 'update_app';
  if (info.apiVersion < API_VERSION) return 'update_server';
  return 'ok';
}
