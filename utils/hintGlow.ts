import { withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

/** Opacity of the hint highlight when the system "Reduce motion" setting is on: fixed, no pulse */
export const HINT_GLOW_STATIC = 1;

/**
 * Starts the highlight of the hinted vehicle. With reduced motion, Reanimated does not run an
 * infinite reversed withRepeat: it keeps the starting value, 0 here, and the hint stays invisible
 * (issue 154). The highlight is then set to a fixed opacity: the setting removes the pulse, not the hint.
 */
export function startHintGlow(glow: SharedValue<number>, reduceMotion: boolean) {
  if (reduceMotion) {
    glow.value = HINT_GLOW_STATIC;
    return;
  }
  glow.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 600 }),
      withTiming(0.3, { duration: 600 })
    ),
    -1,
    true
  );
}

/** Hides the highlight (hint cleared or vehicle moved) */
export function stopHintGlow(glow: SharedValue<number>) {
  glow.value = withTiming(0, { duration: 200 });
}
