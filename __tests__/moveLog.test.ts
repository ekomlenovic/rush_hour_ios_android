import * as fs from 'fs';
import * as path from 'path';
import { useGameStore, Level, MoveRecord, Vehicle } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';
import { solvePuzzle } from '../utils/solver';
import { applyMoves, diffMove, toMoveRecord } from '../utils/moveLog';
import { DIFFICULTY_LEVELS, generateDailyLevel, generateSeededLevelSync } from '../utils/generator';
import { DAILY_LEVEL_ID } from '../store/levelIds';
import { resetStore, setToday } from './helpers';

const state = () => useGameStore.getState();
const level = sampleLevels[0];

/** The optimal solution of a level as a move log, one second per move */
function optimalLog(l: Level): MoveRecord[] {
  let vehicles: Vehicle[] = l.vehicles;
  return solvePuzzle(l.vehicles, l.gridSize, l.exitRow, l.exitCol).moves.map((move, i) => {
    const vehicle = vehicles.find(v => v.id === move.vehicleId)!;
    vehicles = vehicles.map(v => (v.id === move.vehicleId ? { ...v, row: move.toRow, col: move.toCol } : v));
    return toMoveRecord(vehicle, move.toRow, move.toCol, (i + 1) * 1000)!;
  });
}

/** A vehicle that can slide by `delta` from the start position, with that move */
function freeMove(l: Level, delta: 1 | -1): MoveRecord {
  const vehicles = l.vehicles;
  for (const v of vehicles.filter(x => !x.isTarget)) {
    const record: MoveRecord = { vehicleId: v.id, delta, t: 0 };
    if (applyMoves(l, [record]).ok) return record;
  }
  throw new Error('no free vehicle');
}

describe('move records', () => {
  const horizontal: Vehicle = { id: 'h', row: 2, col: 1, length: 2, orientation: 'horizontal', isTarget: false, color: '#000' };
  const vertical: Vehicle = { ...horizontal, id: 'v', orientation: 'vertical' };

  it('is a slide along the axis of the vehicle, right / down positive', () => {
    expect(toMoveRecord(horizontal, 2, 3, 500)).toEqual({ vehicleId: 'h', delta: 2, t: 500 });
    expect(toMoveRecord(vertical, 0, 1, 0)).toEqual({ vehicleId: 'v', delta: -2, t: 0 });
  });

  it('is null when the vehicle does not move along its axis', () => {
    expect(toMoveRecord(horizontal, 2, 1, 0)).toBeNull();
    expect(toMoveRecord(horizontal, 3, 1, 0)).toBeNull();
  });

  it('the difference between two positions is the move between them', () => {
    const moved = [{ ...horizontal, col: 4 }, vertical];
    expect(diffMove([horizontal, vertical], moved, 10)).toEqual({ vehicleId: 'h', delta: 3, t: 10 });
    expect(diffMove(moved, [horizontal, vertical], 20)).toEqual({ vehicleId: 'h', delta: -3, t: 20 });
    expect(diffMove(moved, moved, 0)).toBeNull();
  });
});

describe('applyMoves: replays a move log with the rules of the game', () => {
  it.each([1, 101, 251].map(id => [id, sampleLevels[id - 1]] as const))(
    'the optimal solution of level %i wins in its minimum number of moves',
    (_, l) => {
      const result = applyMoves(l, optimalLog(l));
      expect(result).toMatchObject({ ok: true, won: true, moveCount: l.minMoves });
    },
  );

  it('an unfinished game is not a win', () => {
    const log = optimalLog(level).slice(0, -1);
    expect(applyMoves(level, log)).toMatchObject({ ok: true, won: false, moveCount: log.length });
  });

  it('does not change the level', () => {
    const before = JSON.stringify(level);
    applyMoves(level, optimalLog(level));
    expect(JSON.stringify(level)).toBe(before);
  });

  it('refuses a move through another vehicle or out of the grid', () => {
    const [first] = optimalLog(level);
    const result = applyMoves(level, [{ ...first, delta: first.delta + 10 * Math.sign(first.delta) }]);
    expect(result).toEqual({ ok: false, error: 'blocked', index: 0 });
  });

  it('refuses an unknown vehicle', () => {
    expect(applyMoves(level, [{ vehicleId: 'nope', delta: 1, t: 0 }])).toEqual({ ok: false, error: 'unknown_vehicle', index: 0 });
  });

  it.each([
    ['a zero slide', { delta: 0 }],
    ['a slide that is not a whole number of cells', { delta: 0.5 }],
    ['a negative time', { t: -1 }],
    ['a time that is not a number', { t: Number.NaN }],
  ])('refuses %s', (_, patch) => {
    const move = { ...freeMove(level, 1), ...patch } as MoveRecord;
    expect(applyMoves(level, [move])).toEqual({ ok: false, error: 'invalid_move', index: 0 });
  });

  it('refuses malformed entries', () => {
    expect(applyMoves(level, [null as unknown as MoveRecord])).toEqual({ ok: false, error: 'invalid_move', index: 0 });
    expect(applyMoves(level, [{ vehicleId: 3, delta: 1, t: 0 } as unknown as MoveRecord])).toMatchObject({ ok: false, error: 'invalid_move' });
  });

  it('refuses times that go backwards', () => {
    const move = freeMove(level, 1);
    const back = { ...move, delta: -1 };
    expect(applyMoves(level, [{ ...move, t: 2000 }, { ...back, t: 1000 }])).toEqual({ ok: false, error: 'time_backwards', index: 1 });
    expect(applyMoves(level, [{ ...move, t: 1000 }, { ...back, t: 1000 }]).ok).toBe(true);
  });

  it('refuses any move once the target car is out', () => {
    const log = optimalLog(level);
    const extra = { ...log[0], t: log[log.length - 1].t + 1 };
    expect(applyMoves(level, [...log, extra])).toEqual({ ok: false, error: 'move_after_win', index: log.length });
  });
});

describe('move log of the game', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
    setToday('2026-10-14');
    state().loadLevel(level);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Plays a move of the log on the board, `ms` after the previous one */
  const play = (move: MoveRecord, ms = 1000) => {
    jest.advanceTimersByTime(ms);
    const v = state().vehicles.find(x => x.id === move.vehicleId)!;
    const horizontal = v.orientation === 'horizontal';
    state().moveVehicle(v.id, horizontal ? v.row : v.row + move.delta, horizontal ? v.col + move.delta : v.col);
  };

  it('records each move with its time since the start of the attempt', () => {
    const log = optimalLog(level).slice(0, 3);
    log.forEach(m => play(m, 1500));
    expect(state().moveLog).toEqual(log.map((m, i) => ({ ...m, t: (i + 1) * 1500 })));
  });

  it('replays to the position on the board, with the move counter as its number of moves', () => {
    const log = optimalLog(level);
    log.slice(0, 2).forEach(m => play(m));
    state().undo();
    play(log[2] ?? log[0]);
    const result = applyMoves(level, state().moveLog);
    expect(result).toMatchObject({ ok: true, moveCount: state().moveCount });
    expect(result.ok && result.vehicles).toEqual(state().vehicles);
  });

  it('an undo adds the opposite move', () => {
    const move = freeMove(level, 1);
    play(move);
    jest.advanceTimersByTime(500);
    state().undo();
    expect(state().moveLog).toEqual([{ ...move, t: 1000 }, { ...move, delta: -move.delta, t: 1500 }]);
  });

  it('a reset starts a new log, times still from the start of the attempt', () => {
    const move = freeMove(level, 1);
    play(move);
    state().resetLevel();
    expect(state().moveLog).toEqual([]);
    play(move);
    expect(state().moveLog).toEqual([{ ...move, t: 2000 }]);
  });

  it('is saved with the level and restored when coming back', () => {
    const move = freeMove(level, 1);
    play(move);
    state().loadLevel(sampleLevels[1]);
    jest.advanceTimersByTime(60_000);
    state().loadLevel(level);
    expect(state().moveLog).toEqual([{ ...move, t: 1000 }]);
    play(move.delta > 0 ? { ...move, delta: -1 } : { ...move, delta: 1 });
    expect(state().moveLog[1].t).toBe(62_000);
  });

  it('a save from before the move log starts an empty one', () => {
    const key = String(level.id);
    useGameStore.setState({ savedStates: { [key]: { vehicles: level.vehicles, moveCount: 4, history: [] } } });
    state().loadLevel(level);
    expect(state().moveLog).toEqual([]);
    expect(state().attemptStartedAt).toBe(Date.now());
  });
});

describe('seeded generation', () => {
  it('always gives the same level for a seed', () => {
    const a = generateSeededLevelSync('server-secret-2026-10-16', 1, DIFFICULTY_LEVELS.EASY);
    const b = generateSeededLevelSync('server-secret-2026-10-16', 1, DIFFICULTY_LEVELS.EASY);
    expect(a).not.toBeNull();
    expect({ ...a!, updatedAt: 0 }).toEqual({ ...b!, updatedAt: 0 });
  });

  it('is the generator of the daily challenge', async () => {
    const daily = (await generateDailyLevel('2026-10-14'))!;
    const seeded = generateSeededLevelSync('2026-10-14', DAILY_LEVEL_ID, DIFFICULTY_LEVELS.NORMAL)!;
    expect({ ...seeded, updatedAt: 0 }).toEqual({ ...daily, updatedAt: 0 });
  });
});

describe('game logic runs without React Native (multiplayer server, #46)', () => {
  const root = path.resolve(__dirname, '..');
  const CORE = ['utils/generator.core.ts', 'utils/solver.ts', 'utils/collision.ts', 'utils/moveLog.ts'];

  /** Every file reached from a module through its imports, and the packages it imports */
  function importGraph(entry: string) {
    const files = new Set<string>();
    const packages = new Set<string>();
    const visit = (file: string) => {
      if (files.has(file)) return;
      files.add(file);
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      for (const [, spec] of source.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gm)) {
        if (!spec.startsWith('.')) { packages.add(spec); continue; }
        const resolved = path.relative(root, path.resolve(path.dirname(path.join(root, file)), spec));
        visit(fs.existsSync(path.join(root, `${resolved}.ts`)) ? `${resolved}.ts` : `${resolved}/index.ts`);
      }
    };
    visit(entry);
    return { files: [...files], packages: [...packages] };
  }

  it.each(CORE)('%s imports no package and stays out of the store', (entry) => {
    const { files, packages } = importGraph(entry);
    expect(packages).toEqual([]);
    expect(files.filter(f => f === 'store/gameStore.ts' || f.startsWith('data/'))).toEqual([]);
  });
});
