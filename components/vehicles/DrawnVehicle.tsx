import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import ArtSvg from '@/components/art/ArtSvg';
import type { VehicleArt } from '@/theme';
import { drawVehicle } from '@/theme/art/vehicles';

interface Props {
  art: VehicleArt;
  length: number;
  orientation: 'horizontal' | 'vertical';
  color: string;
  width: number;
  height: number;
}

/** A drawn vehicle seen from above (Mafia or 1800 skin and palette: cars or ships), filling its block; a vertical one faces up */
function DrawnVehicle({ art, length, orientation, color, width, height }: Props) {
  const drawing = useMemo(() => drawVehicle(art, length, color), [art, length, color]);
  // A vehicle turned in the creator changes its size and viewBox at once: react-native-svg can keep the old
  // drawing, cut by the new box (half a vehicle, still the old way). A new shape gets a new Svg
  const shape = `${orientation}-${length}-${Math.round(width)}x${Math.round(height)}`;
  return <ArtSvg key={shape} drawing={drawing} width={width} height={height} turnUp={orientation === 'vertical'} style={styles.fill} />;
}

const styles = StyleSheet.create({
  // Sized by width and height, not stretched by the block
  fill: { position: 'absolute', left: 0, top: 0 },
});

export default React.memo(DrawnVehicle);
