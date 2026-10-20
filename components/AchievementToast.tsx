import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AchievementIcon from '@/components/profile/AchievementIcon';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import type { MissionReward } from '@/data/missions';
import { missionRewardText } from '@/components/progression/rewards';
import { fixedColors, useTheme } from '@/theme';
import type { IoniconName } from '@/utils/icons';

const DISPLAY_MS = 3000;

type ToastItem = { kind: 'achievement'; id: string } | ({ kind: 'missions' } & MissionReward) | { kind: 'levelUp'; level: number };

/** Achievements shown one after the other at the top of the win screen, a modal the global toast can't cover */
export function WinAchievementToasts({ ids }: { ids: string[] }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const known = ids.filter(id => ACHIEVEMENTS_BY_ID[id]);
  const id = known[index];

  useEffect(() => setIndex(0), [ids]);
  useEffect(() => {
    if (!id) return;
    AccessibilityInfo.announceForAccessibility(`${t('achievements.unlocked')} ${t(`achievements.${id}`)}`);
    const timer = setTimeout(() => setIndex(i => i + 1), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [id]);

  if (!id) return null;
  const achievement = ACHIEVEMENTS_BY_ID[id];
  return (
    <ToastCard
      itemKey={id}
      icon={achievement.icon}
      iconCount={achievement.iconCount}
      label={t('achievements.unlocked')}
      name={t(`achievements.${id}`)}
      onPress={() => setIndex(i => i + 1)}
    />
  );
}

/** One toast at the top of the screen */
function ToastCard({ itemKey, icon, iconCount, label, name, onPress }: {
  itemKey: string; icon: IoniconName; iconCount?: 1 | 2 | 3; label: string; name: string; onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View key={itemKey} entering={FadeInUp.springify()} exiting={FadeOutUp.duration(250)}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${name}`}
          accessibilityHint={t('a11y.close')}
          style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.warning }]}
        >
          <AchievementIcon icon={icon} count={iconCount} size={30} color={colors.warning} style={styles.icon} />
          <View style={styles.textContainer}>
            <Text style={[styles.label, { color: colors.warning }]}>{label}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * Shows unlocked achievements and completed daily missions one at a time at the top of the screen.
 * The win screen consumes both queues itself (its achievements as toasts over it, WinAchievementToasts),
 * so this covers what happens elsewhere (comeback, level creation, sharing, import, moves or play time missions...).
 */
export default function AchievementToast() {
  const { t } = useTranslation();
  const unlockQueue = useGameStore(s => s.unlockQueue);
  const pendingMissionReward = useGameStore(s => s.pendingMissionReward);
  const levelUpQueue = useGameStore(s => s.levelUpQueue);
  const [current, setCurrent] = useState<ToastItem | null>(null);

  // Take the next item once the previous one is gone: missions first, then level ups, then achievements
  useEffect(() => {
    if (current) return;
    const reward = useGameStore.getState().consumeMissionReward();
    if (reward) {
      setCurrent({ kind: 'missions', ...reward });
      return;
    }
    if (levelUpQueue.length > 0) {
      const [level, ...rest] = levelUpQueue;
      useGameStore.setState({ levelUpQueue: rest });
      setCurrent({ kind: 'levelUp', level });
      return;
    }
    if (unlockQueue.length === 0) return;
    const [next, ...rest] = unlockQueue;
    useGameStore.setState({ unlockQueue: rest });
    setCurrent({ kind: 'achievement', id: next });
  }, [unlockQueue, pendingMissionReward, levelUpQueue, current]);

  useEffect(() => {
    if (!current) return;
    // Screen readers: the toast is announced, it may vanish before the player reaches it
    const announced = current.kind === 'achievement'
      ? `${t('achievements.unlocked')} ${t(`achievements.${current.id}`)}`
      : current.kind === 'levelUp'
        ? t('progression.level_up', { level: current.level })
        : `${t('missions.completed')} ${missionRewardText(t, current)}`;
    AccessibilityInfo.announceForAccessibility(announced);
    const timer = setTimeout(() => setCurrent(null), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  const achievement = current.kind === 'achievement' ? ACHIEVEMENTS_BY_ID[current.id] : null;
  if (current.kind === 'achievement' && !achievement) return null;

  const icon = achievement ? achievement.icon : current.kind === 'levelUp' ? 'trending-up' : 'flag';
  const label = achievement ? t('achievements.unlocked')
    : current.kind === 'levelUp' ? t('progression.level_up_label')
    : t('missions.completed');
  const name = achievement
    ? t(`achievements.${achievement.id}`)
    : current.kind === 'levelUp' ? t('progression.level', { level: current.level })
    : current.kind === 'missions' ? missionRewardText(t, current) : '';

  return (
    <ToastCard
      itemKey={achievement ? achievement.id : current.kind === 'levelUp' ? `level-${current.level}` : 'missions'}
      icon={icon}
      iconCount={achievement?.iconCount}
      label={label}
      name={name}
      onPress={() => setCurrent(null)}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: fixedColors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
  },
});
