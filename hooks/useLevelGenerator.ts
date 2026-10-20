import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { DIFFICULTY_LEVELS, generateLevel } from '@/utils/generator';
import { haptics, Haptics } from '@/utils/haptics';
import { formatTimeLeft } from '@/utils/date';

export type DifficultyKey = keyof typeof DIFFICULTY_LEVELS;

/** Rough generation time of one level, for the estimate shown before generating */
export const GENERATION_TIME_MAP: Record<string, number> = {
  'EASY': 1000,
  'NORMAL': 3000,
  'HARD': 15000,
  'EXPERT': 500000,
  'MASTER': 1200000,
};

/** A generation time for the player: '45 s', then minutes and hours (an Expert batch takes hours, not '24000s') */
export function formatGenerationTime(seconds: number): string {
  return seconds < 60 ? `${Math.max(1, Math.round(seconds))} s` : formatTimeLeft(seconds * 1000);
}

export interface GenerationRequest {
  amount: number;
  difficulty: DifficultyKey;
  gridSize: number;
}

/** A generation is going on: one at a time, a second one would generate the same ids */
let running = false;

/** A generation is really going on (the persisted generationState can outlive a closed app) */
export const isGenerationActive = (): boolean => running;

/** Id of the next generated level: right after the last map level, never a hole (issue 120) */
function nextLevelId(): number {
  const { generatedLevels } = useGameStore.getState();
  return Math.max(sampleLevels.length, ...generatedLevels.map(l => l.id)) + 1;
}

/**
 * Generates map levels one by one in the background, after the existing ones.
 * Progress and cancellation go through the store's generationState.
 * A level that could not be generated takes no id: it is tried again, a few times at most.
 */
export function startLevelGeneration({ amount, difficulty, gridSize }: GenerationRequest): void {
  if (running) return;
  running = true;
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
    let totalGenerationTime = 0;
    let made = 0;
    // Failures are tried again, but a difficulty that keeps failing does not loop forever
    const maxTries = amount * 2;

    try {
      for (let tries = 0; made < amount && tries < maxTries; tries++) {
        // Check cancel flag before each level
        const { shouldCancel } = useGameStore.getState().generationState;
        if (shouldCancel) break;

        const startTime = Date.now();
        const config = { ...DIFFICULTY_LEVELS[difficulty], gridSize };
        // The id is taken when the level is ready: a failed one leaves no hole
        const newLevel = generateLevel(nextLevelId(), { ...config });
        const duration = Date.now() - startTime;
        totalGenerationTime += duration;

        if (newLevel) {
          useGameStore.getState().addGeneratedLevel({ ...newLevel, id: nextLevelId() });
          made++;
        }

        // Calculate remaining time based on actual average
        const avgSoFar = totalGenerationTime / (tries + 1);
        const remainingCount = amount - made;
        const estRemaining = Math.ceil((remainingCount * (avgSoFar + 150)) / 1000);

        setGenerationState({
          current: made,
          estimatedRemainingSeconds: estRemaining
        });

        // Yield to the JS event loop — lets the Cancel button press be processed.
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } finally {
      running = false;
      setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
    }
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, 100);
}

/** Starts a generation (see startLevelGeneration) */
export function useLevelGenerator(): (request: GenerationRequest) => void {
  return startLevelGeneration;
}
