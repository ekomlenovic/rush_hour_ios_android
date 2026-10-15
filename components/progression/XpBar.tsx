import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  /** Filled share, 0 to 1 */
  ratio: number;
  /** Animates from this share on mount (win screen) */
  from?: number;
  height?: number;
}

/** XP progress bar; the screen reader text is given by the parent */
export default function XpBar({ colors, ratio, from, height = 8 }: Props) {
  const progress = useSharedValue(from ?? ratio);

  useEffect(() => {
    progress.value = from === undefined
      ? ratio
      : withDelay(300, withTiming(ratio, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [ratio, from]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.neutralSoft }]} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fill, { borderRadius: height / 2, backgroundColor: colors.primary }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
