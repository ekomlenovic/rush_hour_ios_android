import type { ColorScheme } from './ui';

/**
 * Board theme: colors of the grid and the vehicles (Board, Block, creator board),
 * independent from the interface theme so a cosmetic skin can change the board alone (#7).
 */
export interface BoardColors {
  /** Inside of the grid */
  background: string;
  /** Frame around the grid */
  frame: string;
  /** Cell lines */
  grid: string;
  /** Exit indicator */
  exit: string;
  /** Outline of the exit indicator */
  exitOutline: string;
  /** The red car to get out (overrides the color saved in the level) */
  targetCar: string;
  /** Colors given to the other vehicles (generator, creator) */
  vehicles: string[];
  vehicleBorder: string;
  /** Shine on the top of a vehicle */
  vehicleShine: string;
  /** Shine on the toolbox previews of the creator */
  vehicleShineStrong: string;
  /** Letter on a vehicle (accessibility) */
  vehicleLabel: string;
  vehicleLabelShadow: string;
  /** Grip dots of the creator vehicles */
  vehicleGrip: string;
  /** Border of a dragged vehicle */
  dragBorder: string;
  /** Hinted vehicle */
  hint: string;
  hintOutline: string;
  /** Veil and badge over the board once solved */
  winVeil: string;
  winBadge: string;
  winBadgeBorder: string;
  /** Drop preview of the creator */
  dropValid: string;
  dropValidBorder: string;
  dropInvalid: string;
  dropInvalidBorder: string;
}

export type BoardThemeId = 'classic';

/** Vehicle colors of the classic board (also the creator palette) */
export const CLASSIC_VEHICLE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
  '#6366F1', '#84CC16', '#D946EF', '#0EA5E9',
];

/** Color saved in the levels for the target car */
export const TARGET_CAR_COLOR = '#EF4444';

/** Colors given by the level generator (saved in the generated levels) */
export const GENERATOR_VEHICLE_COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#64748B', '#14B8A6',
];

const classicShared = {
  exit: TARGET_CAR_COLOR,
  exitOutline: '#000000',
  targetCar: TARGET_CAR_COLOR,
  vehicles: CLASSIC_VEHICLE_COLORS,
  vehicleShine: 'rgba(255,255,255,0.18)',
  vehicleShineStrong: 'rgba(255,255,255,0.28)',
  vehicleLabel: '#FFFFFF',
  vehicleLabelShadow: 'rgba(0,0,0,0.6)',
  vehicleGrip: 'rgba(255,255,255,0.9)',
  dragBorder: 'rgba(255,255,255,0.4)',
  hint: '#F59E0B',
  hintOutline: '#000000',
  dropValid: 'rgba(74,222,128,0.28)',
  dropValidBorder: 'rgba(74,222,128,0.75)',
  dropInvalid: 'rgba(248,113,113,0.28)',
  dropInvalidBorder: 'rgba(248,113,113,0.75)',
};

const classic: Record<ColorScheme, BoardColors> = {
  dark: {
    ...classicShared,
    background: 'rgba(0,0,0,0.2)',
    frame: 'rgba(255,255,255,0.1)',
    grid: 'rgba(255,255,255,0.1)',
    vehicleBorder: 'rgba(255,255,255,0.15)',
    winVeil: 'rgba(15,15,26,0.72)',
    winBadge: 'rgba(30,30,50,0.85)',
    winBadgeBorder: 'rgba(255,255,255,0.15)',
  },
  light: {
    ...classicShared,
    background: 'rgba(0,0,0,0.02)',
    frame: 'rgba(0,0,0,0.1)',
    grid: 'rgba(0,0,0,0.06)',
    vehicleBorder: 'rgba(0,0,0,0.08)',
    winVeil: 'rgba(255,255,255,0.45)',
    winBadge: 'rgba(255,255,255,0.9)',
    winBadgeBorder: 'rgba(0,0,0,0.1)',
  },
};

export const BOARD_THEMES: Record<BoardThemeId, Record<ColorScheme, BoardColors>> = { classic };

export function getBoardColors(id: BoardThemeId, scheme: ColorScheme): BoardColors {
  return (BOARD_THEMES[id] ?? classic)[scheme];
}
