import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { bonusPercent, nextBonusTier } from '@/data/progression';
import { formatBonus } from '@/components/progression/rewards';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  /** Days in a row of this bonus (mission streak or daily streak) */
  days: number;
  /** The streak and its length, shown before what it adds */
  title: string;
  /** Shown instead of the title when there is no streak yet */
  emptyTitle: string;
  /** How the bonus grows and how it is lost */
  rule: string;
}

/** An XP bonus in a sheet of the home screen: the streak, what it adds to the XP, its rule and its next tier */
export default function BonusBox({ colors, days, title, emptyTitle, rule }: Props) {
  const { t } = useTranslation();
  const nextTier = nextBonusTier(days);
  return (
    <View style={[styles.box, { backgroundColor: colors.card }]} accessible>
      <Ionicons name="flame" size={22} color={days > 0 ? colors.warning : colors.textMuted} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>
          {days > 0 ? `${title} · ${t('bonus.xp', { bonus: formatBonus(t, bonusPercent(days)) })}` : emptyTitle}
        </Text>
        <Text style={[styles.rule, { color: colors.textMuted }]}>
          {rule}{' '}
          {nextTier ? t('bonus.next', { count: nextTier.days, bonus: formatBonus(t, nextTier.percent) }) : t('bonus.max')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  icon: {
    marginRight: 12,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  rule: {
    fontSize: 12,
    lineHeight: 16,
  },
});
