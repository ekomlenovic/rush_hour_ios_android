import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import ArtSvg from '@/components/art/ArtSvg';
import { BULLET_HOLE, MUZZLE_FLASH, TOMMY_COLORS, TOMMY_GUN, TOMMY_MUZZLE } from '@/theme/art/tommyGun';
import {
  BULLET_FLIGHT, CASE_FLIGHT, GUN_IN_END, GUN_OUT_START, HOLES_FADE, TOMMY_DURATION_MS,
  buildTommyGunPlan, shotPhase, sprayAngle, type Shot,
} from './tommyGunPlan';

interface Props {
  width: number;
  height: number;
  /** Changing it plays the effect again */
  playKey: number;
}

/** The muzzle flashes and the gun kicks back during the first part of each shot */
const FLASH_SHARE = 0.4;

function Tracer({ shot, length, t }: { shot: Shot; length: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const u = (t.value - shot.t0) / BULLET_FLIGHT;
    const x = shot.from.x + (shot.to.x - shot.from.x) * u;
    const y = shot.from.y + (shot.to.y - shot.from.y) * u;
    return {
      opacity: u > 0 && u < 1 ? 1 : 0,
      transform: [{ translateX: x - length / 2 }, { translateY: y - 1.5 }, { rotate: `${shot.angle}deg` }],
    };
  });
  return <Animated.View style={[styles.tracer, { width: length }, style]} />;
}

function Hole({ shot, size, t }: { shot: Shot; size: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const since = t.value - (shot.t0 + BULLET_FLIGHT);
    const fade = t.value < HOLES_FADE ? 1 : Math.max(0, (1 - t.value) / (1 - HOLES_FADE));
    return {
      opacity: since >= 0 ? fade : 0,
      transform: [{ scale: since >= 0 && since < 0.02 ? 1.4 - since * 20 : 1 }],
    };
  });
  return (
    <Animated.View style={[styles.abs, { left: shot.to.x - size / 2, top: shot.to.y - size / 2 }, style]}>
      <ArtSvg drawing={BULLET_HOLE} width={size} height={size} />
    </Animated.View>
  );
}

function Case({ shot, size, t }: { shot: Shot; size: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const u = (t.value - shot.t0) / CASE_FLIGHT;
    return {
      opacity: u > 0 && u < 1 ? 1 : 0,
      transform: [
        { translateX: shot.caseFrom.x + shot.caseDx * u },
        { translateY: shot.caseFrom.y - shot.caseRise * u + shot.caseFall * u * u },
        { rotate: `${720 * u}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.case, { width: size * 0.45, height: size }, style]} />;
}

/** Tommy gun win effect (Mafia): a burst sprayed across the board, with tracers, empty cases and bullet holes */
export default function TommyGunEffect({ width, height, playKey }: Props) {
  const plan = useMemo(() => buildTommyGunPlan(width, height), [width, height]);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: TOMMY_DURATION_MS, easing: Easing.linear });
  }, [playKey]);

  const { gunWidth, gunHeight, center } = plan;
  const away = gunWidth + center.x;
  const gunStyle = useAnimatedStyle(() => {
    const v = t.value;
    const slide = v < GUN_IN_END
      ? -away * (1 - v / GUN_IN_END) ** 2
      : v > GUN_OUT_START ? -away * ((v - GUN_OUT_START) / (1 - GUN_OUT_START)) ** 2 : 0;
    const phase = shotPhase(v);
    const recoil = phase >= 0 && phase < FLASH_SHARE ? -gunWidth * 0.025 : 0;
    return {
      opacity: v > 0 && v < 1 ? 1 : 0,
      transform: [
        { translateX: center.x - gunWidth / 2 + slide + recoil },
        { translateY: center.y - gunHeight / 2 },
        { rotate: `${sprayAngle(v)}deg` },
      ],
    };
  });
  const flashSize = { width: gunWidth * 0.3, height: gunWidth * 0.22 };
  const flashStyle = useAnimatedStyle(() => {
    const phase = shotPhase(t.value);
    const on = phase >= 0 && phase < FLASH_SHARE;
    return { opacity: on ? 1 : 0, transform: [{ scaleX: on && phase < FLASH_SHARE / 2 ? 1.15 : 0.85 }] };
  });

  const holeSize = Math.max(10, gunHeight * 0.32);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {plan.shots.map((shot, i) => <Hole key={`h${i}`} shot={shot} size={holeSize} t={t} />)}
      {plan.shots.map((shot, i) => <Tracer key={`b${i}`} shot={shot} length={gunWidth * 0.14} t={t} />)}
      <Animated.View style={[styles.abs, { width: gunWidth, height: gunHeight }, gunStyle]}>
        <ArtSvg drawing={TOMMY_GUN} width={gunWidth} height={gunHeight} />
        <Animated.View
          style={[styles.abs, {
            left: (TOMMY_MUZZLE.x / TOMMY_GUN.width) * gunWidth,
            top: (TOMMY_MUZZLE.y / TOMMY_GUN.height) * gunHeight - flashSize.height / 2,
            ...flashSize,
          }, flashStyle]}
        >
          <ArtSvg drawing={MUZZLE_FLASH} width={flashSize.width} height={flashSize.height} />
        </Animated.View>
      </Animated.View>
      {plan.shots.map((shot, i) => <Case key={`c${i}`} shot={shot} size={Math.max(5, gunHeight * 0.14)} t={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  tracer: {
    position: 'absolute', left: 0, top: 0, height: 3, borderRadius: 1.5, backgroundColor: TOMMY_COLORS.tracer,
    shadowColor: TOMMY_COLORS.tracerGlow, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  case: { position: 'absolute', left: 0, top: 0, borderRadius: 1, backgroundColor: TOMMY_COLORS.brass, borderWidth: 0.5, borderColor: TOMMY_COLORS.brassEdge },
});
