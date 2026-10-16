import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  level: number;
  /** Filled share, 0 to 1 */
  ratio: number;
  size?: number;
}

const STROKE = 8;

/** Player level in an XP ring; the screen reader text is given by the parent */
export default function XpRing({ colors, level, ratio, size = RFValue(84) }: Props) {
  const { t } = useTranslation();
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, ratio)) * circumference;

  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.neutralSoft} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.caption, { color: colors.textMuted }]}>{t('progression.ring_caption')}</Text>
        <Text style={[styles.level, { color: colors.text }]}>{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontSize: RFValue(10),
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  level: {
    fontSize: RFValue(28),
    fontWeight: '800',
    lineHeight: RFValue(32),
  },
});
