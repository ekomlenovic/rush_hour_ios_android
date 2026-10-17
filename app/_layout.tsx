import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioProvider } from '@/context/AudioProvider';
import AchievementToast from '@/components/AchievementToast';
import { useReminderSync } from '@/utils/notifications';
import * as Linking from 'expo-linking';
import { parseSharedLevel } from '@/utils/sharing';
import { useGameStore } from '@/store/gameStore';
import i18n from '@/utils/i18n';
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
        // Checked and solved again: a broken or forged link imports nothing
        const level = parseSharedLevel(parsed.queryParams.data as string);
        if (level) {
          // A link already imported opens the level that is there
          const id = addImportedLevel(level);
          router.push(`/game?levelId=${id}`);
        } else {
          Alert.alert(i18n.t('common.error'), i18n.t('custom_levels.import_error'));
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
