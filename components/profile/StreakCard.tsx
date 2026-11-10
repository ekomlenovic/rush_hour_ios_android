import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import {
  FREEZE_SLOT_LEVELS, STREAK_BONUS_DAYS, STREAK_BONUS_STEP, STREAK_MAX_MULTIPLIER, getFreezeCapacity, getPlayerLevel, streakMultiplier,
} from '@/data/progression';
import { formatMultiplier } from '@/components/progression/rewards';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import StreakCalendar from './StreakCalendar';

interface Props {
  colors: UiColors;
}

/** Streak of the profile: current and best streak, freeze slots and the calendar */
export default function StreakCard({ colors }: Props) {
  const { t } = useTranslation();
  const currentStreak = useGameStore((state) => state.currentStreak || 0);
  const bestStreak = useGameStore((state) => state.bestStreak || 0);
  const streakFreezes = useGameStore((state) => state.streakFreezes);
  const level = getPlayerLevel(useGameStore((state) => state.xp));
  const capacity = getFreezeCapacity(level);
  // Next player level that adds a slot, if any is left
  const nextSlotLevel = FREEZE_SLOT_LEVELS.find(l => level < l);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header} accessible>
        <View>
          <Text style={[styles.overline, { color: colors.textMuted }]}>{t('profile.streak')}</Text>
          <Text style={[styles.streak, { color: colors.text }]}>
            {currentStreak} <Text style={[styles.streakUnit, { color: colors.textMuted }]}>{t('profile.streak_days', { count: currentStreak })}</Text>
          </Text>
        </View>
        <Text style={[styles.record, { color: colors.textMuted }]}>{t('profile.streak_record', { count: bestStreak })}</Text>
      </View>

      <Text style={[styles.bonus, { color: colors.textMuted }]}>
        {t('profile.streak_bonus', {
          multiplier: formatMultiplier(t, streakMultiplier(currentStreak)),
          percent: Math.round(STREAK_BONUS_STEP * 100),
          days: STREAK_BONUS_DAYS,
          max: STREAK_MAX_MULTIPLIER,
        })}
      </Text>

      <View style={styles.freezes}>
        <Text style={[styles.freezeText, { color: colors.textMuted }]}>
          {t('profile.freeze_slots', { count: streakFreezes, capacity })}
        </Text>
        <View style={styles.slots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: capacity }, (_, i) => (
            <View
              key={i}
              style={[styles.slot, i < streakFreezes
                ? { backgroundColor: colors.frozen }
                : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.frozen }]}
            >
              <Ionicons name="snow" size={RFValue(18)} color={i < streakFreezes ? colors.onLightFill : colors.frozen} />
            </View>
          ))}
        </View>
        {nextSlotLevel !== undefined && (
          <Text style={[styles.nextSlot, { color: colors.textMuted }]}>{t('profile.freeze_next_slot', { level: nextSlotLevel })}</Text>
        )}
      </View>

      <StreakCalendar colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  bonus: {
    fontSize: RFValue(12),
    lineHeight: RFValue(17),
    marginBottom: 12,
  },
  card: {
    borderRadius: RFValue(20),
    borderWidth: 1,
    padding: RFValue(16),
    gap: RFValue(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  overline: {
    fontSize: RFValue(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streak: {
    fontSize: RFValue(36),
    fontWeight: '800',
  },
  streakUnit: {
    fontSize: RFValue(17),
    fontWeight: '600',
  },
  record: {
    fontSize: RFValue(14),
    paddingBottom: RFValue(6),
  },
  freezes: {
    gap: RFValue(8),
  },
  freezeText: {
    fontSize: RFValue(13),
  },
  slots: {
    flexDirection: 'row',
    gap: RFValue(6),
  },
  slot: {
    width: RFValue(46),
    height: RFValue(36),
    borderRadius: RFValue(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSlot: {
    fontSize: RFValue(12),
  },
});
