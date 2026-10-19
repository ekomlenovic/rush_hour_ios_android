import type { Level, Vehicle } from '../store/types';

/**
 * Compact text format of the campaign levels (data/campaignPack.ts): one short string per level,
 * a few kilobytes for the whole campaign instead of an indented JSON array.
 *
 *   "7 T5 6 55v20 04h22 24h23 ..."
 *    │ │  │ └ vehicles: row, col, orientation (h/v), length, color index in PACK_COLORS
 *    │ │  └ minMoves
 *    │ └ exit: side (R right, L left, B bottom, T top) + row (R/L) or column (B/T) of the exit
 *    └ gridSize
 *
 * The first vehicle is the target (id 'target'), the others are 'v1', 'v2'... in order.
 * The level id is not stored: it is the position in the pack (1-based).
 */

/** Vehicle colors of the campaign, in the order of their index (0: the target) */
export const PACK_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#64748B', '#14B8A6',
] as const;

/** Exit outside the grid on the top or left side (-1 stored as a byte) */
const OUTSIDE = 255;

function exitCode(level: Pick<Level, 'gridSize' | 'exitRow' | 'exitCol'>): string {
  const { gridSize: gs, exitRow: row, exitCol: col } = level;
  if (col === gs && row < gs) return `R${row}`;
  if (col === OUTSIDE && row < gs) return `L${row}`;
  if (row === gs && col < gs) return `B${col}`;
  if (row === OUTSIDE && col < gs) return `T${col}`;
  throw new Error(`Exit (${row}, ${col}) is not outside the ${gs}x${gs} grid`);
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

export function encodeCampaignLevel(level: Level): string {
  const vehicles = level.vehicles.map((v, i) => {
    const expectedId = i === 0 ? 'target' : `v${i}`;
    if (v.id !== expectedId || v.isTarget !== (i === 0)) {
      throw new Error(`Level ${level.id}: vehicle #${i} must be '${expectedId}'`);
    }
    const color = PACK_COLORS.indexOf(v.color as typeof PACK_COLORS[number]);
    if (color < 0) throw new Error(`Level ${level.id}: color ${v.color} is not in PACK_COLORS`);
    if (v.row > 9 || v.col > 9 || v.length > 9) throw new Error(`Level ${level.id}: vehicle ${v.id} out of range`);
    return `${v.row}${v.col}${v.orientation === 'horizontal' ? 'h' : 'v'}${v.length}${color}`;
  });
  return [level.gridSize, exitCode(level), level.minMoves, ...vehicles].join(' ');
}

export function decodeCampaignLevel(code: string, id: number): Level {
  const [gridSize, exit, minMoves, ...tokens] = code.split(' ');
  const gs = Number(gridSize);
  const vehicles = tokens.map((t, i): Vehicle => ({
    id: i === 0 ? 'target' : `v${i}`,
    row: Number(t[0]),
    col: Number(t[1]),
    length: Number(t[3]),
    orientation: t[2] === 'h' ? 'horizontal' : 'vertical',
    isTarget: i === 0,
    color: PACK_COLORS[Number(t[4])],
  }));
  return { id, gridSize: gs, ...decodeExit(exit, gs), minMoves: Number(minMoves), vehicles, updatedAt: 0 };
}
