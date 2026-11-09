import { sampleLevels } from '../data/sampleLevels';
import { packLevel, unpackLevel, PACKED_COLORS } from '../data/packedLevels';
import { DIFFICULTY_LEVELS, generateSeededLevelSync } from '../utils/generator.core';
import { GENERATOR_VEHICLE_COLORS, TARGET_CAR_COLOR } from '../theme/board';
import type { Level } from '../store/types';

/** Levels as the generator writes them on the infinite map */
const generated: Level[] = (['EASY', 'NORMAL', 'HARD'] as const).flatMap((difficulty, d) =>
  [0, 1, 2].map(i => generateSeededLevelSync(`packed-${difficulty}-${i}`, 800 + d * 3 + i, DIFFICULTY_LEVELS[difficulty]))
    .filter((l): l is Level => l !== null)
    .map(l => ({ ...l, updatedAt: 1731190000000 + l.id })),
);

describe('the packed form of the map levels', () => {
  it('gives back exactly the generated levels, the campaign ones, in a few dozen bytes', () => {
    expect(generated.length).toBeGreaterThan(5);
    for (const level of [...generated, ...sampleLevels.slice(-50)]) {
      const packed = packLevel(level);
      expect(packed.startsWith('{')).toBe(false);
      expect(unpackLevel(packed)).toEqual(level);
      expect(packed.length).toBeLessThan(JSON.stringify(level).length / 8);
    }
  });

  it('keeps the vehicle ids the generator gives (a game in progress refers to them)', () => {
    const level = { ...sampleLevels[40], id: 1200, vehicles: sampleLevels[40].vehicles.map((v, i) => (i === 0 ? v : { ...v, id: `blocker_${i}` })) };
    const packed = packLevel(level);
    expect(packed).toContain('=blocker_1');
    expect(unpackLevel(packed)).toEqual(level);
  });

  it('holds every color the generator and the campaign give', () => {
    for (const color of [...GENERATOR_VEHICLE_COLORS, TARGET_CAR_COLOR]) expect(PACKED_COLORS).toContain(color);
  });

  it('keeps as JSON a level it cannot hold, never anything else than what was written', () => {
    const base = sampleLevels[10];
    const odd: Level[] = [
      { ...base, name: 'Mon niveau' },
      { ...base, isFavorite: true },
      { ...base, vehicles: base.vehicles.map((v, i) => (i === 1 ? { ...v, color: '#123456' } : v)) },
      { ...base, vehicles: base.vehicles.map((v, i) => (i === 1 ? { ...v, id: 'a b' } : v)) },
      { ...base, vehicles: base.vehicles.map((v, i) => (i === 1 ? { ...v, isTarget: true } : v)) },
      { ...base, gridSize: 12, exitCol: 12 },
      { ...base, updatedAt: 1.5 },
      { ...base, extra: 1 } as Level,
    ];
    for (const level of odd) expect(unpackLevel(packLevel(level))).toEqual(level);
    expect(packLevel(odd[0]).startsWith('{')).toBe(true);
    expect(packLevel(odd[2]).startsWith('{')).toBe(true);
  });

  it('reads back a form written by this version (persisted, never changed)', () => {
    expect(unpackLevel('735 1731190000000 6 R2 14 22h20 04v31=blocker_0 50h3a')).toEqual({
      id: 735, updatedAt: 1731190000000, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 14,
      vehicles: [
        { id: 'target', row: 2, col: 2, length: 2, orientation: 'horizontal', isTarget: true, color: '#EF4444' },
        { id: 'blocker_0', row: 0, col: 4, length: 3, orientation: 'vertical', isTarget: false, color: '#F59E0B' },
        { id: 'v2', row: 5, col: 0, length: 3, orientation: 'horizontal', isTarget: false, color: '#6366F1' },
      ],
    });
  });
});
