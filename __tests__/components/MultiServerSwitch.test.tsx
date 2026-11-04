import './setup';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import MultiplayerScreen from '@/app/multi/index';
import { useMultiStore, type ServerAccount } from '@/store/multiStore';
import '@/utils/i18n';

/** Answers of each server to /info and /challenge/today, released by the test; nothing else ever answers */
const mockPending: Record<string, { info: (name: string) => void; today: (date: string) => void }> = {};
jest.mock('@/utils/multi/api', () => {
  const actual = jest.requireActual('@/utils/multi/api');
  const never = () => new Promise(() => {});
  return {
    ...actual,
    multiApi: (url: string) => {
      const api: Record<string, unknown> = new Proxy({}, { get: (_, key) => (key === 'admin' ? {} : never) });
      return new Proxy(api, {
        get: (target, key) => {
          if (key === 'info') return () => new Promise(resolve => {
            mockPending[url] = { ...mockPending[url], info: name => resolve({ name, apiVersion: actual.API_VERSION, minAppVersion: '0' }) };
          });
          if (key === 'today') return () => new Promise(resolve => {
            mockPending[url] = {
              ...mockPending[url],
              today: date => resolve({ date, number: 3, status: 'preparing', releasedAt: 0, closesAt: Date.now() + 3_600_000, serverNow: Date.now(), me: null, pending: null, results: [] }),
            };
          });
          return (target as Record<string | symbol, unknown>)[key];
        },
      });
    },
  };
});

const account = (url: string, name: string, playerId: number): ServerAccount =>
  ({ url, name, playerId, pseudo: 'Léa', token: `t${playerId}`, recoveryCode: 'code', joinedAt: 0 });
const A = 'https://a.example';
const B = 'https://b.example';

describe('switching servers while the screen loads (issue 187)', () => {
  beforeEach(() => {
    useMultiStore.setState({ accounts: [account(A, 'Alpha', 1), account(B, 'Bravo', 2)], activeUrl: A, introSeen: true });
  });

  it('never renames the new server after the former one', async () => {
    await renderRouter({ 'multi/index': MultiplayerScreen }, { initialUrl: '/multi' });
    await waitFor(() => expect(mockPending[A]?.today).toBeTruthy());

    await act(async () => { useMultiStore.getState().setActive(B); });
    await waitFor(() => expect(mockPending[B]?.today).toBeTruthy());
    await act(async () => { mockPending[B].info('Bravo'); mockPending[B].today('2026-11-04'); });

    // The former server answers late, renamed meanwhile by its admin
    await act(async () => { mockPending[A].info('Alpha renommé'); mockPending[A].today('2026-11-03'); });
    const names = Object.fromEntries(useMultiStore.getState().accounts.map(a => [a.url, a.name]));
    expect(names).toEqual({ [A]: 'Alpha renommé', [B]: 'Bravo' });
    expect(screen.queryByText(/Alpha/)).toBeNull();
  });
});
