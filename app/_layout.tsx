import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioProvider } from '@/context/AudioProvider';
import AchievementToast from '@/components/AchievementToast';
import { listenToReminderTaps, useReminderSync } from '@/utils/notifications';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useAppOpenAlert } from '@/hooks/useAppOpenAlert';
import { useNow } from '@/hooks/useNow';
import { getLocalDateString } from '@/utils/date';
import { useGameStore } from '@/store/gameStore';
import { useMultiStore } from '@/store/multiStore';
import i18n from '@/utils/i18n';
import { useTheme, useAppearanceSync, statusBarStyle } from '@/theme';

/**
 * Records the app open whatever the first screen: the home screen, or a challenge opened
 * by the widget or a reminder without it underneath (issue 188). Its own component: the clock
 * re-renders it each minute, not the whole app.
 */
function AppOpenAlert() {
  useAppOpenAlert(getLocalDateString(useNow()));
  return null;
}

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  useAppearanceSync();
  useReminderSync();
  useWidgetSync();
  // Shared level links (rush-hours://game?data=…) are opened by Expo Router on the game screen (issue 118)
  // A touched reminder opens what it announces, above the screen left open (issue 191)
  useEffect(() => listenToReminderTaps(url => router.push(url)), [router]);

  // The save could not be read: the player must know their progress is not gone
  const gameLoadFailed = useGameStore(state => state.saveLoadFailed);
  const multiLoadFailed = useMultiStore(state => state.loadFailed);
  const saveLoadFailed = gameLoadFailed || multiLoadFailed;
  useEffect(() => {
    if (saveLoadFailed) Alert.alert(i18n.t('save.load_error_title'), i18n.t('save.load_error_body'));
  }, [saveLoadFailed]);

  // The save no longer reaches the device (phone storage full): said once per session, the game goes on (issue 176)
  const gameWriteFailed = useGameStore(state => state.saveWriteFailed);
  const multiWriteFailed = useMultiStore(state => state.writeFailed);
  const saveWriteFailed = gameWriteFailed || multiWriteFailed;
  const writeFailureShown = useRef(false);
  useEffect(() => {
    if (!saveWriteFailed || writeFailureShown.current) return;
    writeFailureShown.current = true;
    Alert.alert(i18n.t('save.write_error_title'), i18n.t('save.write_error_body'));
  }, [saveWriteFailed]);

  return (
    <AudioProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Follows the app theme (forced or system); the recap stacks its own light style on top while shown (issue 205) */}
        <StatusBar style={statusBarStyle(scheme)} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        />
        <AppOpenAlert />
        <AchievementToast />
        {/* Animations follow the system "Reduce motion" setting: the default of Reanimated (#26), except
            a reversed infinite withRepeat, which keeps its starting value: its visible state is set
            with useReducedMotion() (hint highlight, utils/hintGlow.ts, issue 154) */}
      </GestureHandlerRootView>
    </AudioProvider>
  );
}
