import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  applyPalette, getSkinnedBoard, CLASSIC_VEHICLE_COLORS, TARGET_CAR_COLOR,
  type ColorScheme,
} from '@/theme';
import type { CosmeticSelection } from '@/data/cosmetics';
import type { Level, Vehicle } from '@/store/types';
import { getExitSide } from '@/utils/creatorGeometry';

const GRID = 6;
/** Width of the frame: the cells fit inside it */
const FRAME = 2;

/** A small fixed puzzle to show the board, the car skin and the palette */
export const SAMPLE: Vehicle[] = [
  { id: 'target', row: 2, col: 1, length: 2, orientation: 'horizontal', isTarget: true, color: TARGET_CAR_COLOR },
  { id: 'a', row: 1, col: 3, length: 3, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[0] },
  { id: 'b', row: 0, col: 0, length: 2, orientation: 'horizontal', isTarget: false, color: CLASSIC_VEHICLE_COLORS[1] },
  { id: 'c', row: 2, col: 5, length: 2, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[2] },
  { id: 'd', row: 4, col: 1, length: 3, orientation: 'horizontal', isTarget: false, color: CLASSIC_VEHICLE_COLORS[3] },
  { id: 'e', row: 3, col: 0, length: 2, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[4] },
  { id: 'f', row: 5, col: 4, length: 2, orientation: 'horizontal', isTarget: false, color: CLASSIC_VEHICLE_COLORS[5] },
];

interface Props {
  selection: CosmeticSelection;
  scheme: ColorScheme;
  size: number;
  /** Board to draw (custom levels list); the sample puzzle when not set */
  level?: Pick<Level, 'vehicles' | 'gridSize' | 'exitRow' | 'exitCol'>;
}

/** Static board drawn with a cosmetic selection (garage preview, thumbnail of a level) */
export default function BoardPreview({ selection, scheme, size, level }: Props) {
  const board = getSkinnedBoard(selection.board, selection.skin, scheme);
  const vehicles = level?.vehicles ?? SAMPLE;
  const grid = level?.gridSize ?? GRID;
  const colors = useMemo(() => applyPalette(vehicles, selection.palette), [vehicles, selection.palette]);
  // Absolute children are laid out inside the frame: the grid must fit in what is left
  const cell = (size - FRAME * 2) / grid;
  // Space around each vehicle, scaled so the small thumbnails don't get stuck together
  const inset = Math.min(2, Math.max(0.75, cell * 0.08));
  const radius = cell * board.vehicleRadius;

  return (
    <View
      style={[styles.board, { width: size, height: size, backgroundColor: board.background, borderColor: board.frame, borderRadius: board.boardRadius }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {Array.from({ length: grid + 1 }, (_, i) => (
        <React.Fragment key={i}>
          <View style={[styles.lineH, { top: i * cell, backgroundColor: board.grid }]} />
          <View style={[styles.lineV, { left: i * cell, backgroundColor: board.grid }]} />
        </React.Fragment>
      ))}
      {vehicles.map(v => {
        const w = (v.orientation === 'horizontal' ? v.length : 1) * cell - inset * 2;
        const h = (v.orientation === 'vertical' ? v.length : 1) * cell - inset * 2;
        return (
          <View
            key={v.id}
            style={[styles.vehicle, {
              left: v.col * cell + inset, top: v.row * cell + inset, width: w, height: h, borderRadius: radius,
              backgroundColor: v.isTarget ? board.targetCar : colors.get(v.id) ?? v.color,
              borderColor: board.vehicleBorder,
            }]}
          >
            <View style={[styles.shine, { borderRadius: radius * 0.78, backgroundColor: board.vehicleShine }]} />
            {v.isTarget && board.targetIcon ? <Text style={{ fontSize: cell * 0.45 }}>{board.targetIcon}</Text> : null}
          </View>
        );
      })}
      <View style={[styles.exit, exitPosition(level?.exitRow ?? 2, level?.exitCol ?? GRID, grid, cell), { backgroundColor: board.exit, borderColor: board.exitOutline }]} />
    </View>
  );
}

/** Exit mark on the edge of the board, on the side of the level exit */
function exitPosition(exitRow: number, exitCol: number, grid: number, cell: number) {
  const thickness = Math.max(3, cell * 0.12);
  const along = { offset: cell * 0.2, span: cell * 0.6 };
  switch (getExitSide(exitRow, exitCol, grid)) {
    case 'Left': return { left: 0, top: exitRow * cell + along.offset, height: along.span, width: thickness };
    case 'Top': return { top: 0, left: exitCol * cell + along.offset, width: along.span, height: thickness };
    case 'Bottom': return { bottom: 0, left: exitCol * cell + along.offset, width: along.span, height: thickness };
    default: return { right: 0, top: exitRow * cell + along.offset, height: along.span, width: thickness };
  }
}

const styles = StyleSheet.create({
  board: { borderWidth: FRAME, overflow: 'hidden' },
  lineH: { position: 'absolute', left: 0, right: 0, height: 1 },
  lineV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  vehicle: { position: 'absolute', borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  shine: { position: 'absolute', top: 2, left: 2, right: 2, height: '45%' },
  exit: { position: 'absolute', borderRadius: 3, borderWidth: 1 },
});
