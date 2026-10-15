import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { getExitSide } from '@/utils/creatorGeometry';
import { useTheme } from '@/theme';

interface Props {
  exitRow: number;
  exitCol: number;
  gridSize: number;
  cellSize: number;
}

/** "EXIT" label, gate and glow on the side of the board where the target car leaves */
export default function ExitMarker({ exitRow, exitCol, gridSize, cellSize }: Props) {
  const { board } = useTheme();
  const exitColor = board.exit;
  const side = getExitSide(exitRow, exitCol, gridSize);

  // Gate styles
  let indicatorStyle: ViewStyle | null = null;
  let glowStyle: ViewStyle | null = null;

  // Label styles
  let labelStyle: ViewStyle | null = null;
  let arrow = '▶';

  if (side === 'Right') {
    indicatorStyle = { top: exitRow * cellSize + cellSize * 0.2, right: 0, width: 6, height: cellSize * 0.6, borderRadius: 3 };
    glowStyle = { top: exitRow * cellSize, right: -8, width: 16, height: cellSize, opacity: 0.15, borderRadius: 8 };
    labelStyle = { top: exitRow * cellSize + cellSize * 0.5 - 10, right: 2 };
    arrow = '▶';
  } else if (side === 'Left') {
    indicatorStyle = { top: exitRow * cellSize + cellSize * 0.2, left: 0, width: 6, height: cellSize * 0.6, borderRadius: 3 };
    glowStyle = { top: exitRow * cellSize, left: -8, width: 16, height: cellSize, opacity: 0.15, borderRadius: 8 };
    labelStyle = { top: exitRow * cellSize + cellSize * 0.5 - 10, left: 2, flexDirection: 'row-reverse' };
    arrow = '◀';
  } else if (side === 'Bottom') {
    indicatorStyle = { left: exitCol * cellSize + cellSize * 0.2, bottom: 0, height: 6, width: cellSize * 0.6, borderRadius: 3 };
    glowStyle = { left: exitCol * cellSize, bottom: -8, height: 16, width: cellSize, opacity: 0.15, borderRadius: 8 };
    labelStyle = { left: exitCol * cellSize + cellSize * 0.5 - 10, bottom: 2, flexDirection: 'column' };
    arrow = '▼';
  } else if (side === 'Top') {
    indicatorStyle = { left: exitCol * cellSize + cellSize * 0.2, top: 0, height: 6, width: cellSize * 0.6, borderRadius: 3 };
    glowStyle = { left: exitCol * cellSize, top: -8, height: 16, width: cellSize, opacity: 0.15, borderRadius: 8 };
    labelStyle = { left: exitCol * cellSize + cellSize * 0.5 - 10, top: 2, flexDirection: 'column-reverse' };
    arrow = '▲';
  }

  return (
    <>
      {/* Label */}
      <View style={[styles.exitLabelWrap, labelStyle]}>
        <Text style={[styles.exitLabel, { color: exitColor }]}>EXIT</Text>
        <Text style={[styles.exitArrow, { color: exitColor }]}>{arrow}</Text>
      </View>

      {/* Indicator & Glow */}
      {indicatorStyle && <View style={[styles.exitIndicator, { backgroundColor: exitColor, ...indicatorStyle }]} />}
      {glowStyle && <View style={{ position: 'absolute', backgroundColor: exitColor, ...glowStyle }} />}
    </>
  );
}

const styles = StyleSheet.create({
  exitLabelWrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 10 },
  exitIndicator: {
    position: 'absolute',
    width: 6,
    borderRadius: 3,
    zIndex: 10,
  },
  exitLabel: { fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  exitArrow: { fontSize: 11 },
});
