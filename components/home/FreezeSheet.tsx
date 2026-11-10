import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FREEZE_SLOT_LEVELS } from '@/data/progression';
import { RFValue } from '@/utils/responsive';
import BottomSheet from './BottomSheet';
import type { UiColors } from '@/theme';

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  /** Streak freezes in stock */
  freezes: number;
  /** Slots of the stock at this player level */
  capacity: number;
  playerLevel: number;
  onClose: () => void;
}

/** What a streak freeze is, how to earn one, and the stock shown as slots */
export default function FreezeSheet({ visible, colors, isDark, freezes, capacity, playerLevel, onClose }: Props) {
  const { t } = useTranslation();
  // Next player level that adds a slot, if any is left
  const nextSlotLevel = FREEZE_SLOT_LEVELS.find(level => playerLevel < level);
  return (
    <BottomSheet visible={visible} title={t('home.freeze_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.text, { color: colors.textMuted }]}>{t('home.freeze_desc', { count: freezes, max: capacity })}</Text>
      <View style={[styles.box, { backgroundColor: colors.card }]} accessible>
        <View style={styles.slots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: capacity }, (_, i) => (
            <View
              key={i}
              style={[styles.slot, i < freezes
                ? { backgroundColor: colors.frozen }
                : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.frozen }]}
            >
              <Ionicons name="snow" size={18} color={i < freezes ? colors.onLightFill : colors.frozen} />
            </View>
          ))}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t('profile.freeze_slots', { count: freezes, capacity })}</Text>
        <Text style={[styles.rule, { color: colors.textMuted }]}>
          {t('home.freeze_bonus')}
          {nextSlotLevel !== undefined && ` ${t('profile.freeze_next_slot', { level: nextSlotLevel })}.`}
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: RFValue(14),
    marginBottom: 12,
  },
  box: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 6,
  },
  slots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  slot: {
    width: 44,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  rule: {
    fontSize: 12,
    lineHeight: 16,
  },
});
