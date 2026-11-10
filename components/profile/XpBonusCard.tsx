import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { activeMissionStreak } from '@/data/missions';
import {
  BONUS_MILESTONE_DAYS, BonusTier, DAILY_STREAK_TIERS, MISSION_STREAK_TIERS, bonusMultiplier, nextBonusTier,
} from '@/data/progression';
import { formatMultiplier } from '@/components/progression/rewards';
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
  subtitle: string;
  days: number;
  tiers: BonusTier[];
}

/** One bonus: its days in a row, its multiplier, its milestones and the next one to reach */
function BonusRow({ colors, icon, title, subtitle, days, tiers }: RowProps) {
  const { t } = useTranslation();
  const multiplier = formatMultiplier(t, bonusMultiplier(tiers, days));
  const next = nextBonusTier(tiers, days);
  const nextText = next ? t('bonus.next', { count: next.days, multiplier: formatMultiplier(t, next.multiplier) }) : t('bonus.max');
  const milestones = tiers.filter(tier => BONUS_MILESTONE_DAYS.includes(tier.days));
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${title}, ${t('bonus.days', { count: days })}, ${subtitle} ×${multiplier}. ${nextText}`}
    >
      <View style={styles.rowHeader}>
        <Ionicons name={icon} size={RFValue(22)} color={days > 0 ? colors.warning : colors.textMuted} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: colors.textMuted }]}>{t('bonus.days', { count: days })} · {subtitle}</Text>
        </View>
        <Text style={[styles.multiplier, { color: days > 0 ? colors.primaryText : colors.textMuted }]}>×{multiplier}</Text>
      </View>
      <View style={styles.milestones}>
        {milestones.map((tier) => {
          const reached = days >= tier.days;
          return (
            <View
              key={tier.days}
              style={[styles.milestone, reached ? { backgroundColor: colors.primary } : { borderWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.milestoneValue, { color: reached ? colors.onPrimary : colors.text }]}>×{formatMultiplier(t, tier.multiplier)}</Text>
              <Text style={[styles.milestoneDays, { color: reached ? colors.onPrimary : colors.textMuted }]}>{t('bonus.milestone', { count: tier.days })}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.next, { color: colors.textMuted }]}>{nextText}</Text>
    </View>
  );
}

/** XP bonuses of the profile: what the mission streak and the daily streak multiply, and their next milestones */
export default function XpBonusCard({ colors }: Props) {
  const { t } = useTranslation();
  const currentStreak = useGameStore((state) => state.currentStreak || 0);
  const missionStreak = useGameStore((state) => state.missionStreak);
  const missionDays = activeMissionStreak(missionStreak, getLocalDateString(new Date()));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.overline, { color: colors.textMuted }]} accessibilityRole="header">{t('bonus.title')}</Text>
      <BonusRow
        colors={colors}
        icon="flag"
        title={t('bonus.missions_title')}
        subtitle={t('bonus.missions_sub')}
        days={missionDays}
        tiers={MISSION_STREAK_TIERS}
      />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
      <BonusRow
        colors={colors}
        icon="flame"
        title={t('bonus.streak_title')}
        subtitle={t('bonus.streak_sub')}
        days={currentStreak}
        tiers={DAILY_STREAK_TIERS}
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
  overline: {
    fontSize: RFValue(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: RFValue(12),
  },
  multiplier: {
    fontSize: RFValue(26),
    fontWeight: '800',
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
  },
});
