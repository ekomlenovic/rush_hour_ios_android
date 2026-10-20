import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import ArtSvg from '@/components/art/ArtSvg';
import { GIFT_COLORS, GIFT_SPARKLE, giftBox } from '@/theme/art/christmas';
import { FADE_START, GIFTS_DURATION_MS, SPARKLE, buildGiftsPlan, giftAt, type Gift, type Sparkle } from './giftsPlan';

interface Props {
  width: number;
  height: number;
  /** Changing it plays the effect again */
  playKey: number;
}

/** One drawing per color, shared by the presents */
const GIFT_DRAWINGS = GIFT_COLORS.map(c => giftBox(c.wrap, c.ribbon));

function GiftView({ gift, t }: { gift: Gift; t: SharedValue<number> }) {
  const { size } = gift;
  const style = useAnimatedStyle(() => {
    const p = giftAt(gift, t.value);
    return {
      opacity: p.opacity,
      transform: [
        { translateX: p.x - size / 2 },
        // Squashed from the ground, not from the middle
        { translateY: p.y - size / 2 + (size * (1 - p.squash)) / 2 },
        { rotate: `${p.rotate}deg` },
        { scaleY: p.squash },
      ],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width: size, height: size }, style]}>
      <ArtSvg drawing={GIFT_DRAWINGS[gift.color]} width={size} height={size} />
    </Animated.View>
  );
}

function SparkleView({ sparkle, t }: { sparkle: Sparkle; t: SharedValue<number> }) {
  const { size } = sparkle;
  const style = useAnimatedStyle(() => {
    const u = (t.value - sparkle.t0) / SPARKLE;
    const on = u > 0 && u < 1 && t.value < FADE_START;
    return {
      opacity: on ? 1 - u : 0,
      transform: [
        { translateX: sparkle.from.x + sparkle.dx * Math.max(0, u) - size / 2 },
        { translateY: sparkle.from.y + sparkle.dy * Math.max(0, u) - size / 2 },
        { rotate: '45deg' },
      ],
    };
  });
  return <Animated.View style={[styles.abs, styles.sparkle, { width: size, height: size }, style]} />;
}

/** Gift shower win effect (Christmas): presents fall from the top and land at the bottom with a bounce */
export default function GiftsEffect({ width, height, playKey }: Props) {
  const plan = useMemo(() => buildGiftsPlan(width, height), [width, height]);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: GIFTS_DURATION_MS, easing: Easing.linear });
  }, [playKey]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {plan.gifts.map((gift, i) => <GiftView key={`g${i}`} gift={gift} t={t} />)}
      {plan.sparkles.map((sparkle, i) => <SparkleView key={`s${i}`} sparkle={sparkle} t={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  sparkle: {
    backgroundColor: GIFT_SPARKLE,
    shadowColor: GIFT_SPARKLE, shadowOpacity: 0.9, shadowRadius: 3, shadowOffset: { width: 0, height: 0 },
  },
});
