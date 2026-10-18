import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { msUntilNextMinute } from '@/utils/date';

/**
 * Current time, refreshed on each whole minute and when the app comes back to the foreground:
 * a screen left open past midnight shows the new day (daily challenge, missions, countdowns).
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, msUntilNextMinute());
    };
    timer = setTimeout(tick, msUntilNextMinute());

    // Timers are paused in the background: the time is read again on return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        tick();
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return now;
}
