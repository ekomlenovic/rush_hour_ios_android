import { act, renderHook } from '@testing-library/react-native';
import { BACKGROUND_REFRESH_MS, useServerDuels } from '@/hooks/useServerDuels';
import type { MultiApi } from '@/utils/multi/api';

// The screen is always focused here
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => (() => void) | void) => require('react').useEffect(effect, [effect]) }));

/** A server whose answers the test releases one by one */
function slowServer() {
  const pending: (() => void)[] = [];
  const duels = jest.fn(() => new Promise(resolve => pending.push(() => resolve({ duels: [], ready: {}, metrics: ['time'] }))));
  return { api: { duels } as unknown as MultiApi, duels, answer: () => pending.shift()?.() };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('the duels of the server (issue 165)', () => {
  it('are read every 4 s on the Duels tab only, rarely elsewhere', async () => {
    const { api, duels, answer } = slowServer();
    const { rerender } = await renderHook(({ shown }: { shown: boolean }) => useServerDuels(api, shown), { initialProps: { shown: false } });
    await act(async () => {});
    expect(duels).toHaveBeenCalledTimes(1);
    await act(async () => { answer(); });
    await act(async () => { jest.advanceTimersByTime(20_000); });
    expect(duels).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(BACKGROUND_REFRESH_MS - 20_000); });
    expect(duels).toHaveBeenCalledTimes(2);
    await act(async () => { answer(); });

    // Opening the Duels tab reads the list at once, then every 4 s
    await rerender({ shown: true });
    expect(duels).toHaveBeenCalledTimes(3);
    await act(async () => { answer(); });
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(duels).toHaveBeenCalledTimes(4);
  });

  it('never ask again while a read is waiting for its answer', async () => {
    const { api, duels, answer } = slowServer();
    await renderHook(() => useServerDuels(api, true));
    await act(async () => { jest.advanceTimersByTime(12_000); });
    expect(duels).toHaveBeenCalledTimes(1);
    await act(async () => { answer(); });
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(duels).toHaveBeenCalledTimes(2);
  });
});
