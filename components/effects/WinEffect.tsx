import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue,
} from 'react-native-reanimated';
import type { WinEffectId } from '@/data/cosmetics';
import TommyGunEffect from './TommyGunEffect';

interface Props {
  effect: WinEffectId;
  width: number;
  height: number;
  /** Particle colors */
  colors: string[];
  /** Changing it plays the effect again */
  playKey?: number;
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
  long?: boolean;
  /** Drawn as a ring (bubbles) */
  ring?: boolean;
}

/** Deterministic pseudo-random numbers, so a replay looks the same */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildParticles(effect: WinEffectId, width: number, height: number, colors: string[]): Particle[] {
  const rand = rng(42);
  const pick = () => colors[Math.floor(rand() * colors.length)];
  if (effect === 'confetti') {
    return Array.from({ length: 40 }, () => ({
      x: rand() * width,
      y: -20,
      dx: (rand() - 0.5) * 80,
      dy: height + 40,
      size: 6 + rand() * 6,
      color: pick(),
      delay: rand() * 500,
      duration: 1600 + rand() * 1000,
      rotate: 360 + rand() * 360,
    }));
  }
  if (effect === 'fireworks') {
    const bursts = [0.25, 0.5, 0.75].map((fx, i) => ({ x: fx * width, y: (0.25 + 0.15 * (i % 2)) * height, delay: i * 350 }));
    return bursts.flatMap(burst => {
      const color = pick();
      return Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const distance = 50 + rand() * 30;
        return {
          x: burst.x, y: burst.y,
          dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance,
          size: 5, color, delay: burst.delay, duration: 900, rotate: 0,
        };
      });
    });
  }
  if (effect === 'speed') {
    return Array.from({ length: 10 }, (_, i) => ({
      x: -width * 0.6,
      y: (i + 0.5) * (height / 10),
      dx: width * 1.8,
      dy: 0,
      size: 3,
      color: pick(),
      delay: rand() * 300,
      duration: 500 + rand() * 300,
      rotate: 0,
      long: true,
    }));
  }
  if (effect === 'bubbles') {
    return Array.from({ length: 24 }, () => ({
      x: rand() * width,
      y: height + 20,
      dx: (rand() - 0.5) * 40,
      dy: -(height * 0.6 + rand() * height * 0.4),
      size: 8 + rand() * 14,
      color: pick(),
      delay: rand() * 700,
      duration: 1800 + rand() * 900,
      rotate: 0,
      ring: true,
    }));
  }
  return [];
}

function ParticleView({ p, progress }: { p: Particle; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: p.long ? (t < 0.8 ? 0.9 : (1 - t) * 4.5) : 1 - t * t,
      transform: [
        { translateX: p.x + p.dx * t },
        { translateY: p.y + p.dy * t },
        { rotate: `${p.rotate * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        p.long
          ? { width: 120, height: p.size, borderRadius: p.size / 2, backgroundColor: p.color }
          : p.ring
          ? { width: p.size, height: p.size, borderRadius: p.size / 2, borderWidth: 2, borderColor: p.color }
          : { width: p.size, height: p.size * (p.rotate ? 0.6 : 1), borderRadius: p.rotate ? 1 : p.size / 2, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

function AnimatedParticle({ p, playKey }: { p: Particle; playKey: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(p.delay, withTiming(1, { duration: p.duration, easing: Easing.out(Easing.quad) }));
  }, [playKey]);
  return <ParticleView p={p} progress={progress} />;
}

/** Cosmetic win animation drawn over the board; nothing with "Reduce motion" on */
export default function WinEffect({ effect, width, height, colors, playKey = 0 }: Props) {
  const reduceMotion = useReducedMotion();
  const particles = useMemo(() => buildParticles(effect, width, height, colors), [effect, width, height, colors]);
  if (reduceMotion || (particles.length === 0 && effect !== 'tommy')) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.container]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {effect === 'tommy'
        ? <TommyGunEffect width={width} height={height} playKey={playKey} />
        : particles.map((p, i) => <AnimatedParticle key={`${effect}-${i}`} p={p} playKey={playKey} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', zIndex: 200 },
  particle: { position: 'absolute', left: 0, top: 0 },
});
