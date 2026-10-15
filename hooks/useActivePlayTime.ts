import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useGameStore } from '@/store/gameStore';

/**
 * Active play time: counted while `isTracking` (game screen open, level unsolved)
 * and the app is in the foreground. Returns `stop`, which records the time
 * played so far and stops the clock (e.g. right before recording a win).
 */
export function useActivePlayTime(isTracking: boolean): { stop: () => void } {
  const segmentStartRef = useRef<number | null>(null);

  const flushPlayTime = useCallback(() => {
    if (segmentStartRef.current === null) return;
    const now = Date.now();
    useGameStore.getState().addPlayTime(now - segmentStartRef.current);
    segmentStartRef.current = now;
  }, []);

  useEffect(() => {
    if (!isTracking) return;
    segmentStartRef.current = Date.now();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        segmentStartRef.current = Date.now();
      } else {
        flushPlayTime();
        segmentStartRef.current = null;
      }
    });
    return () => {
      subscription.remove();
      flushPlayTime();
      segmentStartRef.current = null;
    };
  }, [isTracking, flushPlayTime]);

  const stop = useCallback(() => {
    flushPlayTime();
    segmentStartRef.current = null;
  }, [flushPlayTime]);

  return { stop };
}
