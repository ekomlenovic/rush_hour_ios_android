import i18next, { TFunction } from 'i18next';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import { getColorKey, getVehicleLetters, describeVehicle, describePosition, describeExit, stepVehicle } from '../utils/accessibility';
import { CAR_PALETTE } from '../components/creator/constants';
import { sampleLevels } from '../data/sampleLevels';
import type { Vehicle } from '../store/types';

const i18n = i18next.createInstance();
let t: TFunction;
beforeAll(async () => {
  await i18n.init({ lng: 'fr', resources: { fr: { translation: fr }, en: { translation: en } }, interpolation: { escapeValue: false } });
  t = i18n.t;
});

const vehicle = (over: Partial<Vehicle>): Vehicle =>
  ({ id: 'v1', row: 0, col: 0, length: 2, orientation: 'horizontal', isTarget: false, color: '#3B82F6', ...over });

describe('getColorKey', () => {
  it('names the vehicle colors of the game', () => {
    expect(getColorKey('#EF4444')).toBe('red');
    expect(getColorKey('#F97316')).toBe('orange');
    expect(getColorKey('#F59E0B')).toBe('yellow');
    expect(getColorKey('#10B981')).toBe('green');
    expect(getColorKey('#14B8A6')).toBe('teal');
    expect(getColorKey('#06B6D4')).toBe('cyan');
    expect(getColorKey('#3B82F6')).toBe('blue');
    expect(getColorKey('#6366F1')).toBe('indigo');
    expect(getColorKey('#8B5CF6')).toBe('purple');
    expect(getColorKey('#EC4899')).toBe('pink');
    expect(getColorKey('#64748B')).toBe('gray');
    expect(getColorKey('not a color')).toBe('gray');
  });

  it('has a translation for every color used by the levels and the creator', () => {
    const colors = new Set([...CAR_PALETTE, ...sampleLevels.flatMap(l => l.vehicles.map(v => v.color))]);
    for (const color of colors) {
      for (const locale of [fr, en]) {
        expect((locale as any).a11y.colors[getColorKey(color)]).toEqual(expect.any(String));
      }
    }
  });
});

describe('getVehicleLetters', () => {
  it('gives A, B, C… in the level order, nothing to the target car', () => {
    const letters = getVehicleLetters([vehicle({ id: 'target', isTarget: true }), vehicle({ id: 'v1' }), vehicle({ id: 'v2' })]);
    expect(letters).toEqual({ v1: 'A', v2: 'B' });
  });

  it('keeps going after Z', () => {
    const many = Array.from({ length: 28 }, (_, i) => vehicle({ id: `v${i}` }));
    expect(getVehicleLetters(many).v27).toBe('AB');
  });
});

describe('descriptions', () => {
  it('describe the vehicle, with its letter and color', () => {
    expect(describeVehicle(t, vehicle({}), 'B')).toBe('Voiture B (bleu)');
    expect(describeVehicle(t, vehicle({ length: 3, color: '#10B981' }), 'C')).toBe('Camion C (vert)');
    expect(describeVehicle(t, vehicle({ isTarget: true, color: '#EF4444' }), undefined)).toBe('Voiture rouge, celle à faire sortir');
  });

  it('give 1-based positions', () => {
    expect(describePosition(t, vehicle({ row: 2, col: 1 }))).toBe("à l'horizontale, ligne 3, colonnes 2 à 3");
    expect(describePosition(t, vehicle({ row: 0, col: 4, length: 3, orientation: 'vertical' }))).toBe('à la verticale, colonne 5, lignes 1 à 3');
  });

  it('describe the exit on every side (255 is top or left)', () => {
    expect(describeExit(t, 2, 6, 6)).toBe('Sortie à droite, ligne 3');
    expect(describeExit(t, 2, 255, 6)).toBe('Sortie à gauche, ligne 3');
    expect(describeExit(t, 255, 4, 6)).toBe('Sortie en haut, colonne 5');
    expect(describeExit(t, 6, 4, 6)).toBe('Sortie en bas, colonne 5');
  });

  it('exist in English too', async () => {
    await i18n.changeLanguage('en');
    expect(describeVehicle(t, vehicle({}), 'B')).toBe('Car B (blue)');
    expect(describePosition(t, vehicle({ row: 2, col: 1 }))).toBe('horizontal, row 3, columns 2 to 3');
    await i18n.changeLanguage('fr');
  });
});

describe('stepVehicle (moving without dragging)', () => {
  it('moves one cell along the vehicle axis', () => {
    expect(stepVehicle(vehicle({ row: 2, col: 1 }), { min: 0, max: 4 }, 1)).toEqual({ row: 2, col: 2 });
    expect(stepVehicle(vehicle({ row: 3, col: 1, orientation: 'vertical' }), { min: 0, max: 4 }, -1)).toEqual({ row: 2, col: 1 });
  });

  it('is blocked at the bounds', () => {
    expect(stepVehicle(vehicle({ col: 4 }), { min: 2, max: 4 }, 1)).toBeNull();
    expect(stepVehicle(vehicle({ col: 2 }), { min: 2, max: 4 }, -1)).toBeNull();
  });
});

describe('translations', () => {
  const keys = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

  it('every screen reader text exists in French and English', () => {
    expect(keys((fr as any).a11y).sort()).toEqual(keys((en as any).a11y).sort());
  });
});
