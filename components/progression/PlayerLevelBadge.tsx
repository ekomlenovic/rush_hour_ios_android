import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { getLevelInfo, getPlayerTitle } from '@/data/progression';
import { currentXpBonus } from '@/data/missions';
import { getLocalDateString } from '@/utils/date';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import { formatBonus } from './rewards';
import XpBar from './XpBar';

interface Props {
  colors: UiColors;
  onPress: () => void;
  /** Touching the XP bonus (shown when there is one) */
  onBonusPress: () => void;
}

/** Player level, title, XP bonus and XP bar of the home screen */
export default function PlayerLevelBadge({ colors, onPress, onBonusPress }: Props) {
  const { t } = useTranslation();
  const xp = useGameStore(s => s.xp);
  const currentStreak = useGameStore(s => s.currentStreak);
  const missionStreak = useGameStore(s => s.missionStreak);
  const info = getLevelInfo(xp);
  const title = t(`progression.titles.${getPlayerTitle(info.level)}`);
  // Both XP bonuses added up: in the badge only when there is one, it takes no room of its own
  const bonus = currentXpBonus({ missionStreak, currentStreak }, getLocalDateString(new Date())).total;

  return (
    <View style={[styles.badge, bonus > 0 && styles.badgeWithBonus, { backgroundColor: colors.card }]}>
      {/* The whole badge opens the profile; the bonus, above it, has its own target */}
      <Pressable
        onPress={onPress}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={t('progression.a11y_badge', { level: info.level, title, xp: info.xpInLevel, next: info.xpForNext })}
      />
      <View style={styles.row} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={[styles.level, { color: colors.primaryText }]}>{t('progression.level_short', { level: info.level })}</Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.xp, { color: colors.textMuted }]}>
          {t('progression.xp_progress', { xp: info.xpInLevel, next: info.xpForNext })}
        </Text>
      </View>
      {/* The bonus sits at the end of the XP bar: the badge is as tall with it as without */}
      <View style={styles.barRow} pointerEvents="box-none">
        <View style={styles.bar} pointerEvents="none">
          <XpBar colors={colors} ratio={info.ratio} height={6} />
        </View>
        {bonus > 0 && (
          <Pressable
            onPress={onBonusPress}
            style={[styles.bonus, { backgroundColor: colors.surface }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('bonus.a11y_pill', { bonus: formatBonus(t, bonus) })}
          >
            <Ionicons name="flame" size={11} color={colors.warning} />
            <Text style={[styles.bonusText, { color: colors.text }]} allowFontScaling={false}>{formatBonus(t, bonus)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    gap: 8,
  },
  // The bonus is taller than the bar: the padding and the gap make up for it
  badgeWithBonus: { paddingVertical: 8, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  level: { fontSize: RFValue(15), fontWeight: '800' },
  title: { flex: 1, fontSize: RFValue(14), fontWeight: '600' },
  xp: { fontSize: RFValue(12), fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flex: 1 },
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 19,
    paddingHorizontal: 7,
    borderRadius: 999,
  },
  bonusText: { fontSize: 12, fontWeight: '700' },
});
