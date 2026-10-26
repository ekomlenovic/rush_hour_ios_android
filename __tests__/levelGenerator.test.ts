import { useGameStore } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { formatGenerationTime, isGenerationActive, startLevelGeneration } from '../hooks/useLevelGenerator';
import { resolveLevel } from '../utils/levelResolver';
import { resetStore } from './helpers';
import { useGenerationTimes } from '../store/generationTimes';
import { estimateLevelMs, sampleKey } from '../utils/generationEstimate';

// A generation that fails one level out of three, instantly
let mockCalls = 0;
jest.mock('../utils/generator', () => ({
  ...jest.requireActual('../utils/generator'),
  generateLevel: (id: number) => {
    mockCalls++;
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
});

afterEach(() => {
  jest.useRealTimers();
});

describe('map levels generation (issue 120)', () => {
  it('numbers the levels after the pack without holes, a failed level taking no id', async () => {
    startLevelGeneration({ amount: 4, difficulty: 'NORMAL', gridSize: 6 });
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
    startLevelGeneration({ amount: 2, difficulty: 'NORMAL', gridSize: 6 });
    startLevelGeneration({ amount: 2, difficulty: 'NORMAL', gridSize: 6 });
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
    startLevelGeneration({ amount: 4, difficulty: 'HARD', gridSize: 7 });
    await jest.runAllTimersAsync();
    const samples = useGenerationTimes.getState().samples;
    expect(Object.keys(samples)).toEqual([sampleKey('HARD', 7)]);
    expect(samples[sampleKey('HARD', 7)].count).toBe(4);
    // Instant levels here: the estimate of Hard 7x7 drops below the table, and so does the progress pill's
    expect(estimateLevelMs('HARD', 7, samples)).toBeLessThan(estimateLevelMs('HARD', 7, {}));
  });

  it('starts the progress pill from the learnt estimate', () => {
    useGenerationTimes.setState({ samples: { [sampleKey('NORMAL', 8)]: { avgMs: 2000, count: 20, maxMs: 2500 } } });
    startLevelGeneration({ amount: 3, difficulty: 'NORMAL', gridSize: 8 });
    const expected = Math.ceil((3 * (estimateLevelMs('NORMAL', 8, useGenerationTimes.getState().samples) + 150)) / 1000);
    expect(state().generationState.estimatedRemainingSeconds).toBe(expected);
    expect(expected).toBeLessThan(60);
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
