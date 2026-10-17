import type { Level } from '../store/types';
import {
  countdownMs, duelElapsedMs, duelReducer, duelSocketUrl, iHaveWon, initialDuelState, myMove, normalizeDuelCode, outcome,
  type DuelAction, type DuelServerMessage, type DuelState, type DuelView,
} from '../utils/multi/duel';

/** The puzzle of the server tests: v1 goes down 2 cells, then the red car leaves */
const LEVEL: Level = {
  id: 999996, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 0, updatedAt: 0,
  vehicles: [
    { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: '#E53935' },
    { id: 'v1', row: 1, col: 3, length: 2, orientation: 'vertical', isTarget: false, color: '#1E88E5' },
    { id: 'v2', row: 0, col: 0, length: 3, orientation: 'horizontal', isTarget: false, color: '#43A047' },
  ],
};

const NOW = 1_000_000;

const view = (patch: Partial<DuelView> = {}): DuelView => ({
  code: 'ABCD3', difficulty: 'NORMAL', private: false, status: 'playing', level: LEVEL,
  startsAt: 2_003_000, serverNow: 2_000_000,
  me: { id: 1, pseudo: 'Léo', connected: true, moves: [], wantsRematch: false },
  opponent: { id: 2, pseudo: 'Emma', connected: true, moves: [], wantsRematch: false },
  result: null,
  ...patch,
});

const message = (m: DuelServerMessage, now = NOW): DuelAction => ({ type: 'message', message: m, now });
const run = (state: DuelState, ...actions: DuelAction[]) => actions.reduce(duelReducer, state);
const playing = () => run(initialDuelState, message({ type: 'ready', player: { id: 1, pseudo: 'Léo' }, duel: null }), message({ type: 'duel', duel: view() }));

describe('duel on the phone', () => {
  it('talks to the server over wss', () => {
    expect(duelSocketUrl('https://monserveur.duckdns.org')).toBe('wss://monserveur.duckdns.org/api/v1/duel');
    expect(duelSocketUrl('https://example.com:8443/rush')).toBe('wss://example.com:8443/rush/api/v1/duel');
    expect(normalizeDuelCode(' ab-c d3 ')).toBe('ABCD3');
  });

  it('follows the clock of the server: countdown, then time since the start', () => {
    const { duel } = playing();
    expect(duel!.clockOffset).toBe(1_000_000);
    expect(countdownMs(duel!, NOW)).toBe(3000);
    expect(countdownMs(duel!, NOW + 3500)).toBe(0);
    expect(duelElapsedMs(duel!, NOW + 5000)).toBe(2000);
  });

  it('my move shows at once, and is not played twice when the server sends it back', () => {
    let state = playing();
    const move = myMove(state.duel!, 'v1', 3, 3, NOW + 4500)!;
    expect(move).toEqual({ vehicleId: 'v1', delta: 2, t: 1500 });
    state = run(state, { type: 'local_move', move });
    expect(state.duel!.me.vehicles.find(v => v.id === 'v1')).toMatchObject({ row: 3 });
    expect(state.duel!.pending).toHaveLength(1);

    state = run(state, message({ type: 'move', playerId: 1, move: { ...move, t: 1520 } }));
    expect(state.duel!.pending).toEqual([]);
    expect(state.duel!.me.moves).toEqual([{ vehicleId: 'v1', delta: 2, t: 1520 }]);
    expect(state.duel!.me.vehicles.find(v => v.id === 'v1')).toMatchObject({ row: 3 });
  });

  it('a blocked move is not played', () => {
    const state = playing();
    expect(run(state, { type: 'local_move', move: { vehicleId: 'target', delta: 4, t: 0 } })).toBe(state);
  });

  it('the board of the opponent moves with their moves', () => {
    const state = run(playing(), message({ type: 'move', playerId: 2, move: { vehicleId: 'v1', delta: 2, t: 900 } }));
    expect(state.duel!.opponent!.vehicles.find(v => v.id === 'v1')).toMatchObject({ row: 3 });
    expect(state.duel!.opponent!.moves).toHaveLength(1);
    expect(state.duel!.me.vehicles.find(v => v.id === 'v1')).toMatchObject({ row: 1 });
  });

  it('the whole duel from the server puts both boards where they are', () => {
    const state = run(initialDuelState, message({
      type: 'ready', player: { id: 1, pseudo: 'Léo' },
      duel: view({ me: { id: 1, pseudo: 'Léo', connected: true, moves: [{ vehicleId: 'v1', delta: 2, t: 100 }], wantsRematch: false } }),
    }));
    expect(state.connection).toBe('online');
    expect(state.duel!.me.vehicles.find(v => v.id === 'v1')).toMatchObject({ row: 3 });
    expect(state.duel!.opponent!.vehicles).toEqual(LEVEL.vehicles);
  });

  it('wins, loses, draws', () => {
    let state = run(playing(),
      { type: 'local_move', move: { vehicleId: 'v1', delta: 2, t: 100 } },
      { type: 'local_move', move: { vehicleId: 'target', delta: 4, t: 200 } });
    expect(iHaveWon(state.duel!)).toBe(true);
    const end = (winnerId: number | null) => message({ type: 'end', result: { winnerId, reason: 'won', timeMs: 5000, minMoves: 2, duelId: null, score: null }, level: { ...LEVEL, minMoves: 2 } });
    state = run(state, end(1));
    expect(outcome(state.duel!)).toBe('win');
    expect(state.duel!.status).toBe('over');
    expect(state.duel!.level!.minMoves).toBe(2);
    expect(duelElapsedMs(state.duel!, NOW + 999_999)).toBe(5000);
    expect(outcome(run(playing(), end(2)).duel!)).toBe('loss');
    expect(outcome(run(playing(), end(null)).duel!)).toBe('draw');
  });

  it('the opponent leaves: during the game the room is gone, after the end the result stays', () => {
    expect(run(playing(), message({ type: 'closed' }))).toMatchObject({ duel: null, error: 'opponent_left' });
    const over = run(playing(), message({ type: 'end', result: { winnerId: 1, reason: 'forfeit', timeMs: null, minMoves: 2, duelId: null, score: null }, level: LEVEL }), message({ type: 'closed' }));
    expect(over.duel).toMatchObject({ status: 'over', opponentLeft: true });
  });

  it('rematch and presence of the opponent', () => {
    let state = run(playing(), message({ type: 'presence', playerId: 2, connected: false }));
    expect(state.duel!.opponent!.connected).toBe(false);
    state = run(state, message({ type: 'rematch', playerId: 2 }));
    expect(state.duel!.opponent!.wantsRematch).toBe(true);
    expect(state.duel!.me.wantsRematch).toBe(false);
  });

  it('shows the errors of the server, except a move out of step', () => {
    const state = playing();
    expect(run(state, message({ type: 'error', error: 'invalid_moves' }))).toBe(state);
    expect(run(initialDuelState, message({ type: 'error', error: 'duel_not_found' })).error).toBe('duel_not_found');
  });

  it('closed by the server on purpose: the game is lost, the reason is told', () => {
    const { refusalError } = require('../utils/multi/duel') as typeof import('../utils/multi/duel');
    expect(run(playing(), { type: 'refused', reason: 'banned' })).toMatchObject({ connection: 'offline', duel: null, error: 'banned' });
    const over = run(playing(), message({ type: 'end', result: { winnerId: 2, reason: 'won', timeMs: 1, minMoves: 2, duelId: null, score: null }, level: LEVEL }));
    expect(run(over, { type: 'refused', reason: 'replaced' }).duel).toMatchObject({ status: 'over' });
    expect(['replaced', 'signed_out', 'deleted', 'rate_limited', 'unauthorized'].map(refusalError))
      .toEqual(['duel_replaced', 'duel_replaced', 'unauthorized', 'rate_limited', 'unauthorized']);
  });

  it('connected again after the end of a duel: its result stays', () => {
    const over = run(playing(), message({ type: 'end', result: { winnerId: 2, reason: 'disconnected', timeMs: null, minMoves: 2, duelId: null, score: null }, level: LEVEL }));
    const back = run(over, { type: 'connection', status: 'offline' }, message({ type: 'ready', player: { id: 1, pseudo: 'Léo' }, duel: null }));
    expect(back.duel).toMatchObject({ status: 'over', opponentLeft: true });
    expect(run(playing(), message({ type: 'ready', player: { id: 1, pseudo: 'Léo' }, duel: null })).duel).toBeNull();
  });
});

describe('replay of a duel', () => {
  const { mergeDuelMoves, movesPlayedAt } = require('../utils/multi/duelReplay') as typeof import('../utils/multi/duelReplay');
  const move = (vehicleId: string, t: number) => ({ vehicleId, delta: 1, t });

  it('puts the moves of both players on one timeline', () => {
    const steps = mergeDuelMoves([
      { moves: [move('a', 1000), move('b', 3000), move('c', 3000)] },
      { moves: [move('x', 500), move('y', 3000)] },
    ]);
    expect(steps.map(s => `${s.player}${s.move.vehicleId}`)).toEqual(['1x', '0a', '0b', '0c', '1y']);
    expect(movesPlayedAt(steps, 0, 2)).toEqual([0, 0]);
    expect(movesPlayedAt(steps, 3, 2)).toEqual([2, 1]);
    expect(movesPlayedAt(steps, 99, 2)).toEqual([3, 2]);
  });
});
