import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioProvider } from '@/context/AudioProvider';
import AchievementToast from '@/components/AchievementToast';
import { useReminderSync } from '@/utils/notifications';
import { useGameStore } from '@/store/gameStore';
import { useMultiStore } from '@/store/multiStore';
import i18n from '@/utils/i18n';
import { useTheme, useAppearanceSync } from '@/theme';

export default function RootLayout() {
  const { colors } = useTheme();
  useAppearanceSync();
  useReminderSync();
  // Shared level links (rush-hours://game?data=…) are opened by Expo Router on the game screen (issue 118)

  // The save could not be read: the player must know their progress is not gone
  const gameLoadFailed = useGameStore(state => state.saveLoadFailed);
  const multiLoadFailed = useMultiStore(state => state.loadFailed);
  const saveLoadFailed = gameLoadFailed || multiLoadFailed;
  useEffect(() => {
    if (saveLoadFailed) Alert.alert(i18n.t('save.load_error_title'), i18n.t('save.load_error_body'));
  }, [saveLoadFailed]);

  return (
    <AudioProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
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
