import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { UiColors } from '@/theme';

/** Shown while the puzzle is prepared; the Monday daily warns that it is harder */
export default function GameLoading({ colors, isMondayDaily }: { colors: UiColors; isMondayDaily: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('game.preparing_puzzle')}</Text>
        {isMondayDaily && (
          <Animated.View entering={FadeInDown.delay(1000)}>
            <Text style={[styles.mondayWarning, { color: colors.textMuted }]}>
              {t('game.monday_warning')}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  mondayWarning: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.7,
    fontStyle: 'italic',
  },
});
