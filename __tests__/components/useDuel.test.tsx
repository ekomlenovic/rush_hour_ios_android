import { act, renderHook } from '@testing-library/react-native';
import { useDuel } from '@/hooks/useDuel';
import type { ServerAccount } from '@/store/multiStore';

/**
 * A WebSocket as React Native 0.86 runs it on Android: close() while connecting does nothing natively,
 * and the native open later still fires onopen (issue 186)
 */
class AndroidLikeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static list: AndroidLikeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closedByApp = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  constructor(public url: string) { AndroidLikeSocket.list.push(this); }
  send(data: string) { this.sent.push(data); }
  close() {
    if (this.readyState === 0) { this.readyState = 2; return; }
    this.closedByApp = true;
    this.readyState = 3;
  }
  /** The native connection succeeds */
  nativeOpen() { this.readyState = 1; this.onopen?.(); }
}

const account: ServerAccount = {
  url: 'https://rh.example.org', name: 'RH', playerId: 1, pseudo: 'Moi', token: 'tok', recoveryCode: 'code', joinedAt: 0,
};
const realSocket = global.WebSocket;

beforeEach(() => {
  AndroidLikeSocket.list = [];
  (global as any).WebSocket = AndroidLikeSocket;
});
afterEach(() => { (global as any).WebSocket = realSocket; });

describe('a duel screen left while its socket connects (issue 186)', () => {
  it('never authenticates the abandoned socket, which is closed once it opens', async () => {
    const first = await renderHook(() => useDuel(account));
    const [a] = AndroidLikeSocket.list;
    await first.unmount();

    // The screen opened again: its own socket connects and authenticates
    const second = await renderHook(() => useDuel(account));
    const b = AndroidLikeSocket.list[1];
    await act(async () => { b.nativeOpen(); });
    expect(b.sent.map(m => JSON.parse(m).type)).toEqual(['auth']);

    // The first connection succeeds late: no token sent, closed at once
    await act(async () => { a.nativeOpen(); });
    expect(a.sent).toEqual([]);
    expect(a.closedByApp).toBe(true);
    expect(second.result.current.state.error).toBeFalsy();
    await second.unmount();
  });
});
