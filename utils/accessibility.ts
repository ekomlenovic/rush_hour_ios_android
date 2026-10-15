import type { TFunction } from 'i18next';
import type { Vehicle } from '@/store/types';

/** Screen reader descriptions of the board (VoiceOver / TalkBack), see #26 */

export type ColorKey =
  | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan'
  | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray';

/** Color name of a '#RRGGBB' color, from its hue: vehicles are told apart by color and letter */
export function getColorKey(hex: string): ColorKey {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 'gray';
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.25) return 'gray';

  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 35) return 'orange';
  if (hue < 70) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 183) return 'teal';
  if (hue < 200) return 'cyan';
  if (hue < 235) return 'blue';
  if (hue < 250) return 'indigo';
  if (hue < 285) return 'purple';
  return 'pink';
}

/**
 * Letter of each vehicle (A, B, C… in the level's order, the target car has none):
 * read by the screen reader and shown on the board in the color-blind option.
 */
export function getVehicleLetters(vehicles: Vehicle[]): Record<string, string> {
  const letters: Record<string, string> = {};
  let index = 0;
  for (const v of vehicles) {
    if (v.isTarget) continue;
    letters[v.id] = index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + Math.floor(index / 26) - 1)}${String.fromCharCode(65 + (index % 26))}`;
    index++;
  }
  return letters;
}

/** "Car B (blue)" / "Red car, the one to get out" */
export function describeVehicle(t: TFunction, vehicle: Vehicle, letter: string | undefined): string {
  if (vehicle.isTarget) return t('a11y.target_car');
  return t(vehicle.length >= 3 ? 'a11y.truck' : 'a11y.car', {
    letter: letter ?? '',
    color: t(`a11y.colors.${getColorKey(vehicle.color)}`),
  });
}

/** Where the vehicle is, 1-based: "horizontal, row 3, columns 2 to 3" */
export function describePosition(t: TFunction, vehicle: Pick<Vehicle, 'row' | 'col' | 'length' | 'orientation'>): string {
  return vehicle.orientation === 'horizontal'
    ? t('a11y.position_horizontal', { row: vehicle.row + 1, from: vehicle.col + 1, to: vehicle.col + vehicle.length })
    : t('a11y.position_vertical', { col: vehicle.col + 1, from: vehicle.row + 1, to: vehicle.row + vehicle.length });
}

/** Where the exit is: "Exit on the right, row 3" */
export function describeExit(t: TFunction, exitRow: number, exitCol: number, gridSize: number): string {
  if (exitCol === 255 || exitCol < 0) return t('a11y.exit_left', { row: exitRow + 1 });
  if (exitCol >= gridSize) return t('a11y.exit_right', { row: exitRow + 1 });
  if (exitRow === 255 || exitRow < 0) return t('a11y.exit_top', { col: exitCol + 1 });
  return t('a11y.exit_bottom', { col: exitCol + 1 });
}

/**
 * Position after moving the vehicle one cell, without a drag: +1 is right / down,
 * -1 is left / up. Null when it is blocked (bounds from getMoveBounds, in cells).
 */
export function stepVehicle(
  vehicle: Pick<Vehicle, 'row' | 'col' | 'orientation'>,
  bounds: { min: number; max: number },
  step: 1 | -1,
): { row: number; col: number } | null {
  const isHorizontal = vehicle.orientation === 'horizontal';
  const next = (isHorizontal ? vehicle.col : vehicle.row) + step;
  if (next < bounds.min || next > bounds.max) return null;
  return isHorizontal ? { row: vehicle.row, col: next } : { row: next, col: vehicle.col };
}
