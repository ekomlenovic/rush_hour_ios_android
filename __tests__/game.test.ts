import { useGameStore, DAILY_LEVEL_ID } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { solvePuzzle, getHint } from '../utils/solver';
import { checkWin } from '../utils/collision';
import { resetStore, setToday } from './helpers';

const state = () => useGameStore.getState();
const level = sampleLevels[0];
const mover = level.vehicles.find(v => !v.isTarget)!;

describe('solver', () => {
  // A sample of the campaign across its difficulty (some levels take seconds to solve)
  it.each([1, 51, 101, 201, 251, 301].map(id => [id, sampleLevels[id - 1]] as const))(
    'finds the announced optimum of level %i',
    (_, l) => {
      const result = solvePuzzle(l.vehicles, l.gridSize, l.exitRow, l.exitCol);
      expect(result.solvable).toBe(true);
      expect(result.minMoves).toBe(l.minMoves);
      expect(result.moves).toHaveLength(l.minMoves);
    },
  );

  it('the optimal moves really win', () => {
    let vehicles = level.vehicles;
    for (const move of solvePuzzle(vehicles, level.gridSize, level.exitRow, level.exitCol).moves) {
      expect(checkWin(vehicles, level.exitRow, level.exitCol, level.gridSize)).toBe(false);
      vehicles = vehicles.map(v => (v.id === move.vehicleId ? { ...v, row: move.toRow, col: move.toCol } : v));
    }
    expect(checkWin(vehicles, level.exitRow, level.exitCol, level.gridSize)).toBe(true);
  });

  it('a hint is the first optimal move', () => {
    const result = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
    expect(getHint(level.vehicles, level.gridSize, level.exitRow, level.exitCol)).toEqual(result.moves[0]);
  });
});

describe('map levels: training mode (rules in docs/GAME_DESIGN.md)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
    setToday('2026-10-14');
    state().loadLevel(level);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('undo counts as a move', () => {
    state().moveVehicle(mover.id, mover.row, mover.col);
    state().undo();
    expect(state().moveCount).toBe(2);
    expect(state().vehicles).toEqual(level.vehicles);
    expect(state().currentAttempt.undos).toBe(1);
  });

  it('reset puts the move counter back to zero but keeps the attempt', () => {
    state().moveVehicle(mover.id, mover.row, mover.col);
    state().recordHintUsed();
    state().resetLevel();
    expect(state().moveCount).toBe(0);
    expect(state().history).toEqual([]);
    expect(state().currentAttempt).toMatchObject({ hints: 1, resets: 1 });
  });

  it('the progress survives leaving the level', () => {
    state().moveVehicle(mover.id, mover.row, mover.col);
    state().recordHintUsed();
    state().addPlayTime(4_000);
    state().loadLevel(sampleLevels[1]);
    state().loadLevel(level);
    expect(state().moveCount).toBe(1);
    expect(state().currentAttempt).toMatchObject({ hints: 1, elapsedMs: 4_000 });
  });

  it('keeps the best score and stars, and unlocks the next level', () => {
    state().completeLevel(level.id, 300, 3, 10_000);
    state().loadLevel(level);
    state().completeLevel(level.id, 100, 1, 5_000);
    const progress = state().progress.find(p => p.levelId === level.id)!;
    expect(progress).toMatchObject({ bestScore: 300, stars: 3, bestTimeMs: 5_000 });
    expect(state().maxUnlockedLevel).toBe(level.id + 1);
    expect(state().savedStates[level.id]).toBeUndefined();
  });
});

describe('daily challenge in the store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
    setToday('2026-10-14');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('progress is saved per day and resumed with the same move count', () => {
    useGameStore.setState({ dailyLevelDate: '2026-10-14' });
    const daily = { ...level, id: DAILY_LEVEL_ID };
    state().loadLevel(daily);
    state().moveVehicle(mover.id, mover.row, mover.col);
    expect(state().savedStates['daily-2026-10-14']?.moveCount).toBe(1);

    state().loadLevel(sampleLevels[1]);
    state().loadLevel(daily);
    expect(state().moveCount).toBe(1);
  });

  it('does not affect the map progression', () => {
    state().completeDailyChallenge('2026-10-14', 300, 3);
    expect(state().maxUnlockedLevel).toBe(1);
    expect(state().progress).toEqual([]);
    expect(state().dailyChallengeProgress['2026-10-14']).toMatchObject({ completed: true, stars: 3 });
  });

  it('keeps the best result when completed twice', () => {
    state().completeDailyChallenge('2026-10-14', 300, 3, 60_000, { moves: 12, minMoves: 12 });
    state().completeDailyChallenge('2026-10-14', 100, 1, 30_000, { moves: 20, minMoves: 12 });
    expect(state().dailyChallengeProgress['2026-10-14']).toEqual({ completed: true, score: 300, stars: 3, timeMs: 30_000, moves: 12, minMoves: 12 });
  });
});

describe('hardReset', () => {
  it('erases the progression and the stats', () => {
    jest.useFakeTimers();
    resetStore();
    setToday('2026-10-14');
    state().completeDailyChallenge('2026-10-14', 300, 3);
    state().addStreakFreeze();
    state().hardReset();
    const s = state();
    expect(s).toMatchObject({ currentStreak: 0, bestStreak: 0, streakFreezes: 0, achievements: [], dailyChallengeProgress: {}, dailyMissions: null });
    expect(s.stats).toEqual(useGameStore.getInitialState().stats);
    jest.useRealTimers();
  });
});
