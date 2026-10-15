import { CLASSIC_VEHICLE_COLORS } from '../../theme/board';

export const BOARD_PADDING = 32;
export const MINI_CELL = 30;

export const GRID_SIZES = [6, 7, 8];
/** Vehicle colors of the creator */
export const CAR_PALETTE = CLASSIC_VEHICLE_COLORS;

export type VehicleTemplate = {
  type: 'car' | 'truck';
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: string;
  label: string;
  dirIcon: string;
};

export type ActiveDrag = {
  id: string;
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: string;
  targetRow: number;
  targetCol: number;
  isValid: boolean;
};

export const TOOLBOX_ITEMS: VehicleTemplate[] = [
  { type: 'car', orientation: 'horizontal', length: 2, color: CAR_PALETTE[0], label: 'Car', dirIcon: '⟷' },
  { type: 'car', orientation: 'vertical', length: 2, color: CAR_PALETTE[1], label: 'Car', dirIcon: '↕' },
  { type: 'truck', orientation: 'horizontal', length: 3, color: CAR_PALETTE[2], label: 'Truck', dirIcon: '⟷' },
  { type: 'truck', orientation: 'vertical', length: 3, color: CAR_PALETTE[3], label: 'Truck', dirIcon: '↕' },
];

export const DIR_LABEL = {
  horizontal: '↔',
  vertical: '↕',
};
