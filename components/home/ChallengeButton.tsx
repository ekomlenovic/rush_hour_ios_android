import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { HomeColors } from './colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  colors: HomeColors;
  label: string;
  /** Border and text color while the challenge is still to do */
  color: string;
  done: boolean;
  /** Second line under the label (e.g. days left) */
  detail?: string;
  enteringDelay: number;
  onPress: () => void;
}

/** Daily / weekly challenge button on the home screen: green once won */
export default function ChallengeButton({ colors, label, color, done, detail, enteringDelay, onPress }: Props) {
  const tint = done ? colors.success : color;
  return (
    <AnimatedPressable
      entering={FadeInDown.delay(enteringDelay).springify()}
      style={[styles.secondaryButton, { borderColor: tint, borderWidth: 2 }]}
      onPress={onPress}
    >
      <Text style={[styles.secondaryText, { color: tint }]}>{label}</Text>
      {detail ? (
        <Text style={[styles.daysLeftText, { color: colors.sub }]}>{detail}</Text>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  daysLeftText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
