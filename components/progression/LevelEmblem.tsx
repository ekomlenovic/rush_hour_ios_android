import React, { useId } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  EMBLEM_BOLT, EMBLEM_BOLTS, EMBLEM_BOX, EMBLEM_FACE_SCALE, EMBLEM_INK_SHADOW, emblemLabel, getEmblemStep, getEmblemTier, hasLightInk,
} from '@/theme/art/levelEmblem';

interface Props {
  level: number;
  /** Width and height, in points */
  size: number;
  style?: StyleProp<ViewStyle>;
}

const CENTER = EMBLEM_BOX / 2;
const FACE = `translate(${CENTER} ${CENTER}) scale(${EMBLEM_FACE_SCALE}) translate(${-CENTER} ${-CENTER})`;
/** Size of the level on the emblem, in the units of its box, by number of digits */
const FONT_SIZES = [22, 19, 14.5];

/**
 * The emblem of a player level: the road sign of its tier, the level written on it, one
 * bolt per step inside the tier. Always the same colors (an illustration, like a medal);
 * the screen reader text is given by the parent.
 */
export default function LevelEmblem({ level, size, style }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tier = getEmblemTier(level);
  const bolts = EMBLEM_BOLTS[getEmblemStep(level)];
  const label = emblemLabel(level);
  const diagonal = tier.fill.length > 2;
  const fontSize = (FONT_SIZES[label.length - 1] ?? FONT_SIZES[2]) * (size / EMBLEM_BOX);

  return (
    <View style={[{ width: size, height: size }, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox={`0 0 ${EMBLEM_BOX} ${EMBLEM_BOX}`}>
        <Defs>
          <LinearGradient id={`${id}rim`} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={tier.rim[0]} />
            <Stop offset="1" stopColor={tier.rim[1]} />
          </LinearGradient>
          <LinearGradient id={`${id}face`} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
            {tier.fill.map((color, i) => <Stop key={i} offset={i / (tier.fill.length - 1)} stopColor={color} />)}
          </LinearGradient>
        </Defs>
        <Path d={tier.shape} fill={`url(#${id}rim)`} />
        <G transform={FACE}>
          <Path d={tier.shape} fill={`url(#${id}face)`} />
        </G>
        {bolts.map(i => (
          <Circle key={i} cx={tier.bolts[i][0]} cy={tier.bolts[i][1]} r={2.7} fill={EMBLEM_BOLT.fill} stroke={EMBLEM_BOLT.stroke} strokeWidth={1} />
        ))}
      </Svg>
      <View style={styles.center}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.label, { color: tier.ink, fontSize, lineHeight: fontSize * 1.15 }, hasLightInk(tier) && styles.shadow]}
        >
          {label}
        </Text>
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
  label: {
    fontWeight: '900',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  shadow: {
    textShadowColor: EMBLEM_INK_SHADOW,
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1.5,
  },
});
