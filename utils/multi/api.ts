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

/** features: what the server can do beyond the daily challenge, e.g. 'duel' (absent on older servers) */
export interface ServerInfo { name: string; apiVersion: number; minAppVersion: string; features?: string[] }
export interface ApiPlayer { id: number; pseudo: string; createdAt: number; isAdmin?: boolean }
export interface JoinResult { token: string; recoveryCode?: string; player: ApiPlayer; server: { name: string } }

export type GameStatus = 'playing' | 'won' | 'abandoned' | 'unfinished';

/** Suspicion signals computed by the server (server/src/cheat.ts) */
export type FlagCode = 'too_fast' | 'copied' | 'clock_mismatch';
export interface Flag { code: FlagCode; values: Record<string, number> }
/** ⚠️ suspect: automatic, with its reasons; 🤡 cheater: confirmed by the admin */
export type Verdict = 'suspect' | 'cheater' | null;

export interface DayRow {
  playerId: number;
  pseudo: string;
  date: string;
  status: GameStatus;
  rank: number | null;
  moves: number | null;
  timeMs: number | null;
  points: number;
  attemptId: number;
  verdict: Verdict;
  reasons: Flag[];
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
export interface SubmitResult { status: 'won'; moves: number; timeMs: number; minMoves: number; rank: number; points: number; verdict?: Verdict }

export interface Replay {
  attemptId: number;
  playerId: number;
  pseudo: string;
  date: string;
  number: number;
  level: Level;
  moves: MoveRecord[];
  timeMs: number;
  verdict: Verdict;
  reasons: Flag[];
}

export interface AdminGame {
  attemptId: number;
  playerId: number;
  pseudo: string;
  date: string;
  moves: number;
  minMoves: number | null;
  timeMs: number;
  clientMs: number | null;
  backgroundMs: number | null;
  flags: Flag[];
  adminVerdict: 'cheater' | 'cleared' | null;
  verdict: Verdict;
  hasReplay: boolean;
}

export interface AdminPlayer extends ApiPlayer { banned: boolean; games: number; reports: number }

export interface AdminReport {
  id: number;
  reason: string;
  createdAt: number;
  player: { id: number; pseudo: string };
  reporter: { id: number; pseudo: string };
}

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER';

export interface Thresholds {
  minMsPerMove: number;
  copyMinMoves: number;
  copyPauseRatio: number;
  copyMaxRhythmVariation: number;
  clockToleranceMs: number;
  clockToleranceRatio: number;
}

export interface AdminSettings {
  joinOpen: boolean;
  invitesAdminOnly: boolean;
  /** 0 = Sunday */
  difficultyByWeekday: Difficulty[];
  replayRetentionDays: number;
  thresholds: Thresholds;
  serverName: string;
  /** 'HH:MM' in timeZone; a change applies from the next challenge on */
  releaseTime: string;
  gracePeriodMs: number;
  pregenerateAheadMs: number;
  /** Time zone of the server (TZ), not changed from the app */
  timeZone: string;
  nextReleaseAt: number;
}
export type AdminSettingsPatch = Partial<Omit<AdminSettings, 'thresholds' | 'timeZone' | 'nextReleaseAt'>> & { thresholds?: Partial<Thresholds> };
/** A duel in the list of the server (server/src/duel.ts): open ones to join, the ones being played */
export interface DuelListing {
  /** To join it: open public duels and my own; null otherwise */
  code: string | null;
  difficulty: Difficulty;
  status: 'waiting' | 'preparing' | 'playing';
  private: boolean;
  players: { id: number; pseudo: string }[];
  createdAt: number;
  startsAt: number | null;
  mine: boolean;
}

export interface DuelRankRow { playerId: number; pseudo: string; rank: number; wins: number; losses: number; draws: number; played: number }
export interface DuelLeaderboard { period: Period | 'all'; from: string; to: string; rows: DuelRankRow[] }

export type DuelEndReason = 'won' | 'forfeit' | 'disconnected' | 'timeout';

export interface DuelHistoryItem {
  id: number;
  endedAt: number;
  difficulty: Difficulty;
  reason: DuelEndReason;
  winnerId: number | null;
  opponent: { id: number; pseudo: string };
  myMoves: number;
  theirMoves: number;
  timeMs: number | null;
  hasReplay: boolean;
}

/** My score against one opponent */
export interface DuelRecordLine { opponent: { id: number; pseudo: string }; wins: number; losses: number; draws: number }

export interface DuelReplay {
  id: number;
  date: string;
  difficulty: Difficulty;
  level: Level;
  reason: DuelEndReason;
  winnerId: number | null;
  players: { id: number; pseudo: string; moves: MoveRecord[] }[];
}

/** Back to zero (admin): games of the daily challenges and/or duels, between two days (none: all), of some players (none: all) */
export interface ResetRequest { from?: string | null; to?: string | null; playerIds?: number[]; challenges: boolean; duels: boolean; dryRun?: boolean }
export interface ResetResult { dryRun: boolean; challenges: number; duels: number }

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
    /** ready: puzzles ready ahead by difficulty (absent on older servers) */
    duels: () => call<{ duels: DuelListing[]; ready?: Partial<Record<Difficulty, number>> }>('GET', '/duels'),
    duelLeaderboard: (period: Period | 'all', date?: string) =>
      call<DuelLeaderboard>('GET', `/duels/leaderboard?period=${period}${date ? `&date=${date}` : ''}`),
    duelHistory: () => call<{ duels: DuelHistoryItem[]; records: DuelRecordLine[] }>('GET', '/duels/history'),
    duelReplay: (duelId: number) => call<DuelReplay>('GET', `/duels/${duelId}`),
    start: (date?: string) => call<StartResult>('POST', '/challenge/start', date ? { date } : {}),
    submit: (date: string, moves: MoveRecord[], clientMs: number, backgroundMs: number) =>
      call<SubmitResult>('POST', '/challenge/submit', { date, moves, clientMs: Math.round(clientMs), backgroundMs: Math.round(backgroundMs) }),
    abandon: (date: string) => call<{ status: 'abandoned'; minMoves: number | null }>('POST', '/challenge/abandon', { date }),
    leaderboard: (period: Period, date?: string) =>
      call<Leaderboard>('GET', `/leaderboard?period=${period}${date ? `&date=${date}` : ''}`),
    replay: (attemptId: number) => call<Replay>('GET', `/replay/${attemptId}`),
    report: (playerId: number, reason: string) => call<void>('POST', '/reports', { playerId, reason }),
    claimAdmin: (adminToken: string) => call<ApiPlayer>('POST', '/admin/claim', { adminToken }),
    admin: {
      games: (filter: 'suspects' | 'all') => call<{ games: AdminGame[] }>('GET', `/admin/games?filter=${filter}`),
      setVerdict: (attemptId: number, verdict: 'cheater' | 'cleared' | null) =>
        call<{ verdict: string | null }>('POST', `/admin/games/${attemptId}/verdict`, { verdict }),
      players: () => call<{ players: AdminPlayer[] }>('GET', '/admin/players'),
      updatePlayer: (playerId: number, patch: { pseudo?: string; banned?: boolean }) =>
        call<AdminPlayer>('PATCH', `/admin/players/${playerId}`, patch),
      transferCode: (playerId: number) => call<{ recoveryCode: string }>('POST', `/admin/players/${playerId}/transfer`),
      reports: () => call<{ reports: AdminReport[] }>('GET', '/admin/reports'),
      deleteReport: (reportId: number) => call<void>('DELETE', `/admin/reports/${reportId}`),
      newInviteCode: () => call<{ inviteCode: string }>('POST', '/admin/invite'),
      settings: () => call<AdminSettings>('GET', '/admin/settings'),
      updateSettings: (patch: AdminSettingsPatch) =>
        call<AdminSettings>('PATCH', '/admin/settings', patch),
      resetSettings: () => call<AdminSettings>('POST', '/admin/settings/reset'),
      reset: (request: ResetRequest) => call<ResetResult>('POST', '/admin/reset', request),
    },
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
