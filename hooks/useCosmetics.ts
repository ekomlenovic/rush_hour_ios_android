import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { buildCosmeticContext, getUnlockedCosmetics, type CosmeticContext } from '@/data/cosmetics';

/** Unlock context of the cosmetics and the unlocked ones not seen in the garage yet */
export function useCosmetics(): { context: CosmeticContext; unlocked: string[]; unseen: string[] } {
  const xp = useGameStore(s => s.xp);
  const progress = useGameStore(s => s.progress);
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const achievements = useGameStore(s => s.achievements);
  const seenCosmetics = useGameStore(s => s.seenCosmetics);

  return useMemo(() => {
    const context = buildCosmeticContext({ xp, progress, dailyChallengeProgress, weeklyChallengeProgress, achievements });
    const unlocked = getUnlockedCosmetics(context);
    const seen = new Set(seenCosmetics);
    // Defaults are never "new"
    const unseen = unlocked.filter(key => !seen.has(key) && !key.endsWith(':classic') && key !== 'effect:none');
    return { context, unlocked, unseen };
  }, [xp, progress, dailyChallengeProgress, weeklyChallengeProgress, achievements, seenCosmetics]);
}
