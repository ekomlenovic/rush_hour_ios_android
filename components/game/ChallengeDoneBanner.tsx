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
  /** Moves of the player's best result and the optimum, when recorded */
  moves?: number;
  minMoves: number;
  onShareResult: () => void;
  /** The player's own solution, when its moves were recorded */
  onShowMine?: () => void;
  /** The solution can be seen once the challenge is won (see docs/GAME_DESIGN.md) */
  onShowSolution: () => void;
}

/** A challenge already won: the board stays locked until the next one */
export default function ChallengeDoneBanner({ colors, kind, stars, moves, minMoves, onShareResult, onShowMine, onShowSolution }: Props) {
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
      <View style={styles.titleRow}>
        <Ionicons name="checkmark-circle" size={22} color={green} />
        <Text style={[styles.title, { color: green }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t(kind === 'weekly' ? 'game.weekly_done' : 'game.daily_done')}
        </Text>
        <View style={styles.stars} accessible accessibilityLabel={t('a11y.level_stars', { count: stars })}>
          {[1, 2, 3].map(i => (
            <Ionicons key={i} name={i <= stars ? 'star' : 'star-outline'} size={16} color={i <= stars ? colors.star : colors.textMuted} />
          ))}
        </View>
      </View>
      {moves !== undefined && (
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, textAlign: 'center', marginTop: 6 }}>
          {t('game.challenge_moves', { moves, best: minMoves })}
        </Text>
      )}
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
        {t(kind === 'weekly' ? 'game.weekly_already_completed' : 'game.daily_already_completed')}
      </Text>
      {/* One row of short buttons: three full-width labels pushed the banner off the screen */}
      <View style={styles.bannerButtons}>
        {onShowMine && (
          <Pressable onPress={onShowMine} style={[styles.bannerButton, { borderColor: green }]} accessibilityRole="button" accessibilityLabel={t('solution.show_mine')}>
            <Ionicons name="person" size={18} color={green} />
            <Text style={[styles.buttonText, { color: green }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('solution.mine_short')}</Text>
          </Pressable>
        )}
        <Pressable onPress={onShowSolution} style={[styles.bannerButton, { borderColor: green }]} accessibilityRole="button" accessibilityLabel={t('solution.show')}>
          <Ionicons name="trophy" size={18} color={green} />
          <Text style={[styles.buttonText, { color: green }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('solution.optimal_short')}</Text>
        </Pressable>
        <Pressable onPress={onShareResult} style={[styles.bannerButton, { borderColor: green }]} accessibilityRole="button" accessibilityLabel={t('share.share_result')}>
          <ShareIcon size={18} color={green} />
          <Text style={[styles.buttonText, { color: green }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('share.share_short')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontWeight: '800',
    fontSize: 16,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  bannerButtons: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 10,
  },
  bannerButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
