import { useGameStore } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { estimateGenerationSeconds, formatGenerationTime, isGenerationActive, startLevelGeneration } from '../hooks/useLevelGenerator';
import { buildGenerationPlan } from '../utils/generationPlan';
import { resolveLevel } from '../utils/levelResolver';
import { resetStore } from './helpers';
import { useGenerationTimes } from '../store/generationTimes';
import { estimateLevelMs, sampleKey } from '../utils/generationEstimate';
import { transformLevel } from '../utils/generator';

// A generation of which one call out of three gives no level, instantly
let mockCalls = 0;
/** What the generator was asked, call after call */
const mockAsked: { difficulty: string; gridSize: number; minMoves: number }[] = [];
/** Levels the generator gives next, before its own */
let mockNext: unknown[] = [];
jest.mock('../utils/mapGenerator', () => ({
  ...jest.requireActual('../utils/mapGenerator'),
  generateMapLevelChunk: (id: number, difficulty: string, gridSize: number, minMoves: number) => {
    mockCalls++;
    mockAsked.push({ difficulty, gridSize, minMoves });
    if (mockNext.length) return mockNext.shift();
    if (mockCalls % 3 === 2) return null;
    // A different board each time: two cars whose places count the calls
    return {
      id, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 1, updatedAt: 0,
      vehicles: [
        { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: '#f00' },
        { id: 'a', row: 0, col: mockCalls % 5, length: 2, orientation: 'horizontal', isTarget: false, color: '#0f0' },
        { id: 'b', row: 5, col: Math.floor(mockCalls / 5) % 4, length: 3, orientation: 'horizontal', isTarget: false, color: '#00f' },
      ],
    };
  },
}));

const state = () => useGameStore.getState();
const base = sampleLevels.length;

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  useGenerationTimes.setState({ samples: {} });
  mockCalls = 0;
  mockAsked.length = 0;
  mockNext = [];
});

afterEach(async () => {
  // A generation left going on by a test would refuse the next one
  await jest.runAllTimersAsync();
  jest.useRealTimers();
});

describe('map levels generation (issue 120)', () => {
  it('numbers the levels after the pack without holes, a call without a level taking no id', async () => {
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

  it('never adds a level the map already has, even rotated or mirrored', async () => {
    startLevelGeneration([{ difficulty: 'NORMAL', gridSize: 6, count: 2 }]);
    await jest.runAllTimersAsync();
    const [first, second] = state().generatedLevels;
    // The generator comes back to the first board, mirrored, then to a new one
    const mirrored = transformLevel(first, 2);
    const fresh = { ...second, vehicles: second.vehicles.map(v => (v.id === 'a' ? { ...v, row: 1 } : v)) };
    mockNext = [mirrored, first, fresh];
    const before = mockCalls;
    startLevelGeneration([{ difficulty: 'NORMAL', gridSize: 6, count: 1 }]);
    await jest.runAllTimersAsync();
    expect(mockCalls - before).toBe(3);
    expect(state().generatedLevels.map(l => l.id)).toEqual([base + 1, base + 2, base + 3]);
    expect(state().generatedLevels[2].vehicles).toEqual(fresh.vehicles);
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
    const expected = Math.ceil((3 * (estimateLevelMs('NORMAL', 8, useGenerationTimes.getState().samples))) / 1000);
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
    expect(seconds).toBeCloseTo((2 * estimateLevelMs('EASY', 6, samples) + estimateLevelMs('HARD', 7, samples)) / 1000);
  });

  it('asks the generator for the minimum of moves chosen for a difficulty, without learning its times', async () => {
    startLevelGeneration(buildGenerationPlan(4, { EASY: 1, NORMAL: 0, HARD: 1, EXPERT: 0, MASTER: 0 }, { 6: 0, 7: 1, 8: 0 }, { HARD: 20 }));
    // Hard from 20 moves: 6 of the 11 usual numbers of moves left, a level counted that much longer to find
    const expected = 2 * estimateLevelMs('EASY', 7, {}) + 2 * estimateLevelMs('HARD', 7, {}) * (11 / 6);
    expect(state().generationState.estimatedRemainingSeconds).toBe(Math.ceil(expected / 1000));
    await jest.runAllTimersAsync();
    expect(state().generatedLevels).toHaveLength(4);
    // Easy as usual; Hard with its own boards, from 20 moves, longer levels kept
    expect(mockAsked.filter(a => a.difficulty === 'EASY').every(a => a.minMoves === 0)).toBe(true);
    const hard = mockAsked.filter(a => a.difficulty === 'HARD');
    expect(hard.length).toBeGreaterThan(0);
    for (const asked of hard) expect(asked).toEqual({ difficulty: 'HARD', gridSize: 7, minMoves: 20 });
    expect(Object.keys(useGenerationTimes.getState().samples)).toEqual([sampleKey('EASY', 7)]);
  });

  it('starts nothing for an empty plan', () => {
    startLevelGeneration([]);
    expect(isGenerationActive()).toBe(false);
    expect(state().generationState.isRunning).toBe(false);
  });
});

describe('generation times of the former generator', () => {
  it('are dropped: the new generator is far faster, they would announce minutes and ask to confirm', () => {
    const migrate = useGenerationTimes.persist.getOptions().migrate!;
    const former = { samples: { [sampleKey('NORMAL', 8)]: { avgMs: 300_000, count: 5, maxMs: 400_000 } } };
    expect(migrate(former, 1)).toEqual({ samples: {} });
    expect(migrate(former, 2)).toEqual(former);
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
