import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CAR_SKINS, CLASSIC_VEHICLE_COLORS, TARGET_CAR_COLOR, VEHICLE_PALETTES, getUiColors, type ColorScheme } from '@/theme';
import { DEFAULT_COSMETICS, type CosmeticDef, type CosmeticSelection } from '@/data/cosmetics';
import type { BoardThemeId, CarSkinId, VehiclePaletteId } from '@/theme/board';
import BoardPreview from './BoardPreview';

interface Props {
  def: CosmeticDef;
  scheme: ColorScheme;
  size: number;
  locked?: boolean;
}

/** Small picture of a cosmetic: the board, the car with its skin, the palette colors or the effect */
export default function CosmeticThumb({ def, scheme, size, locked }: Props) {
  let content: React.ReactNode;

  if (def.kind === 'board') {
    const selection: CosmeticSelection = { ...DEFAULT_COSMETICS, board: def.id as BoardThemeId };
    content = <BoardPreview selection={selection} scheme={scheme} size={size} />;
  } else if (def.kind === 'skin') {
    const skin = CAR_SKINS[def.id as CarSkinId];
    content = (
      <View style={[styles.car, { width: size, height: size * 0.5, borderRadius: size * 0.12, backgroundColor: skin?.color ?? TARGET_CAR_COLOR }]}>
        <Text style={{ fontSize: size * 0.3 }}>{skin?.icon ?? def.icon}</Text>
      </View>
    );
  } else if (def.kind === 'palette') {
    const colors = (VEHICLE_PALETTES[def.id as VehiclePaletteId] ?? CLASSIC_VEHICLE_COLORS).slice(0, 4);
    const swatch = size / 2 - 3;
    content = (
      <View style={[styles.swatches, { width: size, height: size }]}>
        {colors.map(color => (
          <View key={color} style={{ width: swatch, height: swatch, borderRadius: swatch * 0.25, backgroundColor: color }} />
        ))}
      </View>
    );
  } else {
    content = <Text style={{ fontSize: size * 0.55 }}>{def.icon}</Text>;
  }

  const lockColor = getUiColors(scheme).text;
  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={locked ? styles.locked : undefined}>{content}</View>
      {locked && <Ionicons name="lock-closed" size={Math.max(12, size * 0.22)} color={lockColor} style={styles.lock} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  car: { alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignContent: 'center', justifyContent: 'center' },
  locked: { opacity: 0.35 },
  lock: { position: 'absolute', right: -2, bottom: -2 },
});
