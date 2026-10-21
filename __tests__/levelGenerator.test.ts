import { useGameStore } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { formatGenerationTime, isGenerationActive, startLevelGeneration } from '../hooks/useLevelGenerator';
import { resolveLevel } from '../utils/levelResolver';
import { resetStore } from './helpers';

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

describe('formatGenerationTime', () => {
  it('says seconds, then minutes and hours rather than thousands of seconds', () => {
    expect(formatGenerationTime(9.4)).toBe('9 s');
    expect(formatGenerationTime(90)).toBe('2 min');
    expect(formatGenerationTime(1500)).toBe('25 min');
    expect(formatGenerationTime(24000)).toBe('6 h');
  });
});
