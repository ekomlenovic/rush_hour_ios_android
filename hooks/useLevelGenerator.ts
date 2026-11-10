import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { DIFFICULTY_LEVELS } from '@/utils/generator';
import { generateMapLevelChunk } from '@/utils/mapGenerator';
import { runOnSolverRuntime } from '@/utils/solver.background';
import { canonicalKey } from '@/utils/levelShape';
import { haptics, Haptics } from '@/utils/haptics';
import { formatTimeLeft } from '@/utils/date';
import { estimateLevelMs } from '@/utils/generationEstimate';
import { useGenerationTimes } from '@/store/generationTimes';

export type DifficultyKey = keyof typeof DIFFICULTY_LEVELS;

/**
 * Calls of the generator in a row without a level before giving up: each one is about a second
 * of work on a phone (generateMapLevelChunk), a Master 8x8 level takes hundreds of them
 */
const MAX_EMPTY_CALLS = 1000;

/** Estimated time of a whole generation, in seconds, learnt from the times measured on this phone */
export function estimateGenerationSeconds({ amount, difficulty, gridSize }: GenerationRequest): number {
  const levelMs = estimateLevelMs(difficulty, gridSize, useGenerationTimes.getState().samples);
  return (amount * levelMs) / 1000;
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
 * Generates map levels one by one, after the existing ones, on the solver runtime: the app
 * stays usable meanwhile. The generator works in short calls (generateMapLevelChunk), Cancel is
 * read between two of them. Progress and cancellation go through the store's generationState.
 * A call that made no level takes no id: it is tried again, MAX_EMPTY_CALLS times in a row at most.
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
    // A difficulty that keeps giving nothing does not loop forever
    let emptyCalls = 0;
    // The levels of the map so far, up to a rotation or a mirror: the same one is never added twice
    // (Master 6x6 is so tight that the generator can come back to a board)
    const known = new Set([...sampleLevels, ...useGameStore.getState().generatedLevels].map(canonicalKey));

    try {
      while (made < amount && emptyCalls < MAX_EMPTY_CALLS) {
        // Cancel is read before each call
        const { shouldCancel } = useGameStore.getState().generationState;
        if (shouldCancel) break;

        const startTime = Date.now();
        const newLevel = await runOnSolverRuntime(generateMapLevelChunk, nextLevelId(), difficulty, gridSize);
        sinceLastLevel += Date.now() - startTime;

        const key = newLevel && canonicalKey(newLevel);
        if (!newLevel || !key || known.has(key)) {
          emptyCalls++;
          continue;
        }
        known.add(key);
        emptyCalls = 0;
        // The id is taken when the level is ready: a call without a level leaves no hole
        useGameStore.getState().addGeneratedLevel({ ...newLevel, id: nextLevelId() });
        made++;
        // The estimate learns from this phone: the next generations, and the rest of this one
        recordLevelTime(difficulty, gridSize, sinceLastLevel);
        sinceLastLevel = 0;

        setGenerationState({
          current: made,
          estimatedRemainingSeconds: estimate(amount - made),
        });
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
