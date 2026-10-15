import React from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { GameColors } from './colors';

/** Floating "analyzing" pill while the solver computes a hint */
export default function HintLoadingPill({ colors, isDark }: { colors: GameColors; isDark: boolean }) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(300)}
      accessibilityLiveRegion="polite"
      style={[styles.hintPill, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.1)' }]}
    >
      <ActivityIndicator size="small" color={colors.hint} />
      <Text style={[styles.hintPillText, { color: colors.hint }]}>{t('game.analyzing')}</Text>
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
