import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fixedColors, type UiColors } from '@/theme';

/** Floating pill bringing the next level back on screen, pointing where it is */
export default function JumpButton({ levelId, below, colors, onPress }: {
  levelId: number;
  /** The level is under the visible part of the map */
  below: boolean;
  colors: UiColors;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOutDown} style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.map_jump', { id: levelId })}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: colors.primary, shadowColor: colors.primary, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        <Text style={styles.text}>{below ? '↓' : '↑'}  {t('map.jump_to', { id: levelId })}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 150,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  text: {
    color: fixedColors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
