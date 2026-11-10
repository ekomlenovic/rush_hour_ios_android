import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { fixedColors, type UiColors } from '@/theme';
import type { IoniconName } from '@/utils/icons';

interface Props {
  colors: UiColors;
  /** Level the search is on, null without a match */
  levelId: number | null;
  /** Rank of that level among the matches, from 1; 0 once it does not match any more */
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  /** Changes the criteria */
  onEdit: () => void;
  /** Back to the whole map */
  onClose: () => void;
}

/** Bar of a search going on, at the bottom of the map: the level it is on, previous / next match, criteria, quit */
export default function FilterBar({ colors, levelId, position, total, onPrevious, onNext, onEdit, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const button = (icon: IoniconName, label: string, onPress: () => void, disabled = false, filled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? colors.primary : colors.neutralSoft, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
    >
      <Ionicons name={icon} size={20} color={filled ? fixedColors.onPrimary : colors.text} />
    </Pressable>
  );

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      exiting={FadeOutDown}
      style={[styles.bar, { bottom: Math.max(20, insets.bottom + 12), backgroundColor: colors.floating, borderColor: colors.primaryBorder }]}
    >
      {button('options', t('a11y.filter_edit'), onEdit)}
      {button('chevron-back', t('a11y.filter_previous'), onPrevious, total === 0, true)}
      <View
        style={styles.middle}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={levelId === null ? t('map.filter_none') : t('a11y.filter_position', { id: levelId, position, total })}
      >
        <Text style={[styles.level, { color: colors.text }]} numberOfLines={1}>
          {levelId === null ? t('map.filter_none') : t('map.jump_to', { id: levelId })}
        </Text>
        {levelId !== null && (
          <Text style={[styles.position, { color: colors.textMuted }]}>{position > 0 ? position : '–'} / {total}</Text>
        )}
      </View>
      {button('chevron-forward', t('a11y.filter_next'), onNext, total === 0, true)}
      {button('close', t('a11y.filter_close'), onClose)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: fixedColors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    zIndex: 150,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    alignItems: 'center',
  },
  level: {
    fontSize: 15,
    fontWeight: '800',
  },
  position: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
