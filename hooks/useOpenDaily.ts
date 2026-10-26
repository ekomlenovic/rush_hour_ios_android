import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

/**
 * Tells the store which daily the game screen has open and not won yet (`date`, null for none),
 * cleared when it is won or the screen closes. Left open past midnight, that daily can still be won:
 * its day is not missed meanwhile (see docs/GAME_DESIGN.md).
 */
export function useOpenDaily(date: string | null) {
  const setOpenDailyDate = useGameStore(s => s.setOpenDailyDate);
  useEffect(() => {
    if (!date) return;
    setOpenDailyDate(date);
    return () => setOpenDailyDate(null);
  }, [date, setOpenDailyDate]);
}
