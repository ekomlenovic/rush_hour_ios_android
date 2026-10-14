import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';

const DISPLAY_MS = 3000;

/**
 * Shows unlocked achievements one at a time at the top of the screen.
 * The win screen consumes the queue itself, so this covers unlocks happening elsewhere
 * (comeback, level creation, sharing, import...).
 */
export default function AchievementToast() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const unlockQueue = useGameStore(s => s.unlockQueue);
  const [current, setCurrent] = useState<string | null>(null);

  // Take the next achievement once the previous one is gone
  useEffect(() => {
    if (current || unlockQueue.length === 0) return;
    const [next, ...rest] = unlockQueue;
    useGameStore.setState({ unlockQueue: rest });
    setCurrent(next);
  }, [unlockQueue, current]);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [current]);

  const achievement = current ? ACHIEVEMENTS_BY_ID[current] : null;
  if (!achievement) return null;

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View
        key={achievement.id}
        entering={FadeInUp.springify()}
        exiting={FadeOutUp.duration(250)}
      >
        <Pressable
          onPress={() => setCurrent(null)}
          style={[styles.toast, { backgroundColor: isDark ? '#1C1C28' : '#FFFFFF', borderColor: '#F59E0B' }]}
        >
          <Text style={styles.icon}>{achievement.icon}</Text>
          <View style={styles.textContainer}>
            <Text style={styles.label}>{t('achievements.unlocked')}</Text>
            <Text style={[styles.name, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>{t(`achievements.${achievement.id}`)}</Text>
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
    shadowColor: '#000',
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
    color: '#F59E0B',
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
