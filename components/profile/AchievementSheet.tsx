import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, BackHandler } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AchievementIcon from './AchievementIcon';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS, AchievementContext } from '@/data/achievements';
import { RFValue } from '@/utils/responsive';
import { fixedColors, type UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  context: AchievementContext;
  /** Achievement shown, null when the sheet is closed */
  id: string | null;
  onClose: () => void;
  /** Height taken by the sheet, so the screen can leave room for it */
  onHeight?: (height: number) => void;
}

/**
 * Detail of the achievement touched in the profile, in a sheet at the bottom of the screen.
 * The screen above stays usable: touching another badge shows it here directly.
 */
export default function AchievementSheet({ colors, context, id, onClose, onHeight }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const unlocked = useGameStore((state) => state.achievements || []);
  const ach = id ? ACHIEVEMENTS.find(a => a.id === id) : undefined;

  useEffect(() => {
    if (!ach) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [!!ach, onClose]);

  useEffect(() => {
    if (!ach) onHeight?.(0);
  }, [!!ach]);

  if (!ach) return null;

  const isUnlocked = unlocked.includes(ach.id);
  const isSecret = !!ach.hidden && !isUnlocked;
  const name = isSecret ? '???' : t(`achievements.${ach.id}`);
  const desc = isSecret ? t('achievements.secret_desc') : t(`achievements.${ach.id}_desc`);
  const current = Math.min(ach.value(context), ach.target);
  const showBar = !isUnlocked && !isSecret && ach.target > 1;

  return (
    <Animated.View
      entering={SlideInDown.duration(260)}
      exiting={SlideOutDown.duration(200)}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
      style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(RFValue(20), insets.bottom + RFValue(12)) }]}
    >
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      <View style={styles.header}>
        <Text style={[styles.overline, { color: colors.textMuted }]}>{t(`achievements.categories.${ach.category}`)}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8} style={[styles.close, { backgroundColor: colors.card }]}>
          <Ionicons name="close" size={RFValue(18)} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.body} accessible accessibilityLiveRegion="polite"
        accessibilityLabel={t(isUnlocked ? 'profile.achievement_a11y_unlocked' : 'profile.achievement_a11y_locked', { name, desc })}>
        <View style={[
          styles.badge,
          isUnlocked
            ? { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }
            : { backgroundColor: colors.card, borderColor: colors.border },
        ]}>
          <AchievementIcon icon={isSecret ? 'lock-closed' : ach.icon} count={isSecret ? 1 : ach.iconCount} size={RFValue(30)} color={isUnlocked ? colors.primaryText : colors.textMuted} style={!isUnlocked && styles.locked} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.status, { color: isUnlocked ? colors.primaryText : colors.textMuted }]}>
            {t(isUnlocked ? 'profile.achievement_unlocked' : 'profile.achievement_locked')}
          </Text>
        </View>
      </View>

      <Text style={[styles.desc, { color: colors.text }]}>{desc}</Text>

      {showBar && (
        <View style={styles.progress}>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { width: `${Math.max(3, (current / ach.target) * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.count, { color: colors.textMuted }]}>{current}/{ach.target}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: RFValue(20),
    paddingTop: RFValue(8),
    gap: RFValue(12),
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overline: {
    fontSize: RFValue(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  close: {
    width: RFValue(30),
    height: RFValue(30),
    borderRadius: RFValue(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(14),
  },
  badge: {
    width: RFValue(64),
    height: RFValue(64),
    borderRadius: RFValue(32),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    opacity: 0.35,
  },
  text: {
    flex: 1,
    gap: RFValue(2),
  },
  name: {
    fontSize: RFValue(19),
    fontWeight: '800',
  },
  status: {
    fontSize: RFValue(13),
    fontWeight: '600',
  },
  desc: {
    fontSize: RFValue(15),
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
  },
  track: {
    flex: 1,
    height: RFValue(8),
    borderRadius: RFValue(4),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: RFValue(4),
  },
  count: {
    fontSize: RFValue(13),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
