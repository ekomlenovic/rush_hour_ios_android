import { useGameStore } from '../store/gameStore';
import type { Level } from '../store/types';
import { sampleLevels } from '../data/sampleLevels';
import { getShareUrl, isSameBoard, parseSharedLevel, serializeLevel } from '../utils/sharing';
import { MAX_VALIDATE_STATES, solvePuzzle, validateLevel } from '../utils/solver';
import { parseSharedLevelAsync, validateLevelAsync } from '../utils/solver.background';
import { resetStore } from './helpers';

const level: Level = sampleLevels[3];
const code = (l: Level) => serializeLevel(l);
/** A link edited by hand: same encoding, other content */
const forge = (l: Level, edit: (sections: string[]) => void) => {
  const sections = Buffer.from(serializeLevel(l), 'base64').toString('latin1').split('|');
  edit(sections);
  return Buffer.from(sections.join('|'), 'latin1').toString('base64');
};

beforeEach(resetStore);

describe('shared level links', () => {
  it('opens a link sent by the app, with its real optimum', () => {
    const parsed = parseSharedLevel(getShareUrl(level), 42)!;
    expect(parsed.id).toBe(42);
    expect(parsed.vehicles).toEqual(level.vehicles);
    expect(parsed.minMoves).toBe(validateLevel(level.vehicles, level.gridSize, level.exitRow, level.exitCol));
  });

  it('never trusts the minimum of moves written in the link (stars and XP)', () => {
    const forged = forge(level, s => { s[3] = '60'; });
    expect(parseSharedLevel(forged)!.minMoves).toBe(parseSharedLevel(code(level))!.minMoves);
  });

  it('refuses a broken, overlapping or unsolvable board', () => {
    expect(parseSharedLevel('not a level')).toBeNull();
    expect(parseSharedLevel(forge(level, s => { s[0] = '50'; }))).toBeNull();
    const target = level.vehicles.find(v => v.isTarget)!;
    const other = level.vehicles.find(v => !v.isTarget)!;
    expect(parseSharedLevel(code({ ...level, vehicles: [...level.vehicles, { ...other, id: 'copy' }] }))).toBeNull();
    expect(parseSharedLevel(code({ ...level, vehicles: level.vehicles.filter(v => v !== target) }))).toBeNull();
    // A wall of vertical trucks in front of the exit: no solution
    const wall: Level = {
      id: 1, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 1, updatedAt: 0,
      vehicles: [
        { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: '#FF0000' },
        { id: 'a', row: 0, col: 4, length: 3, orientation: 'vertical', isTarget: false, color: '#00FF00' },
        { id: 'b', row: 3, col: 4, length: 3, orientation: 'vertical', isTarget: false, color: '#0000FF' },
      ],
    };
    expect(parseSharedLevel(code(wall))).toBeNull();
  });

  // 10×10, the red car walled in for good, a dozen small cars free to move: millions of positions to rule it out
  const trap: Level = {
    id: 1, gridSize: 10, exitRow: 4, exitCol: 10, minMoves: 1, updatedAt: 0,
    vehicles: [
      { id: 'target', row: 4, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: '#FF0000' },
      { id: 'wall', row: 1, col: 9, length: 9, orientation: 'vertical', isTarget: false, color: '#000000' },
      ...[0, 2, 6, 8].flatMap(row => [0, 3, 6].map(col => (
        { id: `c${row}${col}`, row, col, length: 2, orientation: 'horizontal' as const, isTarget: false, color: '#00FF00' }))),
    ],
  };

  it('gives up on a board too big to search instead of freezing the app (forged link)', () => {
    const result = solvePuzzle(trap.vehicles, trap.gridSize, trap.exitRow, trap.exitCol, 200, 50_000);
    expect(result).toEqual({ solvable: false, minMoves: -1, moves: [], tooComplex: true });
    expect(validateLevel(trap.vehicles, trap.gridSize, trap.exitRow, trap.exitCol, 50_000)).toBe(-2);
  });

  it('refuses such a link with the default limit, which every level of the app stays under', () => {
    expect(parseSharedLevel(code(trap))).toBeNull();
    // The hardest level of the app needs about 300 000 positions
    const hardest = sampleLevels.find(l => l.id === 88)!;
    expect(solvePuzzle(hardest.vehicles, hardest.gridSize, hardest.exitRow, hardest.exitCol, 200, 250_000).tooComplex).toBe(true);
    expect(solvePuzzle(hardest.vehicles, hardest.gridSize, hardest.exitRow, hardest.exitCol, 200, MAX_VALIDATE_STATES).minMoves).toBe(hardest.minMoves);
  }, 60_000);

  it('solves in the background like on the calling thread', async () => {
    expect(await parseSharedLevelAsync(getShareUrl(level), 42)).toEqual({ ...parseSharedLevel(getShareUrl(level), 42), updatedAt: expect.any(Number) });
    expect(await validateLevelAsync(level.vehicles, level.gridSize, level.exitRow, level.exitCol)).toBe(level.minMoves);
  });

  it('carries the optional name, and still reads links without one', () => {
    expect(parseSharedLevel(code({ ...level, name: '  Embouteillage « du lundi » | 🚗  ' }))!.name).toBe('Embouteillage « du lundi » | 🚗');
    expect(parseSharedLevel(code(level))!.name).toBeUndefined();
  });
});

describe('importing', () => {
  it('imports a link once: the second time opens the level already there', () => {
    const store = useGameStore.getState();
    const first = parseSharedLevel(code(level), 1)!;
    expect(store.addImportedLevel(first)).toBe(1);
    expect(useGameStore.getState().addImportedLevel({ ...parseSharedLevel(code(level), 2)!, name: 'Autre nom' })).toBe(1);
    expect(useGameStore.getState().importedLevels).toHaveLength(1);
    expect(useGameStore.getState().stats.levelsImported).toBe(1);
  });

  it('keeps a level modified from an import apart: importing the original again gives two levels', () => {
    const imported = parseSharedLevel(code(level), 1)!;
    useGameStore.getState().addImportedLevel(imported);
    // Modified in the creator: saved as a level of one's own, the imported one is deleted
    useGameStore.getState().saveCreatedLevel({ ...imported, id: 2, name: 'Ma version' });
    useGameStore.getState().deleteCustomLevel(1, 'imported');
    expect(useGameStore.getState().addImportedLevel(parseSharedLevel(code(level), 3)!)).toBe(3);
    expect(isSameBoard(useGameStore.getState().createdLevels[0], useGameStore.getState().importedLevels[0])).toBe(true);
    expect(useGameStore.getState().createdLevels[0].name).toBe('Ma version');
  });

  it('renames and clears the name of a custom level', () => {
    useGameStore.getState().addImportedLevel(parseSharedLevel(code(level), 1)!);
    useGameStore.getState().renameCustomLevel(1, 'imported', '  Le mien  ');
    expect(useGameStore.getState().importedLevels[0].name).toBe('Le mien');
    useGameStore.getState().renameCustomLevel(1, 'imported', '   ');
    expect(useGameStore.getState().importedLevels[0].name).toBeUndefined();
  });
});
