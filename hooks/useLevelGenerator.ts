import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { DIFFICULTY_LEVELS, type DeviceDifficulty } from '@/utils/generator';
import { generateLevelAsync } from '@/utils/solver.background';
import { haptics, Haptics } from '@/utils/haptics';

/**
 * Typical generation time of one level on a phone, for the estimate shown before
 * generating (measured with the component generator, see docs/GAME_DESIGN.md).
 * The estimate is then corrected with the real average during the generation.
 */
export const EXPECTED_GENERATION_MS: Record<DeviceDifficulty, number> = {
  EASY: 300,
  NORMAL: 1500,
  HARD: 4000,
  EXPERT: 10000,
};

export interface GenerationRequest {
  amount: number;
  difficulty: DeviceDifficulty;
  gridSize: number;
}

/**
 * Generates map levels one by one on a background thread, after the existing ones.
 * Progress and cancellation go through the store's generationState: the JS thread stays
 * free, so Cancel stops the generation right after the level in progress.
 */
export function useLevelGenerator(): (request: GenerationRequest) => void {
  return useCallback(({ amount, difficulty, gridSize }: GenerationRequest) => {
    const { setGenerationState } = useGameStore.getState();
    setGenerationState({
      isRunning: true,
      current: 0,
      total: amount,
      shouldCancel: false,
      estimatedRemainingSeconds: Math.ceil((amount * EXPECTED_GENERATION_MS[difficulty]) / 1000),
    });

    (async () => {
      const { generatedLevels } = useGameStore.getState();
      const levels = [...sampleLevels, ...generatedLevels];
      const startingId = levels.length > 0 ? levels[levels.length - 1].id + 1 : 1;
      const config = { ...DIFFICULTY_LEVELS[difficulty], gridSize };
      let totalMs = 0;
      let nextId = startingId;

      for (let i = 0; i < amount; i++) {
        if (useGameStore.getState().generationState.shouldCancel) break;

        const startTime = Date.now();
        const newLevel = await generateLevelAsync(nextId, config);
        totalMs += Date.now() - startTime;

        if (useGameStore.getState().generationState.shouldCancel) break;
        if (newLevel) {
          useGameStore.getState().addGeneratedLevel(newLevel);
          nextId++;
        }

        const remaining = amount - (i + 1);
        setGenerationState({
          current: i + 1,
          estimatedRemainingSeconds: Math.ceil((remaining * totalMs) / (i + 1) / 1000),
        });
      }

      setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    })();
  }, []);
}
