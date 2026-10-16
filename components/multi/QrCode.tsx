import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import qrcode from 'qrcode-generator';
import { fixedColors } from '@/theme';

/** Dark modules of each row as [start, length] runs: a row is drawn with a few views */
export function qrRuns(text: string): { size: number; rows: [number, number][][] } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const rows: [number, number][][] = [];
  for (let r = 0; r < size; r++) {
    const runs: [number, number][] = [];
    for (let c = 0; c < size; c++) {
      if (!qr.isDark(r, c)) continue;
      const last = runs[runs.length - 1];
      if (last && last[0] + last[1] === c) last[1]++;
      else runs.push([c, 1]);
    }
    rows.push(runs);
  }
  return { size, rows };
}

const QUIET_ZONE = 4;

interface Props {
  value: string;
  size: number;
  accessibilityLabel: string;
}

/**
 * QR code drawn on the phone: an invitation or a recovery code is a secret,
 * it never goes to an online QR service.
 */
export default function QrCode({ value, size, accessibilityLabel }: Props) {
  const { size: modules, rows } = useMemo(() => qrRuns(value), [value]);
  const cell = size / (modules + QUIET_ZONE * 2);
  return (
    <View
      style={[styles.container, { width: size, height: size, padding: cell * QUIET_ZONE }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {rows.map((runs, r) => (
        <View key={r} style={{ height: cell, width: cell * modules }}>
          {runs.map(([start, length]) => (
            <View key={start} style={[styles.module, { left: start * cell, width: length * cell, height: cell }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: fixedColors.qrBackground,
    borderRadius: 12,
  },
  module: {
    position: 'absolute',
    top: 0,
    // Black on white to be scanned, in dark mode too
    backgroundColor: fixedColors.qrForeground,
  },
});
