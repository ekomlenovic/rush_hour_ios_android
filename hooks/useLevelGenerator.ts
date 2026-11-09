import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { generateLevel } from '@/utils/generator';
import { haptics, Haptics } from '@/utils/haptics';
import { formatTimeLeft } from '@/utils/date';
import { estimateLevelMs } from '@/utils/generationEstimate';
import { useGenerationTimes } from '@/store/generationTimes';
import { batchConfig, planTotal, type DifficultyKey, type GenerationBatch } from '@/utils/generationPlan';

export type { DifficultyKey, GenerationBatch };

/** Pause between two levels, for the Cancel button to be processed */
const YIELD_MS = 150;

/** Estimated time of one level of a batch on this phone, a minimum of moves chosen by the player included */
export function estimateBatchLevelMs(batch: GenerationBatch): number {
  return estimateLevelMs(batch.difficulty, batch.gridSize, useGenerationTimes.getState().samples) * batchConfig(batch).slowdown;
}

/** Estimated time of a whole generation, in seconds, learnt from the times measured on this phone */
export function estimateGenerationSeconds(plan: GenerationBatch[]): number {
  return plan.reduce((sum, b) => sum + (b.count * (estimateBatchLevelMs(b) + YIELD_MS)) / 1000, 0);
}

/** A generation time for the player: '45 s', then minutes and hours (an Expert batch takes hours, not '24000s') */
export function formatGenerationTime(seconds: number): string {
  return seconds < 60 ? `${Math.max(1, Math.round(seconds))} s` : formatTimeLeft(seconds * 1000);
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
 * Generates map levels one by one in the background, after the existing ones: the batches of the
 * plan one after the other (see utils/generationPlan.ts).
 * Progress and cancellation go through the store's generationState.
 * A level that could not be generated takes no id: it is tried again, a few times at most.
 */
export function startLevelGeneration(plan: GenerationBatch[]): void {
  const batches = plan.filter(b => b.count > 0);
  const amount = planTotal(batches);
  if (running || amount === 0) return;
  running = true;
  const { setGenerationState } = useGameStore.getState();
  const { recordLevelTime } = useGenerationTimes.getState();
  // Levels still to make: the rest of the batch going on, and the batches after it
  const estimate = (batchIndex: number, madeInBatch: number) => Math.ceil(estimateGenerationSeconds(
    batches.slice(batchIndex).map((b, i) => (i === 0 ? { ...b, count: b.count - madeInBatch } : b)),
  ));

  setGenerationState({
    isRunning: true,
    current: 0,
    total: amount,
    shouldCancel: false,
    estimatedRemainingSeconds: estimate(0, 0)
  });

  setTimeout(async () => {
    let made = 0;
    const cancelled = () => useGameStore.getState().generationState.shouldCancel;

    try {
      for (let batchIndex = 0; batchIndex < batches.length && !cancelled(); batchIndex++) {
        const { difficulty, gridSize, count } = batches[batchIndex];
        const { config, custom } = batchConfig(batches[batchIndex]);
        // A minimum of moves chosen by the player does not cost what the difficulty does: its times
        // are not learnt, they would skew the estimate of that difficulty without a minimum
        const learn = (ms: number) => { if (!custom) recordLevelTime(difficulty, gridSize, ms); };
        // Time spent since the last level made, failed tries included: what a level really costs
        let sinceLastLevel = 0;
        let madeInBatch = 0;
        // Failures are tried again, but a difficulty that keeps failing does not loop forever
        const maxTries = count * 2;

        try {
          for (let tries = 0; madeInBatch < count && tries < maxTries; tries++) {
            // Check cancel flag before each level
            if (cancelled()) break;

            const startTime = Date.now();
            // The id is taken when the level is ready: a failed one leaves no hole
            const newLevel = generateLevel(nextLevelId(), { ...config });
            sinceLastLevel += Date.now() - startTime;

            if (newLevel) {
              useGameStore.getState().addGeneratedLevel({ ...newLevel, id: nextLevelId() });
              made++;
              madeInBatch++;
              // The estimate learns from this phone: the next generations, and the rest of this one
              learn(sinceLastLevel);
              sinceLastLevel = 0;
            }

            setGenerationState({
              current: made,
              estimatedRemainingSeconds: estimate(batchIndex, madeInBatch),
            });

            // Yield to the JS event loop — lets the Cancel button press be processed.
            await new Promise(resolve => setTimeout(resolve, YIELD_MS));
          }
        } finally {
          // Tries that made no level (given up, cancelled): a level costs at least that, never counted as faster
          const samples = useGenerationTimes.getState().samples;
          if (sinceLastLevel > estimateLevelMs(difficulty, gridSize, samples)) learn(sinceLastLevel);
        }
      }
    } finally {
      running = false;
      setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
    }
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, 100);
}

/** Starts a generation (see startLevelGeneration) */
export function useLevelGenerator(): (plan: GenerationBatch[]) => void {
  return startLevelGeneration;
}
