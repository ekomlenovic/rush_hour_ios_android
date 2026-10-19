import { useGameStore, DAILY_LEVEL_ID, isSaveForLevel } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { GENERATOR_MAX_STATES, solvePuzzle, getHint } from '../utils/solver';
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

  it('a board that cannot be won is not solvable', () => {
    // The red car on row 2, two trucks filling the column in front of it
    const blocked = [
      { ...level.vehicles.find(v => v.isTarget)!, row: 2, col: 0, length: 2, orientation: 'horizontal' as const },
      { id: 'a', row: 0, col: 4, length: 3, orientation: 'vertical' as const, isTarget: false, color: '#000' },
      { id: 'b', row: 3, col: 4, length: 3, orientation: 'vertical' as const, isTarget: false, color: '#000' },
    ];
    expect(solvePuzzle(blocked, 6, 2, 6)).toEqual({ solvable: false, minMoves: -1, moves: [] });
  });

  it('gives up past the positions it may go through (generator: GENERATOR_MAX_STATES)', () => {
    const l = sampleLevels[300];
    expect(solvePuzzle(l.vehicles, l.gridSize, l.exitRow, l.exitCol, 200, 100)).toEqual({ solvable: false, minMoves: -1, moves: [], tooComplex: true });
    expect(solvePuzzle(l.vehicles, l.gridSize, l.exitRow, l.exitCol, 200, GENERATOR_MAX_STATES).minMoves).toBe(l.minMoves);
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

describe('isSaveForLevel', () => {
  it('accepts the level moved along its lanes', () => {
    const moved = level.vehicles.map(v => (v.id === mover.id
      ? (v.orientation === 'horizontal' ? { ...v, col: v.col === 0 ? 1 : 0 } : { ...v, row: v.row === 0 ? 1 : 0 })
      : v));
    expect(isSaveForLevel(level, { vehicles: moved })).toBe(true);
  });

  it('refuses another puzzle or a vehicle off its lane', () => {
    expect(isSaveForLevel(level, { vehicles: sampleLevels[5].vehicles })).toBe(false);
    const offLane = level.vehicles.map(v => (v.id === mover.id
      ? (v.orientation === 'horizontal' ? { ...v, row: (v.row + 1) % level.gridSize } : { ...v, col: (v.col + 1) % level.gridSize })
      : v));
    expect(isSaveForLevel(level, { vehicles: offLane })).toBe(false);
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

  it("never replays the save of another puzzle of the same day: the puzzle starts fresh", () => {
    useGameStore.setState({ dailyLevelDate: '2026-10-14' });
    // Saved on another version of the day's puzzle (other generator, cache miss)
    const other = sampleLevels[5];
    useGameStore.setState({
      savedStates: { 'daily-2026-10-14': { vehicles: other.vehicles, moveCount: 2, history: [other.vehicles, other.vehicles] } },
    });
    const daily = { ...level, id: DAILY_LEVEL_ID };
    state().loadLevel(daily);
    expect(state().vehicles).toEqual(daily.vehicles);
    expect(state().moveCount).toBe(0);
    expect(state().savedStates['daily-2026-10-14']).toBeUndefined();
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
