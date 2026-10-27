/**
 * Native modules the screens touch, replaced for the component tests: import this file first.
 * Not in jest.setup.ts: the logic tests run the real Reanimated (hintGlow.test.ts) and mock the audio their own way.
 */
// Without a native module, Reanimated cannot register its CSS animations and its mock throws on import:
// nothing to register under Jest. Done here, not in the factory: expo-router/testing-library mocks it again.
const { createJSReanimatedModule } = require('react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated');
Object.getPrototypeOf(createJSReanimatedModule()).setCSSEventHandler = () => {};
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn(async () => {}), useAudioPlayer: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true), getStringAsync: jest.fn(async () => '') }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({ uri: `file:///cache/${name}`, create: jest.fn(), write: jest.fn() })),
}));
// The reminders: never planned in a component test
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
// Gestures: the mocks shipped with react-native-gesture-handler
require('react-native-gesture-handler/jestSetup');
// Icons: their font is not loaded under Jest; an icon is a plain view named after it
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  const Ionicons = ({ name }: { name: string }) => createElement(View, { testID: `icon-${name}` });
  Ionicons.glyphMap = {};
  return { __esModule: true, default: Ionicons };
});
