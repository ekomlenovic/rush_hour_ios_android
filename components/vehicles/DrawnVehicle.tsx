import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import ArtSvg from '@/components/art/ArtSvg';
import type { VehicleArt } from '@/theme';
import type { Facing } from '@/theme/art/art';
import { drawVehicle } from '@/theme/art/vehicles';

interface Props {
  art: VehicleArt;
  length: number;
  orientation: 'horizontal' | 'vertical';
  /** Where its front points (`vehicleFacing`, the target car toward its exit); right when horizontal, up when vertical if not set */
  facing?: Facing;
  color: string;
  width: number;
  height: number;
}

/** A drawn vehicle seen from above (Mafia or 1800 skin and palette: cars or ships), filling its block, its front toward `facing` */
function DrawnVehicle({ art, length, orientation, facing, color, width, height }: Props) {
  const drawing = useMemo(() => drawVehicle(art, length, color), [art, length, color]);
  const way: Facing = orientation === 'vertical'
    ? (facing === 'down' ? 'down' : 'up')
    : (facing === 'left' ? 'left' : 'right');
  // A vehicle turned in the creator changes its size and viewBox at once: react-native-svg can keep the old
  // drawing, cut by the new box (half a vehicle, still the old way). A new shape (or way) gets a new Svg
  const shape = `${way}-${length}-${Math.round(width)}x${Math.round(height)}`;
  return <ArtSvg key={shape} drawing={drawing} width={width} height={height} facing={way} style={styles.fill} />;
}

const styles = StyleSheet.create({
  // Sized by width and height, not stretched by the block
  fill: { position: 'absolute', left: 0, top: 0 },
});

export default React.memo(DrawnVehicle);
