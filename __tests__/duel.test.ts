import type { Level } from '../store/types';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import {
  APP_FEATURES, MAX_KEPT_REACTIONS, REACTION_SHOWN_MS,
  countdownMs, duelElapsedMs, duelReducer, duelSocketUrl, iHaveWon, initialDuelState, myMove, normalizeDuelCode, opponentHasWon, outcome,
  reactionsFor, winnerOf,
  type DuelAction, type DuelServerMessage, type DuelState, type DuelView,
} from '../utils/multi/duel';
import { REACTIONS, REACTION_IDS, isReactionId } from '../utils/multi/reactions';

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

  it("keeps each player's look for their board, through the moves", () => {
    const look = { board: 'neon', skin: 'taxi', palette: 'ocean' };
    let state = run(initialDuelState, message({
      type: 'duel', duel: view({ opponent: { id: 2, pseudo: 'Emma', connected: true, moves: [], wantsRematch: false, look } }),
    }));
    // A server older than the looks: my own look for both
    expect(state.duel!.me.look).toBeNull();
    state = run(state, message({ type: 'move', playerId: 2, move: { vehicleId: 'v1', delta: 2, t: 4000 } }));
    expect(state.duel!.opponent!.look).toEqual(look);
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

  it('the metric of the duel: the time on an older server', () => {
    expect(playing().duel!.metric).toBe('time');
    const state = run(initialDuelState, message({ type: 'duel', duel: view({ metric: 'moves' }) }));
    expect(state.duel!.metric).toBe('moves');
  });

  it('a duel on moves goes on once the opponent is out: their board tells it', () => {
    let state = run(initialDuelState, message({ type: 'duel', duel: view({ metric: 'moves' }) }));
    state = run(state, message({ type: 'move', playerId: 2, move: { vehicleId: 'v1', delta: 2, t: 900 } }));
    expect(opponentHasWon(state.duel!)).toBe(false);
    state = run(state, message({ type: 'move', playerId: 2, move: { vehicleId: 'target', delta: 4, t: 1900 } }));
    expect(opponentHasWon(state.duel!)).toBe(true);
    expect(iHaveWon(state.duel!)).toBe(false);
    expect(state.duel!.status).toBe('playing');
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
    // Closed for a reason the server told
    expect(run(playing(), message({ type: 'error', error: 'puzzle_unavailable' }), message({ type: 'closed' })))
      .toMatchObject({ duel: null, error: 'puzzle_unavailable' });
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

  it('a message of a newer server changes nothing (2.0.3 lost the duel state on one, and the screen broke)', () => {
    const state = playing();
    const unknown = { type: 'hologram', playerId: 2 } as unknown as DuelServerMessage;
    expect(run(state, message(unknown))).toBe(state);
    expect(run(initialDuelState, message(unknown))).toBe(initialDuelState);
    // The app says what it knows: the server sends it nothing else
    expect(APP_FEATURES).toEqual(['reactions']);
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

  it('a spectator sees both boards move, and plays nothing', () => {
    const watching = (patch: Partial<DuelView> = {}) => run(
      initialDuelState,
      message({ type: 'ready', player: { id: 3, pseudo: 'Sam' }, duel: null }),
      message({ type: 'duel', duel: view({ spectating: true, spectators: 1, ...patch }) }),
    );
    let state = watching();
    expect(state.duel).toMatchObject({ spectating: true, spectators: 1 });
    state = run(state, message({ type: 'move', playerId: 1, move: { vehicleId: 'v1', delta: 2, t: 900 } }));
    expect(state.duel!.me.vehicles.find(v => v.id === 'v1')).toMatchObject({ row: 3 });
    expect(state.duel!.me.moves).toHaveLength(1);
    state = run(state, message({ type: 'presence', playerId: 1, connected: false }), message({ type: 'spectators', count: 4 }));
    expect(state.duel).toMatchObject({ spectators: 4, me: { connected: false } });

    // Connected again: the duel stays until the server sends it again; gone meanwhile, it is said
    state = run(state, message({ type: 'ready', player: { id: 3, pseudo: 'Sam' }, duel: null }));
    expect(state.duel?.code).toBe('ABCD3');
    expect(run(state, message({ type: 'error', error: 'duel_not_found' }))).toMatchObject({ duel: null, error: 'duel_not_found' });

    state = run(state, message({ type: 'end', result: { winnerId: 2, reason: 'won', timeMs: 4000, minMoves: 2, duelId: 7, score: null }, level: LEVEL }));
    expect(winnerOf(state.duel!)?.pseudo).toBe('Emma');
    // A server older than the spectators: a player
    expect(playing().duel).toMatchObject({ spectating: false, spectators: 0 });
  });

  it('the reactions of the spectators show over the board of their player, for a while', () => {
    const sam = { id: 3, pseudo: 'Sam' };
    // The server says which reactions it relays: those this app does not know are not offered
    let state = run(initialDuelState, message({ type: 'duel', duel: view({ spectating: true, reactions: ['snail', 'encourage', 'dance'] }) }));
    expect(state.duel!.reactions).toEqual(['snail', 'encourage']);
    // A server older than the reactions: none
    expect(playing().duel!.reactions).toEqual([]);
    // Whose app shows them: no use reacting to an older one
    expect(playing().duel!.opponent!.seesReactions).toBe(false);
    const seen = run(initialDuelState, message({
      type: 'duel', duel: view({ reactions: ['snail'], opponent: { id: 2, pseudo: 'Emma', connected: true, moves: [], wantsRematch: false, seesReactions: true } }),
    }));
    expect(seen.duel!.opponent!.seesReactions).toBe(true);
    // Back on another app (updated, or an older phone): said with the presence; an older server says nothing, it stays
    const older = run(seen, message({ type: 'presence', playerId: 2, connected: true, seesReactions: false }));
    expect(older.duel!.opponent).toMatchObject({ connected: true, seesReactions: false });
    expect(run(seen, message({ type: 'presence', playerId: 2, connected: false })).duel!.opponent!.seesReactions).toBe(true);

    state = run(
      state,
      message({ type: 'reaction', from: sam, playerId: 2, reaction: 'snail' }),
      message({ type: 'reaction', from: { id: 4, pseudo: 'Zoé' }, playerId: 1, reaction: 'encourage' }, NOW + 1000),
      // A newer reaction, or aimed at nobody of the duel: not shown
      message({ type: 'reaction', from: sam, playerId: 2, reaction: 'dance' }),
      message({ type: 'reaction', from: sam, playerId: 9, reaction: 'snail' }),
    );
    expect(state.duel!.lastReactions).toEqual([
      { seq: 1, from: sam, playerId: 2, reaction: 'snail', at: NOW },
      { seq: 2, from: { id: 4, pseudo: 'Zoé' }, playerId: 1, reaction: 'encourage', at: NOW + 1000 },
    ]);
    expect(reactionsFor(state.duel!, 2, NOW + 500).map(r => r.reaction)).toEqual(['snail']);
    expect(reactionsFor(state.duel!, 1, NOW + 500).map(r => r.reaction)).toEqual(['encourage']);
    // Gone after a while, and never from a player I blocked
    expect(reactionsFor(state.duel!, 2, NOW + REACTION_SHOWN_MS)).toEqual([]);
    expect(reactionsFor(state.duel!, 1, NOW + 1500, [4])).toEqual([]);

    // A few at once at most; a rematch keeps them on screen
    for (let i = 0; i < MAX_KEPT_REACTIONS; i++) state = run(state, message({ type: 'reaction', from: sam, playerId: 1, reaction: 'yawn' }));
    expect(state.duel!.lastReactions).toHaveLength(MAX_KEPT_REACTIONS);
    expect(state.duel!.lastReactions[MAX_KEPT_REACTIONS - 1].seq).toBe(MAX_KEPT_REACTIONS + 2);
    state = run(state, message({ type: 'duel', duel: view({ spectating: true, reactions: ['snail'] }) }));
    expect(state.duel!.lastReactions).toHaveLength(MAX_KEPT_REACTIONS);

    // A reaction dropped by the server: nothing to tell
    expect(run(state, message({ type: 'error', error: 'too_many_reactions' }))).toBe(state);
    expect(run(state, message({ type: 'error', error: 'reaction_refused' }))).toBe(state);
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

describe('reactions of the spectators', () => {
  it('keeps its ids: they go over the WebSocket, only add at the end', () => {
    expect(REACTION_IDS).toEqual([
      'snail', 'yawn', 'sleep', 'popcorn', 'eyes', 'monocle', 'grimace', 'pinch', 'hourglass', 'peek',
      'clap', 'fire', 'muscle', 'rocket', 'encourage',
    ]);
    expect(new Set(REACTION_IDS).size).toBe(REACTION_IDS.length);
    expect(isReactionId('snail')).toBe(true);
    expect(isReactionId('Tu es nul')).toBe(false);
  });

  it('an emoji for each one, except the encouragement, said in words', () => {
    for (const reaction of REACTIONS) expect(!!reaction.emoji).toBe(reaction.kind !== 'encourage');
  });

  it.each([['en', en], ['fr', fr]] as const)('each one has its name in %s, for the screen reader', (_, strings) => {
    const names = (strings.multi as unknown as { reactions: { names: Record<string, string> } }).reactions.names;
    expect(REACTION_IDS.filter(id => !names[id])).toEqual([]);
  });
});
