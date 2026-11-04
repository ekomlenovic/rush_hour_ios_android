import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useDuel } from '@/hooks/useDuel';
import type { ServerAccount } from '@/store/multiStore';

/** The connection policy of the duels (issue 203), with a socket the test opens and closes */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static list: FakeSocket[] = [];
  readyState = 0;
  sent: { type: string; [key: string]: unknown }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  constructor(public url: string) { FakeSocket.list.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(message: object) { this.onmessage?.({ data: JSON.stringify(message) }); }
  drop(code: number, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
}

const mockInfo = jest.fn();
jest.mock('@/utils/multi/api', () => ({ ...jest.requireActual('@/utils/multi/api'), multiApi: () => ({ info: mockInfo }) }));

const account: ServerAccount = {
  url: 'https://rh.example.org', name: 'RH', playerId: 1, pseudo: 'Moi', token: 'tok', recoveryCode: 'code', joinedAt: 0,
};
const realSocket = global.WebSocket;
const last = () => FakeSocket.list[FakeSocket.list.length - 1];

beforeEach(() => {
  jest.useFakeTimers();
  FakeSocket.list = [];
  mockInfo.mockReset();
  (global as any).WebSocket = FakeSocket;
});
afterEach(() => {
  (global as any).WebSocket = realSocket;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the duel connection (issue 203)', () => {
  it('authenticates once open', async () => {
    await renderHook(() => useDuel(account));
    await act(async () => { last().open(); });
    expect(last().sent).toEqual([expect.objectContaining({ type: 'auth', token: 'tok' })]);
  });

  it('tries again after 1 s, then 2 s, when the connection drops', async () => {
    const hook = await renderHook(() => useDuel(account));
    await act(async () => { last().open(); });
    await act(async () => { last().drop(1006); });
    expect(hook.result.current.state.connection).toBe('offline');
    await act(async () => { jest.advanceTimersByTime(999); });
    expect(FakeSocket.list).toHaveLength(1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(FakeSocket.list).toHaveLength(2);

    await act(async () => { last().drop(1006); });
    await act(async () => { jest.advanceTimersByTime(1999); });
    expect(FakeSocket.list).toHaveLength(2);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(FakeSocket.list).toHaveLength(3);
  });

  it('stops trying when the server refuses (codes 4000 to 4999)', async () => {
    const hook = await renderHook(() => useDuel(account));
    await act(async () => { last().open(); });
    await act(async () => { last().drop(4000, 'replaced'); });
    expect(hook.result.current.state.error).toBe('duel_replaced');
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(FakeSocket.list).toHaveLength(1);
  });

  it('never reached: asks /info whether the server is too old or the WebSocket is blocked', async () => {
    mockInfo.mockResolvedValueOnce({ name: 'RH', apiVersion: 1, minAppVersion: '0', features: [] });
    const old = await renderHook(() => useDuel(account));
    await act(async () => { last().drop(1006); });
    expect(old.result.current.unreachable).toBe('update_server');
    await old.unmount();

    mockInfo.mockResolvedValueOnce({ name: 'RH', apiVersion: 1, minAppVersion: '0', features: ['duel'] });
    const blocked = await renderHook(() => useDuel(account));
    await act(async () => { last().drop(1006); });
    expect(blocked.result.current.unreachable).toBe('duel_unreachable');
  });

  it('watches the duel again after a reconnection while watching', async () => {
    const level = {
      id: 999996, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 0, updatedAt: 0,
      vehicles: [{ id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: '#E53935' }],
    };
    const watched = {
      code: 'ABCD3', difficulty: 'NORMAL', private: false, status: 'playing', level, startsAt: 0, serverNow: 0, spectating: true,
      me: { id: 3, pseudo: 'Léo', connected: true, moves: [], wantsRematch: false },
      opponent: { id: 2, pseudo: 'Emma', connected: true, moves: [], wantsRematch: false },
      result: null,
    };
    const hook = await renderHook(() => useDuel(account));
    await act(async () => { last().open(); });
    await act(async () => { last().receive({ type: 'ready', player: { id: 1, pseudo: 'Moi' }, duel: null }); });
    await act(async () => { last().receive({ type: 'duel', duel: watched }); });
    expect(hook.result.current.state.duel?.spectating).toBe(true);

    await act(async () => { last().drop(1006); });
    await act(async () => { jest.advanceTimersByTime(1000); });
    await act(async () => { last().open(); });
    await act(async () => { last().receive({ type: 'ready', player: { id: 1, pseudo: 'Moi' }, duel: null }); });
    expect(last().sent).toEqual([expect.objectContaining({ type: 'auth' }), { type: 'watch', code: 'ABCD3' }]);
  });

  it('opens again when the app comes back to the foreground with the socket closed', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: jest.fn() } as any;
    });
    await renderHook(() => useDuel(account));
    await act(async () => { last().open(); });
    await act(async () => { last().drop(4001, 'banned'); });
    expect(FakeSocket.list).toHaveLength(1);
    await act(async () => { listeners.forEach(l => l('active')); });
    expect(FakeSocket.list).toHaveLength(2);
  });
});
