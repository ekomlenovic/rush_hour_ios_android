import { buildCosmeticContext } from '../data/cosmetics';
import { useGameStore, DAILY_LEVEL_ID, isSaveForLevel } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { GENERATOR_MAX_STATES, solvePuzzle, getHint } from '../utils/solver';
import { checkWin, getMoveBounds, isLegalMove } from '../utils/collision';
import { resetStore, setToday } from './helpers';
import { getStars } from '../utils/scoring';
import { applyMoves } from '../utils/moveLog';

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

describe('isLegalMove: two vehicles dragged at once never overlap', () => {
  const car = (id: string, col: number) => ({ id, row: 0, col, length: 2, orientation: 'horizontal' as const, isTarget: false, color: '#000' });
  const board = [car('a', 0), car('b', 4)];

  it('lets a vehicle slide along its axis while the way is free', () => {
    expect(isLegalMove(board, 'a', 0, 2, 6)).toBe(true);
    expect(isLegalMove(board, 'b', 0, 2, 6)).toBe(true);
  });

  it('refuses the second of two drags ending on the same cells, a move off its axis, an unknown vehicle', () => {
    const afterA = board.map(v => (v.id === 'a' ? { ...v, col: 2 } : v));
    expect(isLegalMove(afterA, 'b', 0, 2, 6)).toBe(false);
    expect(isLegalMove(afterA, 'b', 0, 3, 6)).toBe(false);
    expect(isLegalMove(board, 'a', 1, 0, 6)).toBe(false);
    expect(isLegalMove(board, 'nope', 0, 0, 6)).toBe(false);
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

  it('a move through another vehicle is refused and changes nothing', () => {
    // A vehicle stopped by another one before the edge of the grid, moved past it
    const blocked = level.vehicles.find(v => {
      const { max } = getMoveBounds(v, level.vehicles, level.gridSize);
      return max < level.gridSize - v.length;
    })!;
    const { max } = getMoveBounds(blocked, level.vehicles, level.gridSize);
    const horizontal = blocked.orientation === 'horizontal';
    expect(state().moveVehicle(blocked.id, horizontal ? blocked.row : max + 1, horizontal ? max + 1 : blocked.col)).toBe(false);
    expect(state().moveCount).toBe(0);
    expect(state().vehicles).toEqual(level.vehicles);
    expect(state().moveVehicle(mover.id, mover.row, mover.col)).toBe(true);
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

describe('screen reader steps (issue 158)', () => {
  const level = sampleLevels[0];
  /** Steps one cell at a time from where the vehicle is to (row, col), as the adjustable does */
  function stepTo(vehicleId: string, row: number, col: number) {
    for (;;) {
      const v = state().vehicles.find(x => x.id === vehicleId)!;
      if (v.row === row && v.col === col) return;
      const next = v.orientation === 'horizontal' ? [v.row, v.col + Math.sign(col - v.col)] : [v.row + Math.sign(row - v.row), v.col];
      expect(state().moveVehicle(vehicleId, next[0], next[1], true)).toBe(true);
    }
  }
  /** A vehicle with room for `cells` cells forward, and where that leads */
  function roomy(cells: number) {
    const v = state().vehicles.find(x => {
      const b = getMoveBounds(x, state().vehicles, level.gridSize);
      return b.max - (x.orientation === 'horizontal' ? x.col : x.row) >= cells;
    })!;
    return v;
  }

  beforeEach(() => {
    resetStore();
    state().loadLevel(level);
  });

  it('of the same vehicle make one move, undone in one go', () => {
    const v = roomy(2);
    const horizontal = v.orientation === 'horizontal';
    stepTo(v.id, horizontal ? v.row : v.row + 2, horizontal ? v.col + 2 : v.col);
    expect(state().moveCount).toBe(1);
    expect(state().history).toHaveLength(1);
    expect(state().moveLog).toEqual([expect.objectContaining({ vehicleId: v.id, delta: 2 })]);
    state().undo();
    expect(state().vehicles.find(x => x.id === v.id)).toMatchObject({ row: v.row, col: v.col });
  });

  it('back where they started count no move', () => {
    const v = roomy(1);
    stepTo(v.id, v.orientation === 'horizontal' ? v.row : v.row + 1, v.orientation === 'horizontal' ? v.col + 1 : v.col);
    stepTo(v.id, v.row, v.col);
    expect(state().moveCount).toBe(0);
    expect(state().moveLog).toEqual([]);
    expect(state().history).toEqual([]);
  });

  it('of another vehicle, or after a drag, start a new move', () => {
    const { moves } = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
    stepTo(moves[0].vehicleId, moves[0].toRow, moves[0].toCol);
    stepTo(moves[1].vehicleId, moves[1].toRow, moves[1].toCol);
    expect(state().moveCount).toBe(2);
    // A drag between two steps of the same vehicle breaks the chain
    const v = state().vehicles.find(x => x.id === moves[1].vehicleId)!;
    const b = getMoveBounds(v, state().vehicles, level.gridSize);
    const cur = v.orientation === 'horizontal' ? v.col : v.row;
    const to = cur > b.min ? cur - 1 : cur + 1;
    const [row, col] = v.orientation === 'horizontal' ? [v.row, to] : [to, v.col];
    expect(state().moveVehicle(v.id, row, col)).toBe(true);
    expect(state().moveCount).toBe(3);
    stepTo(v.id, moves[1].toRow, moves[1].toCol);
    expect(state().moveCount).toBe(4);
  });

  it('play the optimal solution in as many moves as a drag: 3 stars', () => {
    const { moves } = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
    for (const m of moves) stepTo(m.vehicleId, m.toRow, m.toCol);
    expect(checkWin(state().vehicles, level.exitRow, level.exitCol, level.gridSize)).toBe(true);
    expect(state().moveCount).toBe(moves.length);
    expect(getStars(state().moveCount, level.minMoves)).toBe(3);
    expect(applyMoves(level, state().moveLog)).toMatchObject({ ok: true, won: true, moveCount: moves.length });
  });
});

describe('a move after the win (issue 168)', () => {
  it('is refused: the win is recorded once (two fingers)', () => {
    resetStore();
    const level = sampleLevels[0];
    const { moves } = solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
    state().loadLevel(level);
    for (const m of moves) expect(state().moveVehicle(m.vehicleId, m.toRow, m.toCol)).toBe(true);
    expect(checkWin(state().vehicles, level.exitRow, level.exitCol, level.gridSize)).toBe(true);
    state().completeLevel(level.id, 600, 3, 5000);
    const { vehicles, moveCount, moveLog } = state();
    // Any legal one-cell move of another vehicle, as a second finger released late
    const bounds = (x: typeof vehicles[number]) => getMoveBounds(x, state().vehicles, level.gridSize);
    const v = vehicles.find(x => !x.isTarget && bounds(x).max > bounds(x).min)!;
    const b = bounds(v);
    const cur = v.orientation === 'horizontal' ? v.col : v.row;
    const to = cur < b.max ? cur + 1 : cur - 1;
    const [row, col] = v.orientation === 'horizontal' ? [v.row, to] : [to, v.col];
    expect(isLegalMove(vehicles, v.id, row, col, level.gridSize)).toBe(true);
    expect(state().moveVehicle(v.id, row, col)).toBe(false);
    expect(state().vehicles).toBe(vehicles);
    expect(state().moveCount).toBe(moveCount);
    expect(state().moveLog).toBe(moveLog);
    expect(state().savedStates[level.id]).toBeUndefined();
    expect(state().stats.totalWins).toBe(1);
  });
});

describe('resetting the generated levels', () => {
  it('takes their progress, games in progress and map focus with them, nothing else', () => {
    resetStore();
    const base = sampleLevels.length;
    const generated = { ...level, id: base + 1 };
    useGameStore.setState({
      generatedLevels: [generated],
      progress: [{ levelId: 1, completed: true, bestScore: 300, stars: 3 }, { levelId: base + 1, completed: true, bestScore: 300, stars: 3 }],
      maxUnlockedLevel: base + 2,
      savedStates: {
        2: { vehicles: level.vehicles, moveCount: 1, history: [] },
        [base + 1]: { vehicles: level.vehicles, moveCount: 3, history: [] },
        'daily-2026-10-14': { vehicles: level.vehicles, moveCount: 2, history: [] },
      },
      lastPlayedLevelId: base + 1,
    });
    state().purgeCustomLevels(base);
    expect(state().generatedLevels).toEqual([]);
    expect(state().progress.map(p => p.levelId)).toEqual([1]);
    expect(state().maxUnlockedLevel).toBe(base + 1);
    expect(Object.keys(state().savedStates).sort()).toEqual(['2', 'daily-2026-10-14']);
    expect(state().lastPlayedLevelId).toBeNull();
  });

  it('keeps the progress of created and imported levels (issue 160)', () => {
    resetStore();
    const base = sampleLevels.length;
    const created = { ...level, id: 1760000000000, name: 'Créé' };
    const imported = { ...level, id: 1760000000001, name: 'Importé' };
    useGameStore.setState({
      generatedLevels: [{ ...level, id: base + 1 }],
      createdLevels: [created],
      importedLevels: [imported],
      progress: [
        { levelId: 0, completed: true, bestScore: 300, stars: 3 },
        { levelId: 1, completed: true, bestScore: 300, stars: 3 },
        { levelId: base + 1, completed: true, bestScore: 300, stars: 3 },
        { levelId: created.id, completed: true, bestScore: 300, stars: 3 },
        { levelId: imported.id, completed: true, bestScore: 300, stars: 3 },
      ],
    });
    state().purgeCustomLevels(base);
    expect(state().progress.map(p => p.levelId)).toEqual([0, 1, created.id, imported.id]);
    expect(buildCosmeticContext(state()).totalStars).toBe(12);
  });
});
