import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { GameColors } from './colors';

interface Props {
  colors: GameColors;
  isDark: boolean;
  kind: 'daily' | 'weekly' | null;
  stars: number;
  onShareResult: () => void;
}

/** A challenge already won: the board stays locked until the next one */
export default function ChallengeDoneBanner({ colors, isDark, kind, stars, onShareResult }: Props) {
  const { t } = useTranslation();
  const green = isDark ? '#34D399' : '#059669';
  return (
    <Animated.View
      entering={FadeInDown.delay(350).springify()}
      style={[
        styles.banner,
        {
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(5, 150, 105, 0.08)',
          borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(5, 150, 105, 0.25)',
        }
      ]}
    >
      <Text style={{ fontSize: 24, marginBottom: 4 }}>✅</Text>
      <Text style={{ color: green, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
        {t(kind === 'weekly' ? 'home.weekly_done' : 'home.daily_done', { stars })}
      </Text>
      <Text style={{ color: colors.sub, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
        {t(kind === 'weekly' ? 'game.weekly_already_completed' : 'game.daily_already_completed')}
      </Text>
      <Pressable onPress={onShareResult} style={[styles.bannerShareButton, { borderColor: green }]}>
        <Text style={{ color: green, fontWeight: '700', fontSize: 14 }}>📤 {t('share.share_result')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  bannerShareButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
