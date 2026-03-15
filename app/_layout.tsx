import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AudioProvider } from '@/context/AudioProvider';
import * as Linking from 'expo-linking';
import { deserializeLevel } from '@/utils/sharing';
import { useGameStore } from '@/store/gameStore';

const DARK_BG = '#0F0F1A';
const LIGHT_BG = '#F5F5FA';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { addImportedLevel } = useGameStore();

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
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? DARK_BG : LIGHT_BG }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: isDark ? DARK_BG : LIGHT_BG },
            animation: 'slide_from_right',
          }}
        />
      </GestureHandlerRootView>
    </AudioProvider>
  );
}
