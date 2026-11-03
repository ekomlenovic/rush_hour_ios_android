import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, SHADOW, car, clover, van, vehicleGradients } from './vehicleKit';

/**
 * Saint Patrick's Day: the leprechaun's car of gold, its green hat on the roof and its pot of gold on the trunk
 * (skin), the shamrock car (2 cells) and the parade float with its rainbow (3 cells) of the palette, the clovers
 * and coins of its win effect and the backdrop of its board: green hills, a rainbow ending in a pot of gold,
 * shamrocks in the margins and Irish bunting.
 */

const SHAMROCK = '#22C55E';
const SHAMROCK_EDGE = '#14532D';
const RAINBOW = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#3B82F6', '#6366F1', '#A855F7'];

/** A shamrock: three heart leaves and a little stem toward (dx, dy) */
function shamrock(cx: number, cy: number, r: number, fill = SHAMROCK, edge = SHAMROCK_EDGE): ArtShape[] {
  return [
    path(`M${cx} ${cy} q${r * 0.6} ${r * 0.4} ${r * 0.8} ${r * 1.5}`, { fill: 'none', stroke: edge, strokeWidth: Math.max(1, r * 0.18), strokeLinecap: 'round' }),
    ...clover(cx, cy, r * 0.62, fill, edge, 3),
    circle(cx, cy, r * 0.12, { fill: edge, opacity: 0.6 }),
  ];
}

/** A gold coin seen from above */
const coin = (cx: number, cy: number, r: number): ArtShape[] => [
  circle(cx, cy, r, { fill: 'url(#coin)', stroke: '#92400E', strokeWidth: Math.max(0.5, r * 0.1) }),
  circle(cx, cy, r * 0.65, { fill: 'none', stroke: '#B45309', strokeWidth: Math.max(0.4, r * 0.08), opacity: 0.6 }),
];

/** A pot of gold seen from above: the black pot, coins heaped in it */
function potOfGold(cx: number, cy: number, r: number): ArtShape[] {
  const heap = [[0, 0], [-0.35, -0.3], [0.35, -0.25], [-0.3, 0.35], [0.32, 0.32], [0, -0.45], [0, 0.45], [-0.5, 0.02], [0.5, 0.02]];
  return [
    circle(cx + r * 0.15, cy + r * 0.2, r * 1.1, { fill: SHADOW, opacity: 0.3 }),
    circle(cx, cy, r * 1.1, { fill: '#1F2937', stroke: '#030712', strokeWidth: 1 }),
    circle(cx, cy, r * 0.92, { fill: '#B45309' }),
    ...heap.flatMap(([fx, fy]) => coin(cx + fx * r, cy + fy * r, r * 0.3)),
    circle(cx - r * 0.3, cy - r * 0.3, r * 0.14, { fill: '#FFFFFF', opacity: 0.7 }),
  ];
}

/** The leprechaun's top hat seen from above: its brim, the band and its gold buckle toward the front */
function topHat(cx: number, cy: number, r: number): ArtShape[] {
  return [
    circle(cx + 3, cy + 4, r, { fill: SHADOW, opacity: 0.35 }),
    circle(cx, cy, r, { fill: 'url(#hat)', stroke: '#052E16', strokeWidth: 1.2 }),
    circle(cx, cy, r * 0.68, { fill: '#111827' }),
    circle(cx, cy, r * 0.56, { fill: '#15803D', stroke: '#052E16', strokeWidth: 1 }),
    rect(cx + r * 0.46, cy - r * 0.2, r * 0.32, r * 0.4, { rx: 1.5, fill: 'none', stroke: '#FACC15', strokeWidth: 2.2 }),
    ...shamrock(cx - r * 0.06, cy - r * 0.06, r * 0.34, '#4ADE80', '#052E16'),
  ];
}

/** The leprechaun's car (target car skin): gold, its green hat on the roof, its pot of gold on the trunk */
function leprechaunCar(color: string): ArtShape[] {
  return [
    ...car(color),
    ...topHat(88, 50, 30),
    ...potOfGold(24, 50, 15),
    ...shamrock(170, 48, 11, '#16A34A'),
  ];
}

/** Shamrock car (2 cells): a big shamrock on the roof, a small one on the hood */
function shamrockCar(color: string): ArtShape[] {
  const leaf = light(color, 0.55);
  return [
    ...car(color),
    ...shamrock(84, 48, 26, leaf, dark(color, 0.5)),
    ...shamrock(170, 48, 9, leaf, dark(color, 0.5)),
  ];
}

/** Parade float (3 cells): a rainbow over a lawn, from a cloud to a pot of gold, shamrocks around */
function paradeFloat(color: string): ArtShape[] {
  const cloud = (x: number, y: number): ArtShape[] => [[-8, 0, 9], [4, -4, 10], [12, 4, 8], [0, 7, 8]].map(([dx, dy, r]) =>
    circle(x + dx, y + dy, r, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 0.6 }));
  return [
    ...van(color, 'url(#lawn)'),
    ...RAINBOW.map((c, i) => {
      const r = 82 - i * 6.5;
      return path(`M${110 - r} 80 A${r} ${r * 0.78} 0 0 1 ${110 + r} 80`, { fill: 'none', stroke: c, strokeWidth: 6.5 });
    }),
    ...cloud(30, 74),
    ...potOfGold(186, 72, 12),
    ...shamrock(110, 64, 12),
    ...shamrock(60, 32, 8),
    ...shamrock(160, 30, 8),
    ...topHat(231, 50, 13),
  ];
}

const gradients = (color: string) => vehicleGradients(color, [
  { id: 'hat', radial: true, stops: [{ offset: 0, color: '#22C55E' }, { offset: 0.8, color: '#15803D' }, { offset: 1, color: '#14532D' }] },
  { id: 'coin', radial: true, stops: [{ offset: 0, color: '#FEF3C7' }, { offset: 0.6, color: '#FACC15' }, { offset: 1, color: '#CA8A04' }] },
  { id: 'lawn', stops: [{ offset: 0, color: '#15803D' }, { offset: 0.5, color: '#4ADE80' }, { offset: 1, color: '#15803D' }] },
]);

/** The leprechaun's car of the target car, front on the right (2 cells) */
export function leprechaunDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: leprechaunCar(color) };
}

/** A vehicle of the Saint Patrick palette: the shamrock car for 2 cells, the parade float for 3 or more */
export function emeraldVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? paradeFloat(color) : shamrockCar(color) };
}

// ─── Win effect: clovers ──────────────────────────────────────────────────────

const coinGradient = gradients('#16A34A').filter(g => g.id === 'coin');

/** The drawings of the clovers effect: four-leaf clovers, shamrocks and gold coins */
export const CLOVER_DRAWINGS: ArtDrawing[] = [
  { width: 40, height: 40, gradients: [], shapes: [...clover(20, 20, 9.5, '#22C55E', '#14532D'), circle(20, 20, 2, { fill: '#14532D' })] },
  { width: 40, height: 40, gradients: coinGradient, shapes: [...coin(20, 20, 15), ...shamrock(20, 19, 8, '#CA8A04', '#92400E')] },
  { width: 40, height: 40, gradients: [], shapes: shamrock(20, 18, 17, '#4ADE80', '#166534') },
  { width: 40, height: 40, gradients: [], shapes: [...clover(20, 20, 9.5, '#16A34A', '#052E16'), circle(20, 20, 2, { fill: '#052E16' })] },
];

// ─── Backdrop ─────────────────────────────────────────────────────────────────

export function stPatrickBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(317);
  // Irish bunting along the very top: green, white and orange pennants on a thin string
  const count = Math.max(2, Math.round(w / (110 * u)));
  const swag = w / count;
  const sag = 8 * u;
  const flags = ['#16A34A', darkScheme ? '#E5E7EB' : '#FFFFFF', '#F97316'];
  const bunting = Array.from({ length: count }, (_, i) => {
    const x0 = i * swag;
    const n = Math.max(3, Math.round(swag / (16 * u)));
    const pennants = Array.from({ length: n }, (_, j) => {
      const f0 = (j + 0.15) / n;
      const f1 = (j + 0.85) / n;
      const y = (f: number) => sag * 4 * f * (1 - f);
      const fm = (f0 + f1) / 2;
      return path(`M${x0 + f0 * swag} ${y(f0)} L${x0 + f1 * swag} ${y(f1)} L${x0 + fm * swag} ${y(fm) + 12 * u} Z`,
        { fill: flags[(i * n + j) % 3], stroke: '#000000', strokeOpacity: 0.2, strokeWidth: 0.6 });
    });
    return [path(`M${x0} 0 Q${x0 + swag / 2} ${sag * 2} ${x0 + swag} 0`, { fill: 'none', stroke: darkScheme ? '#86EFAC' : '#166534', strokeWidth: 1.2 }), ...pennants];
  }).flat();
  // Shamrocks drifting along both sides, under the texts
  const drifting = Array.from({ length: Math.max(4, Math.round((h - (CALM_TOP + 150) * u) / (46 * u))) }, (_, i) => {
    const y = (CALM_TOP + 20) * u + i * 46 * u + rand() * 14 * u;
    const x = i % 2 ? w - (12 + rand() * 8) * u : (12 + rand() * 8) * u;
    const r = (8 + rand() * 6) * u;
    return shamrock(x, y, r, ['#22C55E', '#4ADE80', '#16A34A'][i % 3], darkScheme ? '#052E16' : '#14532D');
  }).flat();
  // Hills along the bottom, a rainbow ending in a pot of gold on the near one
  const ground = h - 34 * u;
  const pot = { x: w * 0.74, y: ground - 4 * u };
  const foot = -12 * u;
  const rc = (foot + pot.x) / 2;
  const rr = (pot.x - foot) / 2;
  const rainbow = RAINBOW.map((c, i) => {
    const r = rr - i * 5 * u;
    return path(`M${rc - r} ${ground} A${r} ${Math.min(r * 0.9, h * 0.45)} 0 0 1 ${rc + r} ${ground}`, { fill: 'none', stroke: c, strokeWidth: 5 * u, opacity: darkScheme ? 0.55 : 0.7 });
  });
  const far = `M0 ${h} L0 ${ground - 40 * u} Q${w * 0.25} ${ground - 70 * u} ${w * 0.5} ${ground - 38 * u} Q${w * 0.78} ${ground - 8 * u} ${w} ${ground - 50 * u} L${w} ${h} Z`;
  const near = `M0 ${h} L0 ${ground - 4 * u} Q${w * 0.3} ${ground - 30 * u} ${w * 0.6} ${ground - 2 * u} Q${w * 0.82} ${ground + 14 * u} ${w} ${ground - 16 * u} L${w} ${h} Z`;
  const clouds = [[-0.2, 0, 13], [0.9, -0.5, 15], [2, 0.1, 12], [0.8, 0.6, 12]].map(([dx, dy, r]) =>
    circle(14 * u + dx * 14 * u, ground - 26 * u + dy * 14 * u, r * u, { fill: darkScheme ? '#CBD5E1' : '#FFFFFF', opacity: darkScheme ? 0.6 : 0.95 }));
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return path(`M${pot.x + Math.cos(a) * 20 * u} ${pot.y - 10 * u + Math.sin(a) * 16 * u} l${Math.cos(a) * 6 * u} ${Math.sin(a) * 6 * u}`, { stroke: '#FACC15', strokeWidth: 1.6 * u, strokeLinecap: 'round', opacity: 0.8 });
  });
  const grass = Array.from({ length: Math.round(w / (7 * u)) }, (_, i) => {
    const x = i * 7 * u + rand() * 3 * u;
    const y = ground + (rand() * 20 + 6) * u;
    return path(`M${x} ${y} l${1.5 * u} ${-6 * u} l${1.5 * u} ${6 * u}`, { fill: darkScheme ? '#166534' : '#15803D', opacity: 0.7 });
  });
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#0B1F17' }, { offset: 0.6, color: '#0C2219' }, { offset: 1, color: '#0A1A12' }]
        : [{ offset: 0, color: '#E3F4EA' }, { offset: 0.6, color: '#F1FAF3' }, { offset: 1, color: '#E7F6E2' }] },
      { id: 'coin', radial: true, stops: [{ offset: 0, color: '#FEF3C7' }, { offset: 0.6, color: '#FACC15' }, { offset: 1, color: '#CA8A04' }] },
      { id: 'glow', radial: true, stops: [{ offset: 0, color: '#FACC15', opacity: 0.5 }, { offset: 1, color: '#FACC15', opacity: 0 }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...drifting,
      ...rainbow,
      path(far, { fill: darkScheme ? '#14532D' : '#86EFAC', opacity: darkScheme ? 0.7 : 1 }),
      ...clouds,
      path(near, { fill: darkScheme ? '#166534' : '#22C55E' }),
      ...grass,
      circle(pot.x, pot.y - 8 * u, 34 * u, { fill: 'url(#glow)' }),
      ...sparks,
      ellipse(pot.x + 2 * u, pot.y + 10 * u, 22 * u, 5 * u, { fill: '#000000', opacity: 0.2 }),
      path(`M${pot.x - 18 * u} ${pot.y - 10 * u} Q${pot.x - 22 * u} ${pot.y + 12 * u} ${pot.x} ${pot.y + 12 * u} Q${pot.x + 22 * u} ${pot.y + 12 * u} ${pot.x + 18 * u} ${pot.y - 10 * u} Z`, { fill: '#1F2937', stroke: '#030712', strokeWidth: 1 }),
      ...[[-12, -14], [-4, -18], [5, -16], [13, -13], [-8, -21], [2, -23], [9, -20]].flatMap(([dx, dy]) => coin(pot.x + dx * u, pot.y + dy * u, 5 * u)),
      rect(pot.x - 21 * u, pot.y - 12 * u, 42 * u, 5 * u, { rx: 2.5 * u, fill: '#374151', stroke: '#030712', strokeWidth: 1 }),
      ...shamrock(w * 0.16, ground + 12 * u, 9 * u),
      ...shamrock(w * 0.42, ground + 18 * u, 7 * u, '#4ADE80'),
      ...shamrock(w - 22 * u, ground + 16 * u, 8 * u),
      ...bunting,
    ],
  };
}
