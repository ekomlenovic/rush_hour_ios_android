import { useEffect, useState } from 'react';
import { useNavigation } from 'expo-router';
import type { NativeStackNavigationProp } from 'expo-router';

/** The content is drawn once the screen has slid in, or after this delay if the end of the slide is not reported */
const READY_FALLBACK_MS = 600;

/**
 * 'sliding': the screen slides in; 'drawing': its content is being drawn; 'ready': it is drawn.
 * Drawing a heavy screen before its slide froze Android for seconds on the screen below, as if the
 * tap did nothing: the screen slides in light, its content comes after. The loading indicator is
 * put on screen one frame before the content: it only shows (after its delay) when the drawing
 * takes long, so a fast phone goes straight from the slide to the content.
 */
export function useSlideIn(): 'sliding' | 'drawing' | 'ready' {
  const navigation = useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();
  const [phase, setPhase] = useState<'sliding' | 'drawing' | 'ready'>('sliding');

  useEffect(() => {
    let frame: number | undefined;
    const ready = () => {
      if (frame !== undefined) return;
      setPhase(p => (p === 'sliding' ? 'drawing' : p));
      frame = requestAnimationFrame(() => setPhase('ready'));
    };
    const unsubscribe = navigation.addListener('transitionEnd', ready);
    const timer = setTimeout(ready, READY_FALLBACK_MS);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [navigation]);

  return phase;
}
