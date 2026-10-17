import type { Level, Vehicle } from '@/store/types';
import { validateLevel } from './solver';
import { getExitSide, vehicleCells } from './creatorGeometry';
import { CLASSIC_VEHICLE_COLORS } from '../theme/board';

// Simple Base64 implementation for cross-platform compatibility
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function customBtoa(input: string): string {
  let str = input;
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    block = block << 8 | charCode;
  }
  return output;
}

function customAtob(input: string): string {
  let str = input.replace(/=+$/, '');
  let output = '';
  for (let bc = 0, bs = 0, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Serializes a Level object into a compact string format.
 */
export function serializeLevel(level: Level): string {
  const parts = [
    level.gridSize,
    level.exitRow,
    level.exitCol,
    level.minMoves
  ];

  const vehicleStrings = level.vehicles.map(v => {
    const orientation = v.orientation === 'horizontal' ? 'h' : 'v';
    const isTarget = v.isTarget ? '1' : '0';
    const color = v.color.replace('#', '');
    return `${v.row},${v.col},${v.length},${orientation},${isTarget},${color},${v.id}`;
  });

  // The name is an extra section: older versions of the app ignore it
  const name = cleanLevelName(level.name);
  const sections = [...parts, vehicleStrings.join(';')];
  if (name) sections.push(encodeURIComponent(name));
  return customBtoa(sections.join('|'));
}

/**
 * Deserializes a string back into a Level object.
 */
export function deserializeLevel(data: string, id: number = 999998): Level | null {
  try {
    let cleanData = data;
    
    // 1. If it's a full URL, extract the 'data' parameter
    if (data.includes('?data=')) {
      cleanData = data.split('?data=')[1].split('&')[0];
    } else if (data.includes('data=')) {
       cleanData = data.split('data=')[1].split('&')[0];
    }

    // 2. Decode URL encoding if present (e.g. %2B for +)
    cleanData = decodeURIComponent(cleanData);

    const decoded = customAtob(cleanData);
    const sections = decoded.split('|');
    if (sections.length < 5) return null;

    const gridSize = parseInt(sections[0], 10);
    const exitRow = parseInt(sections[1], 10);
    const exitCol = parseInt(sections[2], 10);
    const minMoves = parseInt(sections[3], 10);

    const vehicleStrings = sections[4].split(';');
    const vehicles: Vehicle[] = vehicleStrings.map(vStr => {
      const p = vStr.split(',');
      return {
        row: parseInt(p[0], 10),
        col: parseInt(p[1], 10),
        length: parseInt(p[2], 10),
        orientation: p[3] === 'h' ? 'horizontal' : 'vertical',
        isTarget: p[4] === '1',
        color: `#${p[5]}`,
        id: p[6] || `v${Math.random().toString(36).substr(2, 5)}`
      };
    });

    const name = sections[5] ? cleanLevelName(decodeURIComponent(sections[5])) : undefined;

    return {
      id,
      gridSize,
      exitRow,
      exitCol,
      minMoves,
      vehicles,
      updatedAt: Date.now(),
      ...(name ? { name } : {}),
    };
  } catch (err) {
    console.error('Failed to deserialize level:', err);
    return null;
  }
}

/**
 * Generates the sharing URL
 */
export function getShareUrl(level: Level): string {
  const data = serializeLevel(level);
  return `rush-hours://game?data=${encodeURIComponent(data)}`;
}

export const LEVEL_NAME_MAX_LENGTH = 40;

/** Name of a level as stored: trimmed, without control characters, empty → undefined */
export function cleanLevelName(name: string | undefined): string | undefined {
  const clean = (name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LEVEL_NAME_MAX_LENGTH);
  return clean || undefined;
}

const MIN_GRID = 4;
const MAX_GRID = 10;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/** Whether a decoded level is a real board: vehicles inside the grid, no overlap, one target, an exit */
function isWellFormed(level: Level): boolean {
  const { gridSize, vehicles } = level;
  if (!Number.isInteger(gridSize) || gridSize < MIN_GRID || gridSize > MAX_GRID) return false;
  if (!getExitSide(level.exitRow, level.exitCol, gridSize)) return false;
  if (vehicles.filter(v => v.isTarget).length !== 1) return false;
  if (new Set(vehicles.map(v => v.id)).size !== vehicles.length) return false;
  const taken = new Set<string>();
  for (const v of vehicles) {
    if (![v.row, v.col, v.length].every(Number.isInteger) || v.length < 1 || v.length >= gridSize) return false;
    for (const [r, c] of vehicleCells(v.row, v.col, v.orientation, v.length)) {
      if (r < 0 || c < 0 || r >= gridSize || c >= gridSize || taken.has(`${r},${c}`)) return false;
      taken.add(`${r},${c}`);
    }
  }
  return true;
}

/**
 * A level received from someone else (link, code, QR): decoded, checked and solved again.
 * The minimum of moves of the link is never trusted, it gives the stars and the XP.
 * Returns null for a broken or unsolvable level.
 */
export function parseSharedLevel(data: string, id: number = Date.now()): Level | null {
  const level = deserializeLevel(data, id);
  if (!level || !isWellFormed(level)) return null;
  const vehicles = level.vehicles.map((v, i) =>
    HEX_COLOR.test(v.color) ? v : { ...v, color: CLASSIC_VEHICLE_COLORS[i % CLASSIC_VEHICLE_COLORS.length] });
  const minMoves = validateLevel(vehicles, level.gridSize, level.exitRow, level.exitCol);
  if (minMoves < 1) return null;
  return { ...level, vehicles, minMoves };
}

/** Same board (name and favorite aside): a link imported twice gives one level */
export function isSameBoard(a: Level, b: Level): boolean {
  const board = (l: Level) => serializeLevel({ ...l, name: undefined, minMoves: 0 });
  return board(a) === board(b);
}
