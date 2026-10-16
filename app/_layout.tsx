import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioProvider } from '@/context/AudioProvider';
import AchievementToast from '@/components/AchievementToast';
import { useReminderSync } from '@/utils/notifications';
import * as Linking from 'expo-linking';
import { deserializeLevel } from '@/utils/sharing';
import { useGameStore } from '@/store/gameStore';
import '@/utils/i18n';
import { useTheme, useAppearanceSync } from '@/theme';

export default function RootLayout() {
  const { colors } = useTheme();
  useAppearanceSync();
  const router = useRouter();
  const { addImportedLevel } = useGameStore();
  useReminderSync();

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      // We look for rush-hours://game?data=...
      if (parsed.queryParams?.data) {
        const level = deserializeLevel(parsed.queryParams.data as string, Date.now());
        if (level) {
          addImportedLevel(level);
          router.push(`/game?levelId=${level.id}`);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

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
