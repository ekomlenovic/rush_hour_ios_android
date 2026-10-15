import React from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { UiColors } from '@/theme';

/** Floating "analyzing" pill while the solver computes a hint */
export default function HintLoadingPill({ colors }: { colors: UiColors }) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(300)}
      accessibilityLiveRegion="polite"
      style={[styles.hintPill, { backgroundColor: colors.warningSoft }]}
    >
      <ActivityIndicator size="small" color={colors.warning} />
      <Text style={[styles.hintPillText, { color: colors.warning }]}>{t('game.analyzing')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hintPill: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 100,
  },
  hintPillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
