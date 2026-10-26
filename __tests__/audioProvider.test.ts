import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { AudioProvider } from '../context/AudioProvider';

// A player that counts every access to its native properties (on Android each getter blocks
// the JS thread on the main thread) and lets the test send its status events
const mockCalls: Record<string, number> = {};
const mockBump = (k: string) => { mockCalls[k] = (mockCalls[k] || 0) + 1; };
let mockPlayer: any;
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => {
    if (mockPlayer) return mockPlayer;
    const listeners = new Set<(status: any) => void>();
    const p: any = {
      loop: false, _v: 0, _playing: false, _time: 0,
      play: () => { mockBump('play()'); p._playing = true; },
      pause: () => { mockBump('pause()'); p._playing = false; },
      addListener: (_: string, l: (status: any) => void) => {
        listeners.add(l);
        return { remove: () => listeners.delete(l) };
      },
      emit: (status: any) => listeners.forEach(l => l(status)),
    };
    for (const k of ['duration', 'currentTime'])
      Object.defineProperty(p, k, { get: () => { mockBump(`get ${k}`); return k === 'duration' ? 120 : p._time; } });
    Object.defineProperty(p, 'playing', { get: () => { mockBump('get playing'); return p._playing; } });
    Object.defineProperty(p, 'volume', {
      get: () => { mockBump('get volume'); return p._v; },
      set: (v: number) => { mockBump('set volume'); p._v = v; },
    });
    mockPlayer = p;
    return p;
  },
}));

const reset = () => { for (const k of Object.keys(mockCalls)) delete mockCalls[k]; };
const total = () => Object.values(mockCalls).reduce((a, b) => a + b, 0);
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
// The status the native player sends while playing, every updateInterval
const status = (currentTime: number, playing = mockPlayer._playing) =>
  act(() => { mockPlayer.emit({ currentTime, duration: 120, playing }); });

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  mockPlayer = undefined;
  reset();
  (AppState as any).currentState = 'active';
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function mount(musicEnabled: boolean) {
  act(() => { useGameStore.setState({ isMusicEnabled: musicEnabled }); });
  act(() => { renderer = create(React.createElement(AudioProvider, null, null)); });
}

describe('AudioProvider', () => {
  it('never touches the player nor keeps a timer when the music is off', () => {
    mount(false);
    advance(1000);
    reset();
    advance(3000);
    expect(total()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts the music with its fade in when enabled', () => {
    mount(true);
    expect(mockCalls['play()']).toBe(1);
    // The track starts: the volume follows the 3 s fade in up to 0.4
    status(0, true);
    advance(1500);
    status(1.5);
    expect(mockPlayer._v).toBeGreaterThan(0.1);
    expect(mockPlayer._v).toBeLessThan(0.3);
    advance(1500);
    status(3);
    advance(500);
    expect(mockPlayer._v).toBeCloseTo(0.4);
  });

  it('reads no native property and stays quiet between the fades', () => {
    mount(true);
    status(0, true);
    for (let t = 1; t <= 10; t++) { advance(1000); status(t); }
    reset();
    for (let t = 11; t <= 20; t++) { advance(1000); status(t); }
    // Not a single getter, no volume write: the volume is already at its goal
    expect(total()).toBe(0);
    expect(mockPlayer._v).toBeCloseTo(0.4);
    // One timeout, up to the end-of-track fade
    expect(jest.getTimerCount()).toBe(1);
  });

  it('fades out at the end of the track and back in after the loop', () => {
    mount(true);
    status(110, true);
    advance(1500);
    expect(mockPlayer._v).toBeCloseTo(0.4);
    advance(117_500 - 111_500); // 117.5 s: 2.5 s before the end
    expect(mockPlayer._v).toBeCloseTo(0.4 * 2.5 / 3, 1);
    advance(2400); // 119.9 s
    expect(mockPlayer._v).toBeLessThan(0.05);
    status(0.5); // looped
    advance(1000); // 1.5 s
    expect(mockPlayer._v).toBeCloseTo(0.2, 1);
    expect(mockCalls['pause()']).toBeUndefined();
  });

  it('fades out then pauses when the music is turned off, then goes silent', () => {
    mount(true);
    status(10, true);
    advance(2000);
    act(() => { useGameStore.setState({ isMusicEnabled: false }); });
    advance(2000);
    expect(mockPlayer._v).toBe(0);
    expect(mockCalls['pause()']).toBe(1);
    reset();
    advance(3000);
    expect(total()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);

    // Back on: plays again and the volume rises
    act(() => { useGameStore.setState({ isMusicEnabled: true }); });
    expect(mockCalls['play()']).toBe(1);
    status(14, true);
    advance(1000);
    expect(mockPlayer._v).toBeCloseTo(0.4);
  });

  it('pauses in the background and resumes when back to the foreground', () => {
    let onChange: (state: string) => void = () => { };
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, cb: any) => {
      onChange = cb;
      return { remove: () => { } } as any;
    });
    mount(true);
    status(10, true);
    advance(2000);
    act(() => onChange('background'));
    expect(mockCalls['pause()']).toBe(1);
    reset();
    advance(3000);
    expect(total()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    act(() => onChange('active'));
    expect(mockCalls['play()']).toBe(1);
  });
});
