import React from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

/** A load shorter than this shows nothing: the indicator would only flash */
const SHOW_DELAY_MS = 150;

/**
 * Indicator of every load of the app (a screen drawn after its slide, data from the server…).
 * Fades in after a short delay; announced as "Loading" by the screen reader.
 */
export default function LoadingIndicator({ color, size = 'small', fill = false, style }: {
  /** The primary color of the theme by default */
  color?: string;
  size?: 'small' | 'large';
  /** Takes the whole space of its parent, the indicator in the middle */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.delay(SHOW_DELAY_MS).duration(200)}
      pointerEvents="none"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.loading')}
      style={[fill && styles.fill, style]}
    >
      <ActivityIndicator size={size} color={color ?? colors.primary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
