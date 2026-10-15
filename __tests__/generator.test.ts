import {
  DEVICE_DIFFICULTIES, DIFFICULTY_LEVELS, generateDailyLevel, generateLevel,
} from '../utils/generator';
import { exploreComponent, initialPositions, solvePuzzle, toCompactBoard } from '../utils/solver';
import { sampleLevels } from '../data/sampleLevels';
import type { Level } from '../store/types';

const solve = (level: Level) => solvePuzzle(level.vehicles, level.gridSize, level.exitRow, level.exitCol);

describe('solver (rules in docs/GAME_DESIGN.md)', () => {
  it('finds the announced optimum of every campaign level', () => {
    const wrong = sampleLevels.filter(l => solve(l).minMoves !== l.minMoves).map(l => l.id);
    expect(wrong).toEqual([]);
  }, 120_000);

  it('the component exploration gives the same distance as the solver', () => {
    for (const level of sampleLevels.filter(l => l.gridSize === 6).slice(0, 15)) {
      const board = toCompactBoard(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
      const component = exploreComponent(board, initialPositions(level.vehicles), 500_000)!;
      // The start is the first state of the component
      expect({ id: level.id, distance: component.distance[0] }).toEqual({ id: level.id, distance: level.minMoves });
    }
  });

  it('gives up past the state limit', () => {
    const level = sampleLevels[0];
    const board = toCompactBoard(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
    expect(exploreComponent(board, initialPositions(level.vehicles), 1)).toBeNull();
  });
});

describe('level generator', () => {
  it('never offers MASTER on the phone', () => {
    expect(DEVICE_DIFFICULTIES).not.toContain('MASTER');
  });

  it('the same seed gives the same level', () => {
    const { updatedAt: _a, ...a } = generateLevel(1, DIFFICULTY_LEVELS.NORMAL, 'seed')!;
    const { updatedAt: _b, ...b } = generateLevel(1, DIFFICULTY_LEVELS.NORMAL, 'seed')!;
    expect(a).toEqual(b);
  });

  it.each(DEVICE_DIFFICULTIES.map(d => [d]))('%s levels are in their range of moves, as the solver says', (difficulty) => {
    const config = DIFFICULTY_LEVELS[difficulty];
    for (let i = 0; i < 3; i++) {
      const level = generateLevel(7, config, `${difficulty}-${i}`)!;
      expect(level).not.toBeNull();
      expect(level.id).toBe(7);
      expect(level.minMoves).toBeGreaterThanOrEqual(config.minMovesRequired);
      expect(level.minMoves).toBeLessThanOrEqual(config.maxMovesRequired);
      expect(solve(level).minMoves).toBe(level.minMoves);
      expect(level.vehicles.length).toBeGreaterThanOrEqual(config.minVehicles);
      expect(level.vehicles.length).toBeLessThanOrEqual(config.maxVehicles);
      expect(level.vehicles.filter(v => v.isTarget)).toHaveLength(1);
    }
  }, 120_000);

  it('the daily is in the NORMAL range, the Monday one in the HARD range', async () => {
    const tuesday = (await generateDailyLevel('2026-10-13'))!;
    expect(tuesday.minMoves).toBeGreaterThanOrEqual(DIFFICULTY_LEVELS.NORMAL.minMovesRequired);
    expect(tuesday.minMoves).toBeLessThanOrEqual(DIFFICULTY_LEVELS.NORMAL.maxMovesRequired);
    const monday = (await generateDailyLevel('2026-10-12'))!;
    expect(monday.minMoves).toBeGreaterThanOrEqual(DIFFICULTY_LEVELS.HARD.minMovesRequired);
    expect(monday.minMoves).toBeLessThanOrEqual(DIFFICULTY_LEVELS.HARD.maxMovesRequired);
  }, 60_000);
});
