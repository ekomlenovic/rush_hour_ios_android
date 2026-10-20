import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import ArtSvg from '@/components/art/ArtSvg';
import { BAT_DOWN, BAT_UP, JACK_O_LANTERN, LANTERN_GLOW } from '@/theme/art/halloween';
import { BATS_DURATION_MS, batAt, buildBatsPlan, lanternGlow, lanternScale, wingsUp, type Bat } from './batsPlan';

interface Props {
  width: number;
  height: number;
  /** Changing it plays the effect again */
  playKey: number;
}

function BatView({ bat, t }: { bat: Bat; t: SharedValue<number> }) {
  const width = bat.width;
  const height = width * (BAT_UP.height / BAT_UP.width);
  const style = useAnimatedStyle(() => {
    const p = batAt(bat, t.value);
    return { opacity: p.opacity, transform: [{ translateX: p.x - width / 2 }, { translateY: p.y - height / 2 }, { scale: p.scale }] };
  });
  const up = useAnimatedStyle(() => ({ opacity: wingsUp(bat, t.value) ? 1 : 0 }));
  const down = useAnimatedStyle(() => ({ opacity: wingsUp(bat, t.value) ? 0 : 1 }));
  return (
    <Animated.View style={[styles.abs, { width, height }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, up]}>
        <ArtSvg drawing={BAT_UP} width={width} height={height} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, down]}>
        <ArtSvg drawing={BAT_DOWN} width={width} height={height} />
      </Animated.View>
    </Animated.View>
  );
}

/** Bats win effect (Halloween): a jack-o'-lantern pops up at the bottom and a swarm of bats flies out of it */
export default function BatsEffect({ width, height, playKey }: Props) {
  const plan = useMemo(() => buildBatsPlan(width, height), [width, height]);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: BATS_DURATION_MS, easing: Easing.linear });
  }, [playKey]);

  const { lanternWidth, lanternHeight, lantern } = plan;
  const lanternStyle = useAnimatedStyle(() => ({ transform: [{ scale: lanternScale(t.value) }] }));
  const glowSize = lanternWidth * 1.8;
  const glowStyle = useAnimatedStyle(() => ({ opacity: lanternGlow(t.value), transform: [{ scale: lanternScale(t.value) }] }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.abs, {
          left: lantern.x + lanternWidth / 2 - glowSize / 2,
          top: lantern.y + lanternHeight / 2 - glowSize / 2,
          width: glowSize,
          height: glowSize,
        }, glowStyle]}
      >
        <ArtSvg drawing={LANTERN_GLOW} width={glowSize} height={glowSize} />
      </Animated.View>
      <Animated.View style={[styles.abs, { left: lantern.x, top: lantern.y, width: lanternWidth, height: lanternHeight }, lanternStyle]}>
        <ArtSvg drawing={JACK_O_LANTERN} width={lanternWidth} height={lanternHeight} />
      </Animated.View>
      {plan.bats.map((bat, i) => <BatView key={i} bat={bat} t={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
