import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { UiColors } from '@/theme';
import ShareIcon from '@/components/share/ShareIcon';

interface Props {
  colors: UiColors;
  kind: 'daily' | 'weekly' | null;
  stars: number;
  onShareResult: () => void;
  /** The solution can be seen once the challenge is won (see docs/GAME_DESIGN.md) */
  onShowSolution: () => void;
}

/** A challenge already won: the board stays locked until the next one */
export default function ChallengeDoneBanner({ colors, kind, stars, onShareResult, onShowSolution }: Props) {
  const { t } = useTranslation();
  const green = colors.success;
  return (
    <Animated.View
      entering={FadeInDown.delay(350).springify()}
      style={[
        styles.banner,
        {
          backgroundColor: colors.successSoft,
          borderColor: colors.successBorder,
        }
      ]}
    >
      <Ionicons name="checkmark-circle" size={28} color={green} style={{ marginBottom: 4 }} />
      <Text style={{ color: green, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
        {t(kind === 'weekly' ? 'home.weekly_done' : 'home.daily_done')}
      </Text>
      <View style={styles.stars} accessible accessibilityLabel={t('a11y.level_stars', { count: stars })}>
        {[1, 2, 3].map(i => (
          <Ionicons key={i} name={i <= stars ? 'star' : 'star-outline'} size={18} color={i <= stars ? colors.star : colors.border} />
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
        {t(kind === 'weekly' ? 'game.weekly_already_completed' : 'game.daily_already_completed')}
      </Text>
      <View style={styles.bannerButtons}>
        <Pressable onPress={onShowSolution} style={[styles.bannerShareButton, { borderColor: green }]} accessibilityRole="button">
          <Ionicons name="play-circle-outline" size={16} color={green} />
          <Text style={{ color: green, fontWeight: '700', fontSize: 14 }}>{t('solution.show')}</Text>
        </Pressable>
        <Pressable onPress={onShareResult} style={[styles.bannerShareButton, { borderColor: green }]} accessibilityRole="button">
          <ShareIcon size={16} color={green} />
          <Text style={{ color: green, fontWeight: '700', fontSize: 14 }}>{t('share.share_result')}</Text>
        </Pressable>
      </View>
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
  stars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  bannerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  bannerShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
