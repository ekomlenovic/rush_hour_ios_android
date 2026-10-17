import React, { useMemo } from 'react';
import { PixelRatio, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

/** SVG path of the dark modules, in module units with the quiet zone around */
export function qrPath(rows: [number, number][][]): string {
  return rows.map((runs, r) => runs.map(([start, length]) =>
    `M${start + QUIET_ZONE} ${r + QUIET_ZONE}h${length}v1h${-length}z`).join('')).join('');
}

interface Props {
  value: string;
  size: number;
  accessibilityLabel: string;
}

/**
 * QR code drawn on the phone: an invitation or a recovery code is a secret,
 * it never goes to an online QR service.
 * One SVG path on a whole number of pixels per module: views of fractional
 * size left seams between the rows and made the code unreadable.
 */
export default function QrCode({ value, size, accessibilityLabel }: Props) {
  const { size: modules, rows } = useMemo(() => qrRuns(value), [value]);
  const path = useMemo(() => qrPath(rows), [rows]);
  const total = modules + QUIET_ZONE * 2;
  const cell = Math.max(PixelRatio.roundToNearestPixel(size / total), 1 / PixelRatio.get());
  const side = cell * total;
  return (
    <View
      style={[styles.container, { width: side, height: side }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Black on white to be scanned, in dark mode too */}
      <Svg width={side} height={side} viewBox={`0 0 ${total} ${total}`}>
        <Path d={path} fill={fixedColors.qrForeground} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: fixedColors.qrBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
