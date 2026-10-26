/** expo-notifications is loaded only where it can run (utils/notifications.ts) */

/** A reminder touched (or another action), as expo-notifications gives it */
const response = (data: Record<string, unknown>, identifier = 'daily-2026-10-20', action = 'expo.modules.notifications.actions.DEFAULT') => ({
  actionIdentifier: action,
  notification: { date: 1, request: { identifier, content: { data } } },
});

const load = (os: 'android' | 'ios', environment: string, lastResponse: ReturnType<typeof response> | null = null) => {
  jest.resetModules();
  const required = jest.fn();
  const calls: string[] = [];
  const listeners: ((r: ReturnType<typeof response>) => void)[] = [];
  jest.doMock('react-native', () => ({ Platform: { OS: os }, AppState: { addEventListener: jest.fn() } }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { executionEnvironment: environment },
    ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
  }));
  jest.doMock('expo-notifications', () => {
    required();
    if (os === 'android' && environment === 'storeClient') throw new Error('removed from Expo Go');
    return {
      setNotificationHandler: jest.fn(),
      setNotificationChannelAsync: jest.fn(async () => { calls.push('channel'); }),
      getPermissionsAsync: jest.fn(async () => { calls.push('getPermissions'); return { granted: true, canAskAgain: true }; }),
      requestPermissionsAsync: jest.fn(),
      AndroidImportance: { DEFAULT: 3 },
      DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
      getLastNotificationResponse: jest.fn(() => lastResponse),
      clearLastNotificationResponse: jest.fn(() => { lastResponse = null; }),
      addNotificationResponseReceivedListener: jest.fn((listener: (r: ReturnType<typeof response>) => void) => {
        listeners.push(listener);
        return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
      }),
    };
  });
  const module = require('../utils/notifications') as typeof import('../utils/notifications');
  return { module, required, calls, listeners };
};

describe('reminders and Expo Go', () => {
  it('Expo Go on Android: expo-notifications is never imported, the app still starts, reminders are off', async () => {
    const { module, required } = load('android', 'storeClient');
    expect(required).not.toHaveBeenCalled();
    expect(await module.requestReminderPermission()).toBe(false);
  });

  it('a real build on Android uses the notifications', async () => {
    const { module, required } = load('android', 'standalone');
    expect(required).toHaveBeenCalled();
    expect(await module.requestReminderPermission()).toBe(true);
  });

  it('Android 13+: the channel exists before the permission is asked', async () => {
    const { module, calls } = load('android', 'standalone');
    await module.requestReminderPermission();
    expect(calls).toEqual(['channel', 'getPermissions']);
  });

  it('Expo Go on iOS still has local notifications', async () => {
    const { required } = load('ios', 'storeClient');
    expect(required).toHaveBeenCalled();
  });
});

describe('touching a reminder (issue 191)', () => {
  it('opens the link of the reminder that launched the app, once', () => {
    const { module, listeners } = load('ios', 'standalone', response({ url: '/game?levelId=daily' }));
    const open = jest.fn();
    const stop = module.listenToReminderTaps(open);
    expect(open).toHaveBeenCalledWith('/game?levelId=daily');
    // The same response also reaching the listener, then the next launch: not opened again
    listeners.forEach(l => l(response({ url: '/game?levelId=daily' })));
    stop();
    module.listenToReminderTaps(open);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens the link of a reminder touched while the app runs', () => {
    const { module, listeners } = load('android', 'standalone');
    const open = jest.fn();
    module.listenToReminderTaps(open);
    expect(open).not.toHaveBeenCalled();
    listeners.forEach(l => l(response({ url: '/recap?period=2026-10' }, 'recap-2026-10')));
    expect(open).toHaveBeenCalledWith('/recap?period=2026-10');
  });

  it('the test reminder, another action or a link outside the app open nothing', () => {
    const { module, listeners } = load('android', 'standalone');
    const open = jest.fn();
    module.listenToReminderTaps(open);
    listeners.forEach(l => l(response({ test: true }, 'test')));
    listeners.forEach(l => l(response({ url: '/game?levelId=daily' }, 'daily-2026-10-21', 'snooze')));
    listeners.forEach(l => l(response({ url: 'https://example.com' }, 'daily-2026-10-22')));
    expect(open).not.toHaveBeenCalled();
  });

  it('Expo Go on Android: no listener, the app still starts', () => {
    const { module, required } = load('android', 'storeClient');
    const open = jest.fn();
    expect(() => module.listenToReminderTaps(open)()).not.toThrow();
    expect(required).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
