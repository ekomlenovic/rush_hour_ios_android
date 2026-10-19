import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { UiColors } from '@/theme';
import { haptics, Haptics } from '@/utils/haptics';

interface Props {
  colors: UiColors;
  streak: number;
  freezes: number;
  freezeCapacity: number;
  missionsDone: number;
  missionsTotal: number;
  missionsRewarded: boolean;
  /** New achievements, counted on the profile button */
  newAchievements: number;
  onProfile: () => void;
  onMissions: () => void;
  onSettings: () => void;
}

interface CounterProps {
  colors: UiColors;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
}

/** Small icon + number pill of the header (streak, freezes, missions) */
function Counter({ colors, icon, tint, value, accessibilityLabel, onPress }: CounterProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.counter, { backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
    >
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.counterText, { color: colors.text }]}>{value}</Text>
    </Pressable>
  );
}

/**
 * Top bar of the home screen: profile, the daily counters grouped in the middle, settings.
 * Profile and settings share the same round button so the bar stays balanced.
 */
export default function HomeHeader({
  colors, streak, freezes, freezeCapacity, missionsDone, missionsTotal, missionsRewarded, newAchievements,
  onProfile, onMissions, onSettings,
}: Props) {
  const { t } = useTranslation();

  const roundButton = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, badge = 0) => (
    <Pressable
      onPress={() => {
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.round, { backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Ionicons name={icon} size={20} color={colors.primaryText} />
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.bar}>
      {roundButton(
        'person',
        newAchievements > 0 ? `${t('home.profile')}, ${t('profile.new_achievements', { count: newAchievements })}` : t('home.profile'),
        onProfile,
        newAchievements,
      )}

      <View style={styles.counters}>
        <Counter
          colors={colors}
          icon="flame"
          tint={streak > 0 ? colors.warning : colors.textMuted}
          value={String(streak)}
          accessibilityLabel={t('home.a11y_streak', { count: streak })}
          onPress={() => Alert.alert(
            t('home.streak_title'),
            streak > 0 ? t('home.streak_desc', { count: streak }) : t('home.streak_start'),
          )}
        />
        <Counter
          colors={colors}
          icon="snow"
          tint={freezes > 0 ? colors.frozen : colors.textMuted}
          value={`${freezes}/${freezeCapacity}`}
          accessibilityLabel={t('home.a11y_freezes', { count: freezes, max: freezeCapacity })}
          onPress={() => Alert.alert(t('home.freeze_title'), t('home.freeze_desc', { count: freezes, max: freezeCapacity }))}
        />
        <Counter
          colors={colors}
          icon={missionsRewarded ? 'checkmark-circle' : 'flag'}
          tint={missionsRewarded ? colors.success : colors.primaryText}
          value={`${missionsDone}/${missionsTotal}`}
          accessibilityLabel={t('a11y.missions_progress', { done: missionsDone, total: missionsTotal })}
          onPress={onMissions}
        />
      </View>

      {roundButton('settings-sharp', t('a11y.settings'), onSettings)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  counters: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
