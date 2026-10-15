import { withTiming } from 'react-native-reanimated';

export const SNAP = (val: number) => {
  'worklet';
  return withTiming(val, { duration: 110 });
};

export const BOARD_PADDING = 32;
export const MINI_CELL = 30;

export const GRID_SIZES = [6, 7, 8];
export const CAR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
  '#6366F1', '#84CC16', '#D946EF', '#0EA5E9'
];

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
  { type: 'car', orientation: 'horizontal', length: 2, color: '#3B82F6', label: 'Car', dirIcon: '⟷' },
  { type: 'car', orientation: 'vertical', length: 2, color: '#10B981', label: 'Car', dirIcon: '↕' },
  { type: 'truck', orientation: 'horizontal', length: 3, color: '#F59E0B', label: 'Truck', dirIcon: '⟷' },
  { type: 'truck', orientation: 'vertical', length: 3, color: '#8B5CF6', label: 'Truck', dirIcon: '↕' },
];

export const DIR_LABEL = {
  horizontal: '↔',
  vertical: '↕',
};

/** Colors of the creator screen (to be replaced by the theme system, see #25) */
export interface CreatorColors {
  bg: string;
  surface: string;
  text: string;
  sub: string;
  accent: string;
  card: string;
  border: string;
  grid: string;
  boardBg: string;
  toolBg: string;
}

export function getCreatorColors(isDark: boolean): CreatorColors {
  return isDark ? {
    bg: '#0C0C18', surface: '#13131F', text: '#EEEEFF', sub: '#6E6E8A',
    accent: '#7B71FF', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.09)',
    grid: 'rgba(255,255,255,0.06)', boardBg: 'rgba(255,255,255,0.015)', toolBg: 'rgba(255,255,255,0.04)',
  } : {
    bg: '#ECEAF5', surface: '#F8F7FF', text: '#18182C', sub: '#7070A0',
    accent: '#5B4FE8', card: 'rgba(255,255,255,0.85)', border: 'rgba(90,79,224,0.15)',
    grid: 'rgba(0,0,0,0.06)', boardBg: 'rgba(255,255,255,0.6)', toolBg: 'rgba(255,255,255,0.7)',
  };
}
