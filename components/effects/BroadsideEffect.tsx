import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import ArtSvg from '@/components/art/ArtSvg';
import { BROADSIDE_COLORS, FRIGATE, waves } from '@/theme/art/frigate';
import {
  BALL_FLIGHT, BROADSIDE_DURATION_MS, BURST, FLASH, SMOKE,
  ballAt, buildBroadsidePlan, seaLevel, shipBob, shipLeft, shipRoll, type Shot,
} from './broadsidePlan';

interface Props {
  width: number;
  height: number;
  /** Changing it plays the effect again */
  playKey: number;
}

const BACK_WAVES = waves(false);
const FRONT_WAVES = waves(true);

/**
 * The sea, twice as wide as the area so its waves roll by (`speed` widths over the effect),
 * rising from below `rise` at the start and sinking back at the end
 */
function seaStyle(v: number, speed: number, width: number, rise: number) {
  'worklet';
  return {
    opacity: v > 0 && v < 1 ? 1 : 0,
    transform: [{ translateX: -((v * speed) % 1) * width }, { translateY: (1 - seaLevel(v)) * rise }],
  };
}

/** Puffs making up a cloud of smoke: center and radius, in share of its size */
const PUFFS = [[0.5, 0.55, 0.32], [0.28, 0.45, 0.22], [0.66, 0.36, 0.2], [0.4, 0.28, 0.18]];

/** A cloud of cannon smoke: it swells, drifts back in the wind and fades */
function Smoke({ shot, size, t }: { shot: Shot; size: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const u = (t.value - shot.t0) / SMOKE;
    const visible = u > 0 && u < 1;
    return {
      opacity: visible ? (u < 0.08 ? u / 0.08 : 1 - u) * 0.9 : 0,
      transform: [
        { translateX: shot.from.x - size / 2 + shot.smokeDrift.x * (visible ? u : 0) },
        { translateY: shot.from.y - size / 2 + shot.smokeDrift.y * (visible ? u : 0) },
        { scale: 0.3 + 1.4 * Math.sqrt(Math.max(0, Math.min(1, u))) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.round, { width: size, height: size }, style]}>
      {PUFFS.map(([x, y, r], i) => (
        <View key={i} style={[styles.round, { left: (x - r) * size, top: (y - r) * size, width: 2 * r * size, height: 2 * r * size, borderRadius: r * size, backgroundColor: BROADSIDE_COLORS.smoke }]} />
      ))}
    </Animated.View>
  );
}

/** The flash at the gunport */
function Flash({ shot, size, t }: { shot: Shot; size: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const u = (t.value - shot.t0) / FLASH;
    return { opacity: u > 0 && u < 1 ? 1 : 0, transform: [{ scale: 0.6 + u }] };
  });
  return (
    <Animated.View style={[styles.round, styles.center, { left: shot.from.x - size / 2, top: shot.from.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: BROADSIDE_COLORS.flash }, style]}>
      <View style={{ width: size / 2, height: size / 2, borderRadius: size / 4, backgroundColor: BROADSIDE_COLORS.flashCore }} />
    </Animated.View>
  );
}

/** The cannonball on its arc */
function Ball({ shot, size, t }: { shot: Shot; size: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const u = (t.value - shot.t0) / BALL_FLIGHT;
    const p = ballAt(shot, Math.max(0, Math.min(1, u)));
    return {
      opacity: u > 0 && u < 1 ? 1 : 0,
      // Smaller as it goes away
      transform: [{ translateX: p.x - size / 2 }, { translateY: p.y - size / 2 }, { scale: 1 - 0.4 * Math.max(0, Math.min(1, u)) }],
    };
  });
  return <Animated.View style={[styles.round, styles.ball, { width: size, height: size, borderRadius: size / 2, backgroundColor: BROADSIDE_COLORS.ball }, style]} />;
}

/** Where the ball lands: a burst of fire turning to smoke */
function Burst({ shot, size, t }: { shot: Shot; size: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const u = (t.value - shot.t0 - BALL_FLIGHT) / BURST;
    return { opacity: u > 0 && u < 1 ? 1 - u : 0, transform: [{ scale: 0.3 + 1.2 * Math.max(0, u) }] };
  });
  return (
    <Animated.View style={[styles.round, styles.center, { left: shot.to.x - size / 2, top: shot.to.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: BROADSIDE_COLORS.smoke }, style]}>
      <View style={{ width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, backgroundColor: BROADSIDE_COLORS.burst }} />
    </Animated.View>
  );
}

/** Broadside win effect (Anno 1800 style): a frigate sails across on a rolling sea and fires its guns at the board */
export default function BroadsideEffect({ width, height, playKey }: Props) {
  const plan = useMemo(() => buildBroadsidePlan(width, height), [width, height]);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: BROADSIDE_DURATION_MS, easing: Easing.linear });
  }, [playKey]);

  const { shipWidth, shipHeight, shipTop, seaTop, seaHeight } = plan;
  const rise = seaHeight + shipHeight;
  const backSea = useAnimatedStyle(() => seaStyle(t.value, 1.5, width, rise));
  const frontSea = useAnimatedStyle(() => seaStyle(t.value, 2.5, width, rise));
  const shipStyle = useAnimatedStyle(() => {
    const v = t.value;
    return {
      opacity: v > 0 && v < 1 ? 1 : 0,
      transform: [
        { translateX: shipLeft(plan, v) },
        { translateY: shipTop + shipBob(v) * shipHeight + (1 - seaLevel(v)) * rise },
        { rotate: `${shipRoll(v)}deg` },
      ],
    };
  });

  const port = Math.max(10, shipWidth * 0.07);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {plan.shots.map((shot, i) => <Burst key={`b${i}`} shot={shot} size={port * 2.4} t={t} />)}
      {plan.shots.map((shot, i) => <Ball key={`c${i}`} shot={shot} size={Math.max(5, port * 0.6)} t={t} />)}
      <Animated.View style={[styles.abs, { top: seaTop, width: width * 2, height: seaHeight }, backSea]}>
        <ArtSvg drawing={BACK_WAVES} width={width * 2} height={seaHeight} />
      </Animated.View>
      <Animated.View style={[styles.abs, { width: shipWidth, height: shipHeight }, shipStyle]}>
        <ArtSvg drawing={FRIGATE} width={shipWidth} height={shipHeight} />
      </Animated.View>
      {plan.shots.map((shot, i) => <Flash key={`f${i}`} shot={shot} size={port} t={t} />)}
      {plan.shots.map((shot, i) => <Smoke key={`s${i}`} shot={shot} size={port * 3} t={t} />)}
      <Animated.View style={[styles.abs, { top: seaTop + seaHeight * 0.45, width: width * 2, height: seaHeight * 0.55 }, frontSea]}>
        <ArtSvg drawing={FRONT_WAVES} width={width * 2} height={seaHeight * 0.55} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  round: { position: 'absolute', left: 0, top: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  ball: { borderWidth: 1, borderColor: BROADSIDE_COLORS.ballEdge },
});
