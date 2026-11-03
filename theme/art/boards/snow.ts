import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Snow board, a winter in the mountains (nothing of Christmas, which has its own board): falling
 * snow, big flakes in the margins, snowy peaks, a chairlift, a chalet, fir trees and a snowman at the bottom.
 * A winter day in light mode, the night and the lit windows of the chalet in dark mode.
 */

/** A six-branch snowflake */
function flake(cx: number, cy: number, r: number, color: string, opacity: number): ArtShape[] {
  return Array.from({ length: 3 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    return line(cx - dx, cy - dy, cx + dx, cy + dy, { stroke: color, strokeWidth: r * 0.16, strokeLinecap: 'round', opacity });
  }).concat(Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const bx = cx + Math.cos(a) * r * 0.6;
    const by = cy + Math.sin(a) * r * 0.6;
    const b = r * 0.28;
    return path(`M${bx + Math.cos(a + 0.9) * b} ${by + Math.sin(a + 0.9) * b} L${bx} ${by} L${bx + Math.cos(a - 0.9) * b} ${by + Math.sin(a - 0.9) * b}`,
      { fill: 'none', stroke: color, strokeWidth: r * 0.12, strokeLinecap: 'round', opacity });
  }));
}

/** A snowy fir tree, its foot at x, y */
function fir(x: number, y: number, k: number, green: string): ArtShape[] {
  return [
    rect(x - 3 * k, y - 8 * k, 6 * k, 8 * k, { fill: '#7C4A26' }),
    ...[0, 1, 2].flatMap(i => {
      const top = y - (20 + i * 14) * k;
      const half = (20 - i * 5) * k;
      return [
        path(`M${x} ${top - 16 * k} L${x + half} ${top + 8 * k} L${x - half} ${top + 8 * k} Z`, { fill: dark(green, i * 0.06) }),
        path(`M${x} ${top - 16 * k} L${x + half * 0.45} ${top - 5 * k} L${x} ${top - 8 * k} L${x - half * 0.45} ${top - 5 * k} Z`, { fill: '#FFFFFF', opacity: 0.9 }),
      ];
    }),
  ];
}

export function snowBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const night = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(1212);
  const ground = h - 46 * u;
  const snowColor = night ? '#DCE8F5' : '#FFFFFF';
  const fall = Array.from({ length: 60 }, () =>
    circle(rand() * w, (CALM_TOP + 10) * u + rand() * (h - (CALM_TOP + 10) * u), (0.8 + rand() * 1.6) * u, { fill: snowColor, opacity: night ? 0.55 : 0.85 }));
  // The peaks behind, their snowy caps
  const mountain = night ? '#2C4566' : '#9DBAD6';
  const peaks = [[0.08, 150], [0.32, 205], [0.58, 170], [0.84, 220], [1.05, 160]].flatMap(([f, height]) => {
    const px = w * f;
    const py = ground - height * u;
    const half = height * u * 0.95;
    return [
      path(`M${px - half} ${ground} L${px} ${py} L${px + half} ${ground} Z`, { fill: mountain }),
      path(`M${px} ${py} L${px + half * 0.3} ${py + height * u * 0.3} L${px + half * 0.12} ${py + height * u * 0.24} L${px} ${py + height * u * 0.32}`
        + ` L${px - half * 0.14} ${py + height * u * 0.25} L${px - half * 0.3} ${py + height * u * 0.3} Z`, { fill: snowColor }),
    ];
  });
  // The chairlift crossing the valley
  const cable = (x: number) => ground - 70 * u - (x / w) * 60 * u;
  const chairs = [0.12, 0.38, 0.64, 0.9].flatMap(f => {
    const x = w * f;
    const y = cable(x);
    return [
      line(x, y, x, y + 16 * u, { stroke: '#334155', strokeWidth: 1.2 }),
      path(`M${x - 8 * u} ${y + 16 * u} H${x + 8 * u} V${y + 24 * u} H${x - 8 * u} Z`, { fill: night ? '#B91C1C' : '#DC2626', stroke: '#334155', strokeWidth: 0.8 }),
      line(x - 8 * u, y + 16 * u, x - 8 * u, y + 10 * u, { stroke: '#334155', strokeWidth: 1 }),
    ];
  });
  const chalet = w * 0.7;
  const window = night ? '#FDE68A' : '#BFDBFE';
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: night
        ? [{ offset: 0, color: '#0B1628' }, { offset: 1, color: '#1C3352' }]
        : [{ offset: 0, color: '#DCEBF7' }, { offset: 1, color: '#F3F8FC' }] },
      { id: 'snow', stops: [{ offset: 0, color: snowColor }, { offset: 1, color: night ? '#A9BCD3' : '#DBEAFE' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...fall,
      // Big flakes in the margins, under the texts
      ...flake(w * 0.12, (CALM_TOP + 44) * u, 9 * u, snowColor, 0.9),
      ...flake(w - 12 * u, h * 0.42, 10 * u, night ? '#9CC7E8' : '#93C5FD', 0.9),
      ...flake(10 * u, h * 0.56, 8 * u, night ? '#9CC7E8' : '#93C5FD', 0.9),
      ...flake(w - 10 * u, h * 0.66, 6 * u, snowColor, 0.9),
      ...peaks,
      line(0, cable(0), w, cable(w), { stroke: '#334155', strokeWidth: 1.4 }),
      ...chairs,
      // The snowy ground, the chalet, fir trees and the snowman
      path(`M0 ${ground} Q${w * 0.25} ${ground - 14 * u} ${w * 0.5} ${ground - 4 * u} T${w} ${ground - 8 * u} V${h} H0 Z`, { fill: 'url(#snow)' }),
      rect(chalet, ground - 30 * u, 52 * u, 30 * u, { fill: '#92400E', stroke: '#5C2E0E', strokeWidth: 1 }),
      ...[0, 1, 2, 3].map(i => line(chalet, ground - (6 + i * 7) * u, chalet + 52 * u, ground - (6 + i * 7) * u, { stroke: '#5C2E0E', strokeWidth: 0.8, opacity: 0.6 })),
      path(`M${chalet - 8 * u} ${ground - 28 * u} L${chalet + 26 * u} ${ground - 54 * u} L${chalet + 60 * u} ${ground - 28 * u} Z`, { fill: '#5C2E0E' }),
      path(`M${chalet - 8 * u} ${ground - 28 * u} L${chalet + 26 * u} ${ground - 56 * u} L${chalet + 60 * u} ${ground - 28 * u} L${chalet + 54 * u} ${ground - 32 * u} L${chalet + 26 * u} ${ground - 50 * u} L${chalet - 2 * u} ${ground - 32 * u} Z`, { fill: snowColor }),
      rect(chalet + 8 * u, ground - 22 * u, 10 * u, 9 * u, { fill: window, stroke: '#5C2E0E', strokeWidth: 1 }),
      rect(chalet + 34 * u, ground - 22 * u, 10 * u, 9 * u, { fill: window, stroke: '#5C2E0E', strokeWidth: 1 }),
      rect(chalet + 21 * u, ground - 16 * u, 10 * u, 16 * u, { fill: '#5C2E0E' }),
      ...fir(w * 0.08, ground + 6 * u, 0.85 * u, '#166534'),
      ...fir(w * 0.22, ground + 12 * u, 0.62 * u, '#15803D'),
      ...fir(w * 0.94, ground + 8 * u, 0.7 * u, '#166534'),
      // The snowman, his scarf and carrot nose
      circle(w * 0.44, ground + 14 * u, 15 * u, { fill: snowColor, stroke: night ? '#94A3B8' : '#CBD5E1', strokeWidth: 1 }),
      circle(w * 0.44, ground - 8 * u, 10 * u, { fill: snowColor, stroke: night ? '#94A3B8' : '#CBD5E1', strokeWidth: 1 }),
      rect(w * 0.44 - 10 * u, ground - 1 * u, 20 * u, 4 * u, { rx: 2 * u, fill: '#2563EB' }),
      rect(w * 0.44 + 4 * u, ground + 1 * u, 4 * u, 10 * u, { rx: 1.5 * u, fill: '#2563EB' }),
      circle(w * 0.44 - 3.5 * u, ground - 11 * u, 1.3 * u, { fill: '#1F2937' }),
      circle(w * 0.44 + 3.5 * u, ground - 11 * u, 1.3 * u, { fill: '#1F2937' }),
      path(`M${w * 0.44} ${ground - 8 * u} l${9 * u} ${2 * u} l${-9 * u} ${2 * u} Z`, { fill: '#F97316' }),
      ...[0, 1, 2].map(i => circle(w * 0.44, ground + (8 + i * 6) * u, 1.3 * u, { fill: '#1F2937' })),
    ],
  };
}
