import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addSample, type GenerationSamples } from '@/utils/generationEstimate';

/**
 * Times measured on this phone to generate map levels (issue 162), for the estimate shown
 * before generating (utils/generationEstimate.ts).
 * Kept apart from the game store on purpose: they describe the phone, not the player's
 * progress. An exported save (.rushsave) never carries them, and losing them only brings
 * the estimate back to the table.
 */
interface GenerationTimesState {
  samples: GenerationSamples;
  /** One more level generated (or given up) in this time */
  recordLevelTime: (difficulty: string, gridSize: number, ms: number) => void;
}

export const useGenerationTimes = create<GenerationTimesState>()(
  persist(
    (set) => ({
      samples: {},
      recordLevelTime: (difficulty, gridSize, ms) =>
        set(state => ({ samples: addSample(state.samples, difficulty, gridSize, ms) })),
    }),
    {
      name: 'rush-hours-generation-times',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ samples: state.samples }),
    },
  ),
);
