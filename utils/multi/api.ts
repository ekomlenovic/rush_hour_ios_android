import type { Level, MoveRecord } from '../../store/types';
import type { DuelLook } from './duel';

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

export interface PeriodRow {
  playerId: number; pseudo: string; rank: number; points: number; wins: number; played: number;
  /** The points of each day played, in order (absent on older servers) */
  days?: { date: string; points: number; status: GameStatus }[];
}

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
  /** The look of the player's board; absent or null: a server, a game or an app older than the looks */
  look?: DuelLook | null;
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

/** The home of the admin panel: what waits for the admin, and a word on each part */
export interface AdminSummary {
  /** Suspect wins without a decision of the admin */
  toReview: number;
  reports: number;
  players: number;
  banned: number;
  joinOpen: boolean;
  invitesAdminOnly: boolean;
  serverName: string;
  releaseTime: string;
  puzzles: { ready: number; size: number; working: AdminPuzzles['working'] };
}

/** The duel puzzles ready ahead on the server (server/src/puzzlePool.ts) */
export interface AdminPuzzles {
  difficulties: {
    difficulty: Difficulty;
    /** Puzzles from scratch kept ready, and how many are */
    size: number;
    ready: number;
    /** Variants of the catalog, and the ones not played yet; null without a catalog */
    catalog: { total: number; fresh: number } | null;
    /** Left aside after a generation too long, until then */
    asideUntil: number | null;
    /** How many by default; absent on older servers, which cannot change the size */
    defaultSize?: number;
  }[];
  /** Being generated now; null when all is ready */
  working: { difficulty: Difficulty; kind: 'scratch' | 'catalog'; since: number } | null;
  /** The puzzles from scratch, in the order the duels take them */
  puzzles: { id: number; difficulty: Difficulty; createdAt: number; level: Level }[];
}

/** A daily challenge of the server as the admin sees it (server/src/challenges.ts) */
export interface AdminChallenge {
  date: string;
  number: number;
  /** The one configured until its release, then the one it came out with */
  difficulty: Difficulty;
  releaseAt: number;
  /** Being played now */
  current: boolean;
  /** waiting: generated later, from generatesAt; failed: tried again each minute */
  status: 'ready' | 'generating' | 'failed' | 'waiting';
  /** Exact optimum asked for, like the difficulty; null: the usual one (absent on older servers) */
  wantedMoves?: number | null;
  generatesAt: number;
  generatingSince: number | null;
  failedAt: number | null;
  /** In another difficulty when it changed since: generated again before its release */
  puzzle: {
    difficulty: Difficulty;
    /** The optimum asked for when it was generated: not found when minMoves differs (absent on older servers) */
    wantedMoves?: number | null;
    minMoves: number;
    /** The level of the app it is a variant of; null: generated from scratch */
    variantOf: number | null;
    /** null: not known */
    generationMs: number | null;
    generatedAt: number;
    level: Level;
  } | null;
}

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
  /** Exact optimum of each day, 0 = Sunday; null: the usual one of the difficulty (absent on older servers) */
  minMovesByWeekday?: (number | null)[];
  replayRetentionDays: number;
  thresholds: Thresholds;
  serverName: string;
  /** 'HH:MM' in timeZone; a change applies from the next challenge on */
  releaseTime: string;
  gracePeriodMs: number;
  pregenerateAheadMs: number;
  /** Duel puzzles generated ahead by difficulty, 0: none (absent on older servers) */
  duelPool?: Record<Difficulty, number>;
  /** Time zone of the server (TZ), not changed from the app */
  timeZone: string;
  nextReleaseAt: number;
}
export type AdminSettingsPatch = Partial<Omit<AdminSettings, 'thresholds' | 'duelPool' | 'timeZone' | 'nextReleaseAt'>> & {
  thresholds?: Partial<Thresholds>;
  duelPool?: Partial<Record<Difficulty, number>>;
};
/** A duel in the list of the server (server/src/duel.ts): open ones to join, the ones being played */
/** What decides the winner of a duel: the first red car out, or the fewest moves */
export type DuelMetric = 'time' | 'moves';

export interface DuelListing {
  /** To join or watch it: public duels and my own; null otherwise (a server older than the spectators: only open ones) */
  code: string | null;
  difficulty: Difficulty;
  /** Absent on older servers: the time */
  metric?: DuelMetric;
  /** over: mine, its result waiting for me (I got out and left before the end) */
  status: 'waiting' | 'preparing' | 'playing' | 'over';
  private: boolean;
  players: { id: number; pseudo: string }[];
  createdAt: number;
  startsAt: number | null;
  mine: boolean;
  /** How many watch it; absent from a server older than the spectators */
  spectators?: number;
}

export interface DuelRankRow { playerId: number; pseudo: string; rank: number; wins: number; losses: number; draws: number; played: number }
export interface DuelLeaderboard { period: Period | 'all' | 'range'; from: string; to: string; rows: DuelRankRow[] }

export type DuelEndReason = 'won' | 'forfeit' | 'disconnected' | 'timeout';

export interface DuelHistoryItem {
  id: number;
  endedAt: number;
  difficulty: Difficulty;
  metric?: DuelMetric;
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
  metric?: DuelMetric;
  level: Level;
  reason: DuelEndReason;
  winnerId: number | null;
  /** look: absent or null for a server, a duel or an app older than the looks */
  players: { id: number; pseudo: string; moves: MoveRecord[]; look?: DuelLook | null }[];
}

/** Back to zero (admin): games of the daily challenges and/or duels, between two days (none: all), of some players (none: all) */
export interface ResetRequest { from?: string | null; to?: string | null; playerIds?: number[]; challenges: boolean; duels: boolean; dryRun?: boolean }
export interface ResetResult { dryRun: boolean; challenges: number; duels: number }

export type Period = 'day' | 'week' | 'month';
export type Leaderboard =
  | { period: 'day'; from: string; to: string; rows: DayRow[] }
  | { period: 'week' | 'month' | 'range'; from: string; to: string; rows: PeriodRow[] };

/**
 * Which ranking: the day, week or month of a date (none: today of the server), all time
 * (duels only), or between two dates ('range', only on a server with 'ranking_range')
 */
export type RankingQuery = { period: Period | 'all'; date?: string } | { period: 'range'; from: string; to: string };

export const rankingParams = (query: RankingQuery): string => query.period === 'range'
  ? `period=range&from=${query.from}&to=${query.to}`
  : `period=${query.period}${query.date ? `&date=${query.date}` : ''}`;

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
    duels: () => call<{ duels: DuelListing[]; ready?: Partial<Record<Difficulty, number>>; metrics?: DuelMetric[] }>('GET', '/duels'),
    duelLeaderboard: (query: RankingQuery) => call<DuelLeaderboard>('GET', `/duels/leaderboard?${rankingParams(query)}`),
    duelHistory: () => call<{ duels: DuelHistoryItem[]; records: DuelRecordLine[] }>('GET', '/duels/history'),
    duelReplay: (duelId: number) => call<DuelReplay>('GET', `/duels/${duelId}`),
    start: (date?: string) => call<StartResult>('POST', '/challenge/start', date ? { date } : {}),
    /** look: of my board, for the replay */
    submit: (date: string, moves: MoveRecord[], clientMs: number, backgroundMs: number, look: DuelLook) =>
      call<SubmitResult>('POST', '/challenge/submit', { date, moves, clientMs: Math.round(clientMs), backgroundMs: Math.round(backgroundMs), look }),
    abandon: (date: string) => call<{ status: 'abandoned'; minMoves: number | null }>('POST', '/challenge/abandon', { date }),
    leaderboard: (query: RankingQuery) => call<Leaderboard>('GET', `/leaderboard?${rankingParams(query)}`),
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
      deletePlayer: (playerId: number) => call<void>('DELETE', `/admin/players/${playerId}`),
      transferCode: (playerId: number) => call<{ recoveryCode: string }>('POST', `/admin/players/${playerId}/transfer`),
      reports: () => call<{ reports: AdminReport[] }>('GET', '/admin/reports'),
      deleteReport: (reportId: number) => call<void>('DELETE', `/admin/reports/${reportId}`),
      newInviteCode: () => call<{ inviteCode: string }>('POST', '/admin/invite'),
      settings: () => call<AdminSettings>('GET', '/admin/settings'),
      updateSettings: (patch: AdminSettingsPatch) =>
        call<AdminSettings>('PATCH', '/admin/settings', patch),
      resetSettings: () => call<AdminSettings>('POST', '/admin/settings/reset'),
      reset: (request: ResetRequest) => call<ResetResult>('POST', '/admin/reset', request),
      puzzles: () => call<AdminPuzzles>('GET', '/admin/puzzles'),
      challenges: () => call<{ challenges: AdminChallenge[] }>('GET', '/admin/challenges'),
      summary: () => call<AdminSummary>('GET', '/admin/summary'),
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
