import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { fixedColors, type UiColors } from '@/theme';
import type { IoniconName } from '@/utils/icons';

/** Tools of the world map, floating at the bottom right: search levels, generate levels */
export default function MapTools({ colors, onSearch, onGenerate }: {
  colors: UiColors;
  onSearch: () => void;
  onGenerate: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const tool = (icon: IoniconName, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        { backgroundColor: colors.floating, borderColor: colors.primaryBorder, transform: [{ scale: pressed ? 0.93 : 1 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
    >
      <Ionicons name={icon} size={22} color={colors.primaryText} />
    </Pressable>
  );

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.wrap, { bottom: Math.max(28, insets.bottom + 16) }]} pointerEvents="box-none">
      {tool('add', t('map.level_generator'), onGenerate)}
      {tool('search', t('map.filter_title'), onSearch)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    gap: 12,
    zIndex: 140,
  },
  tool: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: fixedColors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
});
