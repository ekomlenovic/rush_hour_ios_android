import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Pixel board, in the four greens of the old handheld consoles: blocky clouds, stepped hills, round
 * trees, floating coins and a brick ground. By day in light mode, at night (moon and stars) in dark mode.
 */

const DARKEST = '#0F380F';
const DARK = '#306230';
const LIGHT = '#8BAC0F';
const LIGHTEST = '#9BBC0F';

/** A bitmap drawn as rectangles, one per run of the same color on a row ('.' is empty) */
function bitmap(rows: string[], x: number, y: number, p: number, colors: Record<string, string>): ArtShape[] {
  const shapes: ArtShape[] = [];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length;) {
      const c = row[i];
      let k = i + 1;
      while (k < row.length && row[k] === c) k++;
      if (colors[c]) shapes.push(rect(x + i * p, y + j * p, (k - i) * p + 0.3, p + 0.3, { fill: colors[c] }));
      i = k;
    }
  });
  return shapes;
}

const CLOUD = [
  '....oooo......',
  '..oo####oo....',
  '.o########ooo.',
  'o############o',
  'o############o',
  '.oooooooooooo.',
];
const TREE = [
  '..####..',
  '.######.',
  '########',
  '#####o##',
  '.######.',
  '...||...',
  '...||...',
];
const COIN = [
  '.oo.',
  'o#.o',
  'o#.o',
  'o#.o',
  '.oo.',
];
const MOON = [
  '..####..',
  '.###..#.',
  '####....',
  '####....',
  '.###..#.',
  '..####..',
];

/** A stepped hill: its top follows a half ellipse, in steps of one pixel */
function hill(cx: number, r: number, height: number, ground: number, p: number, fill: string): ArtShape {
  const start = Math.floor((cx - r) / p) * p;
  let d = `M${start} ${ground}`;
  for (let x = start; x < cx + r; x += p) {
    const f = (x + p / 2 - cx) / r;
    const top = Math.round((height * Math.sqrt(Math.max(0, 1 - f * f))) / p) * p;
    d += ` V${ground - top} H${x + p}`;
  }
  return path(d + ` V${ground} Z`, { fill });
}

export function pixelBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const night = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(8);
  const p = Math.max(3, Math.round(4.5 * u));
  const ground = Math.round((h - 5 * p) / p) * p;
  const sky = night ? DARKEST : LIGHT;
  const cloud = { '#': night ? DARK : LIGHTEST, o: night ? LIGHT : DARK };
  const tree = { '#': DARKEST, o: DARK, '|': DARKEST };
  const coin = { o: DARKEST, '#': LIGHTEST };
  // Bricks of the ground: a line every two pixels, joints staggered
  let bricks = '';
  for (let row = 0, y = ground + p; y < h; y += 2 * p, row++) {
    bricks += ` M0 ${y} H${w}`;
    for (let x = (row % 2) * 2 * p; x < w; x += 4 * p) bricks += ` M${x} ${y} V${y + 2 * p}`;
  }
  const stars = night
    ? Array.from({ length: 26 }, () => rect(Math.round((rand() * w) / p) * p, Math.round(((CALM_TOP + 4) * u + rand() * (ground - (CALM_TOP + 4) * u) * 0.8) / p) * p, p, p, { fill: rand() < 0.3 ? LIGHTEST : LIGHT }))
    : [];
  const strip = (CALM_TOP + 34) * u;
  return {
    width: w,
    height: h,
    gradients: [],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: sky })]),
      ...stars,
      ...(night ? bitmap(MOON, Math.round((w * 0.74) / p) * p, Math.round(strip / p) * p, p, { '#': LIGHTEST }) : []),
      // Clouds under the texts and on the edges
      ...bitmap(CLOUD, Math.round(w * 0.12 / p) * p, Math.round(strip / p) * p, p, cloud),
      ...bitmap(CLOUD, w - 9 * p, Math.round((h * 0.46) / p) * p, p, cloud),
      ...bitmap(CLOUD, -6 * p, Math.round((h * 0.62) / p) * p, p, cloud),
      // Hills, trees and coins on the ground
      hill(w * 0.18, 26 * p, 12 * p, ground, p, DARK),
      hill(w * 0.8, 34 * p, 16 * p, ground, p, DARK),
      hill(w * 0.52, 16 * p, 7 * p, ground, p, night ? DARKEST : DARK),
      ...bitmap(TREE, Math.round(w * 0.06 / p) * p, ground - 7 * p, p, tree),
      ...bitmap(TREE, Math.round(w * 0.36 / p) * p, ground - 7 * p, p, tree),
      ...bitmap(TREE, Math.round(w * 0.9 / p) * p, ground - 7 * p, p, tree),
      ...[0.52, 0.6, 0.68].flatMap(f => bitmap(COIN, Math.round((w * f) / p) * p, ground - 12 * p, p, coin)),
      rect(0, ground, w, p, { fill: night ? DARK : DARKEST }),
      rect(0, ground + p, w, h - ground - p, { fill: night ? DARKEST : DARK }),
      path(bricks, { fill: 'none', stroke: night ? DARK : DARKEST, strokeWidth: Math.max(1, p / 4) }),
    ],
  };
}
