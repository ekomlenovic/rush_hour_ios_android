import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { currentXpBonus } from '@/data/missions';
import { BONUS_MILESTONE_DAYS, XP_BONUS_TIERS, nextBonusTier } from '@/data/progression';
import { formatBonus } from '@/components/progression/rewards';
import { getLocalDateString } from '@/utils/date';
import { RFValue } from '@/utils/responsive';
import type { IoniconName } from '@/utils/icons';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
}

interface RowProps extends Props {
  icon: IoniconName;
  title: string;
  hint: string;
  days: number;
  percent: number;
}

const MILESTONES = XP_BONUS_TIERS.filter(tier => BONUS_MILESTONE_DAYS.includes(tier.days));

/** One bonus: its days in a row, what it adds, its milestones and the next tier to reach */
function BonusRow({ colors, icon, title, hint, days, percent }: RowProps) {
  const { t } = useTranslation();
  const next = nextBonusTier(days);
  const nextText = next ? t('bonus.next', { count: next.days, bonus: formatBonus(t, next.percent) }) : t('bonus.max');
  const status = `${t('bonus.days', { count: days })} · ${t('bonus.xp', { bonus: formatBonus(t, percent) })}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}, ${status}. ${hint} ${nextText}`}>
      <View style={styles.rowHeader}>
        <Ionicons name={icon} size={RFValue(22)} color={percent > 0 ? colors.warning : colors.textMuted} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: percent > 0 ? colors.primaryText : colors.textMuted }]}>{status}</Text>
        </View>
      </View>
      <View style={styles.milestones}>
        {MILESTONES.map((tier) => {
          const reached = days >= tier.days;
          return (
            <View
              key={tier.days}
              style={[styles.milestone, reached ? { backgroundColor: colors.primary } : { borderWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.milestoneValue, { color: reached ? colors.onPrimary : colors.text }]}>{formatBonus(t, tier.percent)}</Text>
              <Text style={[styles.milestoneDays, { color: reached ? colors.onPrimary : colors.textMuted }]}>{t('bonus.milestone', { count: tier.days })}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.next, { color: colors.textMuted }]}>{hint} {nextText}</Text>
    </View>
  );
}

/** XP bonuses of the profile: what the mission streak and the daily streak add to all the XP earned */
export default function XpBonusCard({ colors }: Props) {
  const { t } = useTranslation();
  const currentStreak = useGameStore((state) => state.currentStreak || 0);
  const missionStreak = useGameStore((state) => state.missionStreak);
  const bonus = currentXpBonus({ missionStreak, currentStreak }, getLocalDateString(new Date()));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header} accessible>
        <Text style={[styles.overline, { color: colors.textMuted }]} accessibilityRole="header">{t('bonus.title')}</Text>
        <Text style={[styles.total, { color: colors.text }]}>
          {bonus.total > 0 ? t('bonus.total', { bonus: formatBonus(t, bonus.total) }) : t('bonus.none')}
        </Text>
      </View>
      <BonusRow
        colors={colors}
        icon="flag"
        title={t('bonus.missions_title')}
        hint={t('bonus.missions_hint')}
        days={bonus.missionDays}
        percent={bonus.missions}
      />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
      <BonusRow
        colors={colors}
        icon="flame"
        title={t('bonus.streak_title')}
        hint={t('bonus.streak_hint')}
        days={currentStreak}
        percent={bonus.streak}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RFValue(20),
    borderWidth: 1,
    padding: RFValue(16),
    gap: RFValue(14),
  },
  header: {
    gap: RFValue(4),
  },
  overline: {
    fontSize: RFValue(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  total: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    gap: RFValue(10),
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  rowSub: {
    fontSize: RFValue(13),
    fontWeight: '600',
  },
  milestones: {
    flexDirection: 'row',
    gap: RFValue(6),
  },
  milestone: {
    flex: 1,
    borderRadius: RFValue(10),
    paddingVertical: RFValue(6),
    alignItems: 'center',
  },
  milestoneValue: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  milestoneDays: {
    fontSize: RFValue(11),
  },
  next: {
    fontSize: RFValue(12),
    lineHeight: RFValue(17),
  },
});
