import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { fixedColors } from '@/theme';
import type { UiColors } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  colors: UiColors;
  icon: string;
  label: string;
  done: boolean;
  /** Second line under the label (e.g. days left, stars won) */
  detail?: string;
  enteringDelay: number;
  onPress: () => void;
}

/**
 * Daily / weekly challenge button of the home screen, same look as the Play button.
 * Buttons share a row with flex: 1 so they keep the same size whatever the language.
 */
export default function ChallengeButton({ colors, icon, label, done, detail, enteringDelay, onPress }: Props) {
  return (
    <AnimatedPressable
      entering={FadeInDown.delay(enteringDelay).springify()}
      style={[styles.card, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <Text style={styles.icon}>{done ? '✅' : icon}</Text>
      <View style={styles.labelSlot}>
        <Text
          style={styles.label}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {label}
        </Text>
      </View>
      <View style={styles.detailSlot}>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
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
    gap: 4,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    color: fixedColors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  detailSlot: {
    minHeight: 16,
    justifyContent: 'center',
  },
  detail: {
    color: fixedColors.onPrimary,
    opacity: 0.85,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
