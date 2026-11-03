import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import ArtSvg from '@/components/art/ArtSvg';
import type { ArtDrawing } from '@/theme/art/art';
import { SPRITE_EFFECTS, type SpriteEffectId } from '@/theme/art/events/effects';
import { buildSpritesPlan, spriteAt, type Sprite, type SpriteMotion } from './spritesPlan';

interface Props {
  effect: SpriteEffectId;
  width: number;
  height: number;
  /** Changing it plays the effect again */
  playKey: number;
}

function SpriteView({ sprite, motion, drawing, t }: { sprite: Sprite; motion: SpriteMotion; drawing: ArtDrawing; t: SharedValue<number> }) {
  const width = sprite.size;
  const height = sprite.size * (drawing.height / drawing.width);
  const style = useAnimatedStyle(() => {
    const p = spriteAt(sprite, motion, t.value);
    return {
      opacity: p.opacity,
      transform: [{ translateX: p.x - width / 2 }, { translateY: p.y - height / 2 }, { rotate: `${p.rotate}deg` }, { scale: p.scale }],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width, height }, style]}>
      <ArtSvg drawing={drawing} width={width} height={height} />
    </Animated.View>
  );
}

/** Win effect of a seasonal event drawn with its own drawings: hearts rising, clovers falling, champagne bursting… */
export default function SpritesEffect({ effect, width, height, playKey }: Props) {
  const { spec, drawings } = SPRITE_EFFECTS[effect];
  const plan = useMemo(() => buildSpritesPlan(spec, width, height), [spec, width, height]);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: spec.duration, easing: Easing.linear });
  }, [playKey]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {plan.map((sprite, i) => <SpriteView key={i} sprite={sprite} motion={spec.motion} drawing={drawings[sprite.drawing]} t={t} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
