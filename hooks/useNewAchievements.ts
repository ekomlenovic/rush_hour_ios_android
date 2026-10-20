import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';

/** Unlocked achievements not touched in the profile yet: they wear a "new" badge */
export function useNewAchievements(): string[] {
  const achievements = useGameStore(s => s.achievements);
  const seenAchievements = useGameStore(s => s.seenAchievements);
  return useMemo(() => {
    const seen = new Set(seenAchievements);
    return achievements.filter(id => !seen.has(id) && id in ACHIEVEMENTS_BY_ID);
  }, [achievements, seenAchievements]);
}
