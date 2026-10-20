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
  return <ArtSvg drawing={drawing} width={width} height={height} turnUp={orientation === 'vertical'} style={StyleSheet.absoluteFill} />;
}

export default React.memo(DrawnVehicle);
