import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioProvider } from '@/context/AudioProvider';
import AchievementToast from '@/components/AchievementToast';
import { useReminderSync } from '@/utils/notifications';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useGameStore } from '@/store/gameStore';
import { useMultiStore } from '@/store/multiStore';
import i18n from '@/utils/i18n';
import { useTheme, useAppearanceSync, statusBarStyle } from '@/theme';

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  useAppearanceSync();
  useReminderSync();
  useWidgetSync();
  // Shared level links (rush-hours://game?data=…) are opened by Expo Router on the game screen (issue 118)

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
        <AchievementToast />
        {/* Animations follow the system "Reduce motion" setting: the default of Reanimated (#26) */}
      </GestureHandlerRootView>
    </AudioProvider>
  );
}
