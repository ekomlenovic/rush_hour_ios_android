// Native modules the store touches: replaced by in-memory or no-op versions
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  performAndroidHapticsAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' },
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Context_Click: 'context-click',
    Virtual_Key: 'virtual-key',
    Long_Press: 'long-press',
  },
}));

// The worklet runtimes (utils/solver.background.ts): the worklets run right away on the test thread
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
