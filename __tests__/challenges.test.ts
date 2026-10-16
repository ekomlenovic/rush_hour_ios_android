import { DIFFICULTY_LEVELS, generateDailyLevel, generateLevel, transformLevel } from '../utils/generator';
import { generateWeeklyLevel } from '../utils/weekly';
import { solvePuzzle } from '../utils/solver';
import { checkWin } from '../utils/collision';
import { sampleLevels } from '../data/sampleLevels';
import { DAILY_LEVEL_ID, WEEKLY_LEVEL_ID, Level } from '../store/gameStore';

/** The puzzle itself, without the creation timestamp */
const puzzle = ({ updatedAt, ...rest }: Level) => rest;
const solve = (level: Level) => solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);

describe('daily challenge', () => {
  it('is the same puzzle for everyone on a given date', async () => {
    const a = await generateDailyLevel('2026-10-14');
    const b = await generateDailyLevel('2026-10-14');
    expect(a).not.toBeNull();
    expect(puzzle(a!)).toEqual(puzzle(b!));
    expect(a!.id).toBe(DAILY_LEVEL_ID);
  });

  it('stays the same when another level is generated meanwhile (map generator)', async () => {
    const reference = await generateDailyLevel('2026-10-14');
    const pending = generateDailyLevel('2026-10-14');
    generateLevel(5, DIFFICULTY_LEVELS.EASY);
    expect(puzzle((await pending)!)).toEqual(puzzle(reference!));
  });

  it('changes from one day to the next', async () => {
    const a = await generateDailyLevel('2026-10-14');
    const b = await generateDailyLevel('2026-10-15');
    expect(puzzle(a!).vehicles).not.toEqual(puzzle(b!).vehicles);
  });

  it('is solvable in its announced number of moves', async () => {
    const level = (await generateDailyLevel('2026-10-14'))!;
    const result = solve(level);
    expect(result.solvable).toBe(true);
    expect(result.minMoves).toBe(level.minMoves);
  });

  it('uses the hard difficulty on Mondays only, in every time zone', async () => {
    // A marker difficulty with at most 3 vehicles tells which one was used (NORMAL has 8 to 12)
    jest.replaceProperty(DIFFICULTY_LEVELS, 'HARD', { ...DIFFICULTY_LEVELS.HARD, minVehicles: 3, maxVehicles: 3, minMovesRequired: 0 });
    const usesHard = async (dateKey: string) => (await generateDailyLevel(dateKey))!.vehicles.length <= 3;
    try {
      expect(await usesHard('2026-10-11')).toBe(false); // Sunday
      expect(await usesHard('2026-10-12')).toBe(true); // Monday
      expect(await usesHard('2026-10-13')).toBe(false); // Tuesday
    } finally {
      jest.restoreAllMocks();
    }
  });
});

describe('transformLevel', () => {
  const levels = [sampleLevels[0], sampleLevels[10], sampleLevels.find(l => l.gridSize === 6)!].filter(Boolean);

  it.each([0, 1, 2, 3, 4, 5, 6, 7])('symmetry %i keeps the minimum number of moves', (symmetry) => {
    for (const level of levels) {
      const transformed = transformLevel(level, symmetry);
      expect(solve(transformed).minMoves).toBe(level.minMoves);
    }
  });

  it('keeps every vehicle inside the grid', () => {
    for (let symmetry = 0; symmetry < 8; symmetry++) {
      const { vehicles, gridSize } = transformLevel(sampleLevels[0], symmetry);
      for (const v of vehicles) {
        const lastRow = v.orientation === 'vertical' ? v.row + v.length - 1 : v.row;
        const lastCol = v.orientation === 'horizontal' ? v.col + v.length - 1 : v.col;
        expect(Math.min(v.row, v.col)).toBeGreaterThanOrEqual(0);
        expect(Math.max(lastRow, lastCol)).toBeLessThan(gridSize);
      }
    }
  });

  it('keeps the target aligned with the exit', () => {
    for (let symmetry = 0; symmetry < 8; symmetry++) {
      const level = transformLevel(sampleLevels[0], symmetry);
      const solved = solve(level);
      let vehicles = level.vehicles;
      for (const move of solved.moves) {
        vehicles = vehicles.map(v => (v.id === move.vehicleId ? { ...v, row: move.toRow, col: move.toCol } : v));
      }
      expect(checkWin(vehicles, level.exitRow, level.exitCol, level.gridSize)).toBe(true);
    }
  });
});

describe('weekly challenge', () => {
  it('is the same puzzle for everyone during a week', async () => {
    const a = await generateWeeklyLevel('2026-W42');
    const b = await generateWeeklyLevel('2026-W42');
    expect(puzzle(a!)).toEqual(puzzle(b!));
    expect(a!.id).toBe(WEEKLY_LEVEL_ID);
  });

  it('comes from a hard campaign level (≥ 25 moves)', async () => {
    for (const week of ['2026-W42', '2026-W43', '2027-W01']) {
      expect((await generateWeeklyLevel(week))!.minMoves).toBeGreaterThanOrEqual(25);
    }
  });

  it('is disguised: never identical to its campaign level', async () => {
    for (let week = 1; week <= 20; week++) {
      const level = (await generateWeeklyLevel(`2026-W${String(week).padStart(2, '0')}`))!;
      const shape = (l: Level) => l.vehicles.map(v => [v.row, v.col, v.length, v.orientation]);
      expect(sampleLevels.some(s => s.gridSize === level.gridSize && JSON.stringify(shape(s)) === JSON.stringify(shape(level)))).toBe(false);
    }
  });

  it('two consecutive weeks do not look alike', async () => {
    const a = await generateWeeklyLevel('2026-W52');
    const b = await generateWeeklyLevel('2026-W53');
    const c = await generateWeeklyLevel('2027-W01');
    expect(puzzle(a!).vehicles).not.toEqual(puzzle(b!).vehicles);
    expect(puzzle(b!).vehicles).not.toEqual(puzzle(c!).vehicles);
  });

  it('is solvable in its announced number of moves', async () => {
    const level = (await generateWeeklyLevel('2026-W42'))!;
    expect(solve(level).minMoves).toBe(level.minMoves);
  });
});
