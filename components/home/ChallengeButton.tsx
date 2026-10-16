import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { UiColors } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  colors: UiColors;
  icon: string;
  label: string;
  /** Accent (border, label) while the challenge is still to do */
  color: string;
  done: boolean;
  /** Second line under the label (e.g. days left, stars won) */
  detail?: string;
  enteringDelay: number;
  onPress: () => void;
}

/**
 * Daily / weekly challenge card of the home screen: green once won.
 * Cards share a row with flex: 1 so they keep the same size whatever the language.
 */
export default function ChallengeButton({ colors, icon, label, color, done, detail, enteringDelay, onPress }: Props) {
  const tint = done ? colors.success : color;
  return (
    <AnimatedPressable
      entering={FadeInDown.delay(enteringDelay).springify()}
      style={[styles.card, { borderColor: tint, backgroundColor: done ? colors.successSoft : colors.card }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <Text style={styles.icon}>{done ? '✅' : icon}</Text>
      <View style={styles.labelSlot}>
        <Text
          style={[styles.label, { color: tint }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {label}
        </Text>
      </View>
      <View style={styles.detailSlot}>
        {detail ? (
          <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>{detail}</Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 2,
    gap: 4,
  },
  icon: {
    fontSize: 26,
  },
  // Two lines are reserved so both cards keep the same height in every language
  labelSlot: {
    minHeight: 42,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailSlot: {
    minHeight: 16,
    justifyContent: 'center',
  },
  detail: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
