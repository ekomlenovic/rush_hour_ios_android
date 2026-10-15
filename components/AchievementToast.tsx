import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { fixedColors, useTheme } from '@/theme';

const DISPLAY_MS = 3000;

type ToastItem = { kind: 'achievement'; id: string } | { kind: 'missions'; freezeGranted: boolean };

/**
 * Shows unlocked achievements and completed daily missions one at a time at the top of the screen.
 * The win screen consumes both queues itself, so this covers what happens elsewhere
 * (comeback, level creation, sharing, import, moves or play time missions...).
 */
export default function AchievementToast() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const unlockQueue = useGameStore(s => s.unlockQueue);
  const pendingMissionReward = useGameStore(s => s.pendingMissionReward);
  const [current, setCurrent] = useState<ToastItem | null>(null);

  // Take the next item once the previous one is gone: missions first, then achievements
  useEffect(() => {
    if (current) return;
    const reward = useGameStore.getState().consumeMissionReward();
    if (reward) {
      setCurrent({ kind: 'missions', freezeGranted: reward.freezeGranted });
      return;
    }
    if (unlockQueue.length === 0) return;
    const [next, ...rest] = unlockQueue;
    useGameStore.setState({ unlockQueue: rest });
    setCurrent({ kind: 'achievement', id: next });
  }, [unlockQueue, pendingMissionReward, current]);

  useEffect(() => {
    if (!current) return;
    // Screen readers: the toast is announced, it may vanish before the player reaches it
    const announced = current.kind === 'achievement'
      ? `${t('achievements.unlocked')} ${t(`achievements.${current.id}`)}`
      : `${t('missions.completed')} ${current.freezeGranted ? t('missions.reward_freeze') : t('missions.reward_full')}`;
    AccessibilityInfo.announceForAccessibility(announced);
    const timer = setTimeout(() => setCurrent(null), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  const achievement = current.kind === 'achievement' ? ACHIEVEMENTS_BY_ID[current.id] : null;
  if (current.kind === 'achievement' && !achievement) return null;

  const icon = achievement ? achievement.icon : '🎯';
  const label = achievement ? t('achievements.unlocked') : t('missions.completed');
  const name = achievement
    ? t(`achievements.${achievement.id}`)
    : current.kind === 'missions' && current.freezeGranted ? t('missions.reward_freeze') : t('missions.reward_full');

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View
        key={achievement ? achievement.id : 'missions'}
        entering={FadeInUp.springify()}
        exiting={FadeOutUp.duration(250)}
      >
        <Pressable
          onPress={() => setCurrent(null)}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${name}`}
          accessibilityHint={t('a11y.close')}
          style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.warning }]}
        >
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.textContainer}>
            <Text style={[styles.label, { color: colors.warning }]}>{label}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
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
    fontSize: 30,
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
