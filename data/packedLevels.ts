import type { Level, Vehicle } from '../store/types';

/**
 * Compact text form of a level on the device (the infinite map, `generatedLevels`): about
 * 70 bytes instead of 1.7 KB of JSON, so that tens of thousands of levels fit in the 2 MB
 * an entry can hold on Android (see `chunkedFields` in store/guardedStorage.ts; kept in data/ with the other level data).
 *
 *   "735 1731190000000 6 R2 14 22h20 04v31=blocker_0 ..."
 *    │   │             │ │  │  └ vehicles: row, col, orientation (h/v), length, color (base 36 index in
 *    │   │             │ │  │    PACKED_COLORS), then `=id` when the id is not the usual one ('target', 'v1'...)
 *    │   │             │ │  └ minMoves
 *    │   │             │ └ exit: side (R right, L left, B bottom, T top) + row (R/L) or column (B/T)
 *    │   │             └ gridSize
 *    │   └ updatedAt
 *    └ id
 *
 * A level this form cannot hold as is (a color out of the list, a name, a favorite, a value
 * out of range...) is kept as its JSON (it starts with `{`): what is read back is always
 * exactly the level written. Persisted: never change the meaning of a form, only add one.
 */

/** Colors of the packed form, by their index: never reorder nor remove one, only append */
export const PACKED_COLORS: readonly string[] = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#64748B', '#14B8A6',
  '#6366F1', '#84CC16', '#D946EF', '#0EA5E9',
];

/** Exit outside the grid on the top or left side (-1 stored as a byte) */
const OUTSIDE = 255;

const LEVEL_KEYS = new Set(['id', 'gridSize', 'vehicles', 'exitRow', 'exitCol', 'minMoves', 'updatedAt']);
const VEHICLE_KEYS = new Set(['id', 'row', 'col', 'length', 'orientation', 'isTarget', 'color']);

const defaultVehicleId = (index: number) => (index === 0 ? 'target' : `v${index}`);
const isDigit = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9;
/** Keys with a value: an undefined field is not written by JSON either */
const keysOf = (o: object) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k]) => k);

function exitCode({ gridSize: gs, exitRow: row, exitCol: col }: Level): string | null {
  if (col === gs && row < gs) return `R${row}`;
  if (col === OUTSIDE && row < gs) return `L${row}`;
  if (row === gs && col < gs) return `B${col}`;
  if (row === OUTSIDE && col < gs) return `T${col}`;
  return null;
}

function decodeExit(code: string, gs: number): Pick<Level, 'exitRow' | 'exitCol'> {
  const index = Number(code.slice(1));
  switch (code[0]) {
    case 'R': return { exitRow: index, exitCol: gs };
    case 'L': return { exitRow: index, exitCol: OUTSIDE };
    case 'B': return { exitRow: gs, exitCol: index };
    case 'T': return { exitRow: OUTSIDE, exitCol: index };
  }
  throw new Error(`Unknown exit '${code}'`);
}

function vehicleToken(v: Vehicle, index: number): string | null {
  if (!v || typeof v !== 'object' || keysOf(v).some(k => !VEHICLE_KEYS.has(k))) return null;
  if (!isDigit(v.row) || !isDigit(v.col) || !isDigit(v.length)) return null;
  if (v.orientation !== 'horizontal' && v.orientation !== 'vertical') return null;
  if (v.isTarget !== (index === 0)) return null;
  const color = PACKED_COLORS.indexOf(v.color);
  if (color < 0) return null;
  if (typeof v.id !== 'string' || /[\s=]/.test(v.id) || v.id === '') return null;
  const id = v.id === defaultVehicleId(index) ? '' : `=${v.id}`;
  return `${v.row}${v.col}${v.orientation === 'horizontal' ? 'h' : 'v'}${v.length}${color.toString(36)}${id}`;
}

/** The packed form, or null when the level does not fit in it */
function compact(level: Level): string | null {
  if (!level || typeof level !== 'object' || keysOf(level).some(k => !LEVEL_KEYS.has(k))) return null;
  const numbers = [level.id, level.updatedAt, level.gridSize, level.minMoves];
  if (numbers.some(n => typeof n !== 'number' || !Number.isFinite(n))) return null;
  if (!Array.isArray(level.vehicles) || level.vehicles.length === 0) return null;
  const exit = exitCode(level);
  if (exit === null) return null;
  const tokens = level.vehicles.map(vehicleToken);
  if (tokens.some(t => t === null)) return null;
  return [level.id, level.updatedAt, level.gridSize, exit, level.minMoves, ...tokens].join(' ');
}

/** JSON with the keys in a fixed order: two equal levels give the same text */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, (v as Record<string, unknown>)[k]]))
    : v));
}

export function unpackLevel(text: string): Level {
  if (text.startsWith('{')) return JSON.parse(text) as Level;
  const [id, updatedAt, gridSize, exit, minMoves, ...tokens] = text.split(' ');
  const gs = Number(gridSize);
  const vehicles = tokens.map((t, i): Vehicle => {
    const separator = t.indexOf('=');
    const color = Number.parseInt(t[4], 36);
    if (t.length < 5 || !(color < PACKED_COLORS.length)) throw new Error(`Packed vehicle '${t}' is not valid`);
    return {
      id: separator >= 0 ? t.slice(separator + 1) : defaultVehicleId(i),
      row: Number(t[0]),
      col: Number(t[1]),
      length: Number(t[3]),
      orientation: t[2] === 'h' ? 'horizontal' : 'vertical',
      isTarget: i === 0,
      color: PACKED_COLORS[color],
    };
  });
  return { id: Number(id), gridSize: gs, ...decodeExit(exit, gs), minMoves: Number(minMoves), vehicles, updatedAt: Number(updatedAt) };
}

/** The level in its packed form, or as JSON when that form would not give it back exactly */
export function packLevel(level: Level): string {
  const packed = compact(level);
  if (packed !== null) {
    try {
      if (canonical(unpackLevel(packed)) === canonical(level)) return packed;
    } catch {
      // Not readable back: kept as JSON
    }
  }
  return JSON.stringify(level);
}
