import { useGameStore } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { estimateGenerationSeconds, formatGenerationTime, isGenerationActive, startLevelGeneration } from '../hooks/useLevelGenerator';
import { buildGenerationPlan } from '../utils/generationPlan';
import { resolveLevel } from '../utils/levelResolver';
import { resetStore } from './helpers';
import { useGenerationTimes } from '../store/generationTimes';
import { estimateLevelMs, sampleKey } from '../utils/generationEstimate';

// A generation that fails one level out of three, instantly
let mockCalls = 0;
const mockConfigs: { minMovesRequired: number; maxMovesRequired: number; minVehicles: number; gridSize: number }[] = [];
jest.mock('../utils/generator', () => ({
  ...jest.requireActual('../utils/generator'),
  generateLevel: (id: number, config: typeof mockConfigs[number]) => {
    mockCalls++;
    mockConfigs.push(config);
    return mockCalls % 3 === 2 ? null : { ...jest.requireActual('../data/sampleLevels').sampleLevels[0], id };
  },
}));

const state = () => useGameStore.getState();
const base = sampleLevels.length;

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  useGenerationTimes.setState({ samples: {} });
  mockCalls = 0;
  mockConfigs.length = 0;
});

afterEach(async () => {
  // A generation left going on by a test would refuse the next one
  await jest.runAllTimersAsync();
  jest.useRealTimers();
});

describe('map levels generation (issue 120)', () => {
  it('numbers the levels after the pack without holes, a failed level taking no id', async () => {
    startLevelGeneration([{ difficulty: 'NORMAL', gridSize: 6, count: 4 }]);
    expect(isGenerationActive()).toBe(true);
    await jest.runAllTimersAsync();
    expect(state().generatedLevels.map(l => l.id)).toEqual([base + 1, base + 2, base + 3, base + 4]);
    expect(state().generationState).toMatchObject({ isRunning: false, current: 4 });
    expect(isGenerationActive()).toBe(false);

    // Every level unlocks the next one
    for (const level of state().generatedLevels) {
      useGameStore.setState({ maxUnlockedLevel: Math.max(state().maxUnlockedLevel, level.id) });
      state().completeLevel(level.id, 300, 3);
    }
    expect(state().maxUnlockedLevel).toBe(base + 5);
  });

  it('runs one generation at a time', async () => {
    startLevelGeneration([{ difficulty: 'NORMAL', gridSize: 6, count: 2 }]);
    startLevelGeneration([{ difficulty: 'NORMAL', gridSize: 6, count: 2 }]);
    await jest.runAllTimersAsync();
    expect(state().generatedLevels.map(l => l.id)).toEqual([base + 1, base + 2]);
  });

  it('a link to a map level not generated yet opens nothing: never generated on the fly, with a hole before it', async () => {
    const pending = resolveLevel({ levelId: String(base + 10) });
    await jest.runAllTimersAsync();
    expect(await pending).toBeNull();
    expect(mockCalls).toBe(0);
    expect(state().generatedLevels).toEqual([]);
  });
});

describe('generation times learnt on the phone (issue 162)', () => {
  it('records one time per level made, for its difficulty and grid size', async () => {
    startLevelGeneration([{ difficulty: 'HARD', gridSize: 7, count: 4 }]);
    await jest.runAllTimersAsync();
    const samples = useGenerationTimes.getState().samples;
    expect(Object.keys(samples)).toEqual([sampleKey('HARD', 7)]);
    expect(samples[sampleKey('HARD', 7)].count).toBe(4);
    // Instant levels here: the estimate of Hard 7x7 drops below the table, and so does the progress pill's
    expect(estimateLevelMs('HARD', 7, samples)).toBeLessThan(estimateLevelMs('HARD', 7, {}));
  });

  it('starts the progress pill from the learnt estimate', () => {
    useGenerationTimes.setState({ samples: { [sampleKey('NORMAL', 8)]: { avgMs: 2000, count: 20, maxMs: 2500 } } });
    startLevelGeneration([{ difficulty: 'NORMAL', gridSize: 8, count: 3 }]);
    const expected = Math.ceil((3 * (estimateLevelMs('NORMAL', 8, useGenerationTimes.getState().samples) + 150)) / 1000);
    expect(state().generationState.estimatedRemainingSeconds).toBe(expected);
    expect(expected).toBeLessThan(60);
  });
});

describe('a mix of difficulties and grid sizes', () => {
  it('makes the batches of the plan one after the other, numbered in a row', async () => {
    const plan = buildGenerationPlan(6, { EASY: 1, NORMAL: 2, HARD: 0, EXPERT: 0, MASTER: 0 }, { 6: 1, 7: 1, 8: 0 });
    startLevelGeneration(plan);
    expect(state().generationState.total).toBe(6);
    await jest.runAllTimersAsync();
    expect(state().generatedLevels.map(l => l.id)).toEqual([1, 2, 3, 4, 5, 6].map(i => base + i));
    expect(state().generationState).toMatchObject({ isRunning: false, current: 6 });
    // One measure per level made, for the combination it was made with
    const samples = useGenerationTimes.getState().samples;
    for (const batch of plan) expect(samples[sampleKey(batch.difficulty, batch.gridSize)].count).toBe(batch.count);
  });

  it('adds up the estimate of every batch', () => {
    const samples = useGenerationTimes.getState().samples;
    const seconds = estimateGenerationSeconds([
      { difficulty: 'EASY', gridSize: 6, count: 2 },
      { difficulty: 'HARD', gridSize: 7, count: 1 },
    ]);
    expect(seconds).toBeCloseTo((2 * (estimateLevelMs('EASY', 6, samples) + 150) + estimateLevelMs('HARD', 7, samples) + 150) / 1000);
  });

  it('asks the generator for the minimum of moves typed by the player, without learning its times', async () => {
    startLevelGeneration(buildGenerationPlan(2, { EASY: 1, NORMAL: 0, HARD: 0, EXPERT: 0, MASTER: 0 }, { 6: 0, 7: 1, 8: 0 }, 20));
    // Estimated as Hard, the first difficulty that reaches 20 moves
    expect(state().generationState.estimatedRemainingSeconds).toBe(Math.ceil((2 * (estimateLevelMs('HARD', 7, {}) + 150)) / 1000));
    await jest.runAllTimersAsync();
    expect(state().generatedLevels).toHaveLength(2);
    for (const config of mockConfigs) expect(config).toMatchObject({ gridSize: 7, minMovesRequired: 20, maxMovesRequired: 25, minVehicles: 10 });
    expect(useGenerationTimes.getState().samples).toEqual({});
  });

  it('starts nothing for an empty plan', () => {
    startLevelGeneration([]);
    expect(isGenerationActive()).toBe(false);
    expect(state().generationState.isRunning).toBe(false);
  });
});

describe('formatGenerationTime', () => {
  it('says seconds, then minutes and hours rather than thousands of seconds', () => {
    expect(formatGenerationTime(9.4)).toBe('9 s');
    expect(formatGenerationTime(90)).toBe('2 min');
    expect(formatGenerationTime(1500)).toBe('25 min');
    expect(formatGenerationTime(24000)).toBe('6 h');
  });
});
