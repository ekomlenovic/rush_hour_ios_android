import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from '@/utils/responsive';
import BottomSheet from './BottomSheet';
import BonusBox from './BonusBox';
import type { UiColors } from '@/theme';

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  /** Streak of the daily challenge */
  streak: number;
  /** Opens the XP bonuses of the profile */
  onSeeBonuses: () => void;
  onClose: () => void;
}

/** What the streak is, and the XP bonus it gives */
export default function StreakSheet({ visible, colors, isDark, streak, onSeeBonuses, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} title={t('home.streak_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {streak > 0 ? t('home.streak_desc', { count: streak }) : t('home.streak_start')}
      </Text>
      <BonusBox
        colors={colors}
        days={streak}
        title={t('home.streak_days', { count: streak })}
        emptyTitle={t('home.streak_none')}
        rule={t('home.streak_rule')}
      />
      <Pressable onPress={onSeeBonuses} style={styles.link} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('home.streak_see_bonuses')}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: RFValue(14),
    marginBottom: 12,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
});
