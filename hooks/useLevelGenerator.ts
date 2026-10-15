import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { DIFFICULTY_LEVELS, generateLevel } from '@/utils/generator';
import { haptics, Haptics } from '@/utils/haptics';

export type DifficultyKey = keyof typeof DIFFICULTY_LEVELS;

/** Rough generation time of one level, for the estimate shown before generating */
export const GENERATION_TIME_MAP: Record<string, number> = {
  'EASY': 1000,
  'NORMAL': 3000,
  'HARD': 15000,
  'EXPERT': 500000,
  'MASTER': 1200000,
};

export interface GenerationRequest {
  amount: number;
  difficulty: DifficultyKey;
  gridSize: number;
}

/**
 * Generates map levels one by one in the background, after the existing ones.
 * Progress and cancellation go through the store's generationState.
 */
export function useLevelGenerator(): (request: GenerationRequest) => void {
  return useCallback(({ amount, difficulty, gridSize }: GenerationRequest) => {
    const { setGenerationState } = useGameStore.getState();
    const baseTimePerLevel = GENERATION_TIME_MAP[difficulty] || 2000;
    const initialEst = Math.ceil(((amount * baseTimePerLevel) + (amount * 150)) / 1000);

    setGenerationState({
      isRunning: true,
      current: 0,
      total: amount,
      shouldCancel: false,
      estimatedRemainingSeconds: initialEst
    });

    setTimeout(async () => {
      const { addGeneratedLevel, generatedLevels } = useGameStore.getState();
      const levels = [...sampleLevels, ...generatedLevels];
      const startingId = levels.length > 0 ? levels[levels.length - 1].id + 1 : 1;

      let totalGenerationTime = 0;

      for (let i = 0; i < amount; i++) {
        // Check cancel flag before each level
        const { shouldCancel } = useGameStore.getState().generationState;
        if (shouldCancel) break;

        const startTime = Date.now();
        const config = { ...DIFFICULTY_LEVELS[difficulty], gridSize };
        // Pass a copy of config to be safe
        const newLevel = generateLevel(startingId + i, { ...config });
        const duration = Date.now() - startTime;
        totalGenerationTime += duration;

        if (newLevel) {
          addGeneratedLevel(newLevel);
        }

        // Calculate remaining time based on actual average
        const avgSoFar = totalGenerationTime / (i + 1);
        const remainingCount = amount - (i + 1);
        const estRemaining = Math.ceil((remainingCount * (avgSoFar + 150)) / 1000);

        setGenerationState({
          current: i + 1,
          estimatedRemainingSeconds: estRemaining
        });

        // Yield to the JS event loop — lets the Cancel button press be processed.
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 100);
  }, []);
}
