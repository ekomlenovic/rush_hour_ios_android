/** expo-notifications is loaded only where it can run (utils/notifications.ts) */

const load = (os: 'android' | 'ios', environment: string) => {
  jest.resetModules();
  const required = jest.fn();
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
      getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
      requestPermissionsAsync: jest.fn(),
    };
  });
  const module = require('../utils/notifications') as typeof import('../utils/notifications');
  return { module, required };
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

  it('Expo Go on iOS still has local notifications', async () => {
    const { required } = load('ios', 'storeClient');
    expect(required).toHaveBeenCalled();
  });
});
