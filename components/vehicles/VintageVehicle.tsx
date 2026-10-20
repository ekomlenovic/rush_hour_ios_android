import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import ArtSvg from '@/components/art/ArtSvg';
import { vintageVehicle } from '@/theme/art/vintageVehicles';

interface Props {
  length: number;
  orientation: 'horizontal' | 'vertical';
  color: string;
  width: number;
  height: number;
}

/** A 1930s vehicle seen from above (Mafia skin and palette), filling its block; a vertical one faces up */
function VintageVehicle({ length, orientation, color, width, height }: Props) {
  const drawing = useMemo(() => vintageVehicle(length, color), [length, color]);
  return <ArtSvg drawing={drawing} width={width} height={height} turnUp={orientation === 'vertical'} style={StyleSheet.absoluteFill} />;
}

export default React.memo(VintageVehicle);
