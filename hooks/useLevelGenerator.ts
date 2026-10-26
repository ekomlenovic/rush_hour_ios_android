import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { DIFFICULTY_LEVELS, generateLevel } from '@/utils/generator';
import { haptics, Haptics } from '@/utils/haptics';
import { formatTimeLeft } from '@/utils/date';
import { estimateLevelMs } from '@/utils/generationEstimate';
import { useGenerationTimes } from '@/store/generationTimes';

export type DifficultyKey = keyof typeof DIFFICULTY_LEVELS;

/** Pause between two levels, for the Cancel button to be processed */
const YIELD_MS = 150;

/** Estimated time of a whole generation, in seconds, learnt from the times measured on this phone */
export function estimateGenerationSeconds({ amount, difficulty, gridSize }: GenerationRequest): number {
  const levelMs = estimateLevelMs(difficulty, gridSize, useGenerationTimes.getState().samples);
  return (amount * (levelMs + YIELD_MS)) / 1000;
}

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
  const { recordLevelTime } = useGenerationTimes.getState();
  const estimate = (left: number) => Math.ceil(estimateGenerationSeconds({ amount: left, difficulty, gridSize }));

  setGenerationState({
    isRunning: true,
    current: 0,
    total: amount,
    shouldCancel: false,
    estimatedRemainingSeconds: estimate(amount)
  });

  setTimeout(async () => {
    // Time spent since the last level made, failed tries included: what a level really costs
    let sinceLastLevel = 0;
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
        sinceLastLevel += Date.now() - startTime;

        if (newLevel) {
          useGameStore.getState().addGeneratedLevel({ ...newLevel, id: nextLevelId() });
          made++;
          // The estimate learns from this phone: the next generations, and the rest of this one
          recordLevelTime(difficulty, gridSize, sinceLastLevel);
          sinceLastLevel = 0;
        }

        setGenerationState({
          current: made,
          estimatedRemainingSeconds: estimate(amount - made),
        });

        // Yield to the JS event loop — lets the Cancel button press be processed.
        await new Promise(resolve => setTimeout(resolve, YIELD_MS));
      }
    } finally {
      // Tries that made no level (given up, cancelled): a level costs at least that, never counted as faster
      const samples = useGenerationTimes.getState().samples;
      if (sinceLastLevel > estimateLevelMs(difficulty, gridSize, samples)) recordLevelTime(difficulty, gridSize, sinceLastLevel);
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
