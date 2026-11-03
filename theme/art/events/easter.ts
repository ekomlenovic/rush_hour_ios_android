import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, tires, van, vehicleGradients } from './vehicleKit';

/**
 * Easter: the chocolate bunny car of the target car (skin), the painted egg car (2 cells) and the van carrying its
 * basket of eggs (3 cells) of the palette, the eggs and bells of its win effect and the backdrop of its board:
 * a spring meadow, eggs hidden in the grass, a bunny peeking out, flying bells and butterflies in the margins.
 */

const EGGS = ['#F472B6', '#60A5FA', '#FACC15', '#4ADE80', '#A78BFA', '#FB923C'];

/** An egg standing up (narrow on top) centered on (cx, cy), turned by deg */
function eggShape(cx: number, cy: number, rx: number, ry: number, attrs: Record<string, string | number>, deg = 0): ArtShape {
  const d = `M${cx} ${cy - ry} C${cx + rx * 0.75} ${cy - ry} ${cx + rx} ${cy + ry * 0.1} ${cx + rx} ${cy + ry * 0.3} C${cx + rx} ${cy + ry * 0.85} ${cx + rx * 0.5} ${cy + ry} ${cx} ${cy + ry} C${cx - rx * 0.5} ${cy + ry} ${cx - rx} ${cy + ry * 0.85} ${cx - rx} ${cy + ry * 0.3} C${cx - rx} ${cy + ry * 0.1} ${cx - rx * 0.75} ${cy - ry} ${cx} ${cy - ry} Z`;
  return path(d, deg ? { ...attrs, transform: `rotate(${deg} ${cx} ${cy})` } : attrs);
}

/** A painted egg: its color, a zigzag band, dots or a stripe (pattern), its shine */
export function paintedEgg(cx: number, cy: number, rx: number, ry: number, color: string, pattern: number, deg = 0): ArtShape[] {
  const accent = pattern % 2 ? '#FFFFFF' : light(color, 0.6);
  const rot: Record<string, string> = deg ? { transform: `rotate(${deg} ${cx} ${cy})` } : {};
  const zig = Array.from({ length: 7 }, (_, i) => `${cx - rx * 0.92 + (i * rx * 1.84) / 6} ${cy + ry * 0.2 + (i % 2 ? -ry * 0.16 : ry * 0.12)}`).join(' L');
  const decor: ArtShape[] = pattern % 3 === 0
    ? [path(`M${zig}`, { fill: 'none', stroke: accent, strokeWidth: Math.max(1, rx * 0.16), strokeLinejoin: 'round', ...rot })]
    : pattern % 3 === 1
      ? [[-0.45, -0.1], [0, -0.3], [0.45, -0.1], [-0.3, 0.4], [0.3, 0.4], [0, 0.15]].map(([fx, fy]) => circle(cx + fx * rx, cy + fy * ry, rx * 0.14, { fill: accent, ...rot }))
      : [rect(cx - rx * 0.97, cy - ry * 0.05, rx * 1.94, ry * 0.26, { fill: accent, ...rot }), rect(cx - rx * 0.86, cy - ry * 0.42, rx * 1.72, ry * 0.1, { fill: dark(color, 0.25), ...rot })];
  return [
    eggShape(cx + rx * 0.12, cy + ry * 0.1, rx, ry, { fill: SHADOW, opacity: 0.25 }, deg),
    eggShape(cx, cy, rx, ry, { fill: color, stroke: dark(color, 0.35), strokeWidth: Math.max(0.6, rx * 0.08) }, deg),
    ...decor,
    ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.2, ry * 0.14, { fill: '#FFFFFF', opacity: 0.55, ...rot }),
  ];
}

/** A chocolate egg, half wrapped in gold foil */
function chocolateEgg(cx: number, cy: number, rx: number, ry: number): ArtShape[] {
  return [
    eggShape(cx, cy, rx, ry, { fill: '#6B3A1E', stroke: '#3B1F0E', strokeWidth: Math.max(0.6, rx * 0.08) }),
    path(`M${cx - rx} ${cy + ry * 0.25} L${cx - rx * 0.6} ${cy + ry * 0.05} L${cx - rx * 0.2} ${cy + ry * 0.3} L${cx + rx * 0.2} ${cy + ry * 0.05} L${cx + rx * 0.6} ${cy + ry * 0.3} L${cx + rx} ${cy + ry * 0.1} C${cx + rx} ${cy + ry * 0.85} ${cx + rx * 0.5} ${cy + ry} ${cx} ${cy + ry} C${cx - rx * 0.5} ${cy + ry} ${cx - rx} ${cy + ry * 0.85} ${cx - rx} ${cy + ry * 0.25} Z`, { fill: 'url(#foil)', stroke: '#92400E', strokeWidth: Math.max(0.5, rx * 0.06) }),
    ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.18, ry * 0.12, { fill: '#FFFFFF', opacity: 0.35 }),
  ];
}

/** A flying Easter bell (French tradition): gold, a ribbon and its bow, small wings */
function flyingBell(cx: number, cy: number, s: number): ArtShape[] {
  const wing = (side: number) => path(`M${cx + side * 8 * s} ${cy - 4 * s} q${side * 12 * s} ${-12 * s} ${side * 20 * s} ${-6 * s} q${-side * 4 * s} ${4 * s} ${-side * 2 * s} ${7 * s} q${-side * 6 * s} ${2 * s} ${-side * 18 * s} ${4 * s} Z`,
    { fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 0.8 });
  return [
    wing(-1), wing(1),
    path(`M${cx - 11 * s} ${cy + 8 * s} Q${cx - 10 * s} ${cy - 12 * s} ${cx} ${cy - 13 * s} Q${cx + 10 * s} ${cy - 12 * s} ${cx + 11 * s} ${cy + 8 * s} L${cx + 13 * s} ${cy + 10 * s} L${cx - 13 * s} ${cy + 10 * s} Z`, { fill: 'url(#bell)', stroke: '#92400E', strokeWidth: 1 }),
    circle(cx, cy + 12 * s, 3 * s, { fill: '#B45309' }),
    rect(cx - 10 * s, cy - 4 * s, 20 * s, 4 * s, { fill: '#DB2777' }),
    path(`M${cx} ${cy - 13 * s} c${-8 * s} ${-8 * s} ${-12 * s} ${2 * s} 0 0 c${8 * s} ${-8 * s} ${12 * s} ${2 * s} 0 0`, { fill: '#F472B6', stroke: '#9D174D', strokeWidth: 0.8 }),
    ellipse(cx - 5 * s, cy - 6 * s, 2 * s, 4 * s, { fill: '#FFFFFF', opacity: 0.5 }),
  ];
}

/** The chocolate bunny car (target car skin): its ears lying back on the roof, a gold ribbon and bell, whiskers, a cotton tail */
function bunnyCar(color: string): ArtShape[] {
  const ear = (y: number, side: number) => [
    path(`M126 ${y} Q104 ${y - side * 16} 46 ${y - side * 7} Q34 ${y} 46 ${y + side * 7} Q104 ${y + side * 12} 126 ${y} Z`, { fill: light(color, 0.12), stroke: dark(color, 0.5), strokeWidth: 1 }),
    path(`M118 ${y} Q98 ${y - side * 9} 54 ${y - side * 3.5} Q46 ${y} 54 ${y + side * 3.5} Q98 ${y + side * 6} 118 ${y} Z`, { fill: '#F9A8D4' }),
  ];
  return [
    ...car(color),
    ...ear(34, 1), ...ear(66, -1),
    // The gold ribbon round its neck, and the bell
    path('M150 14 L156 14 L156 86 L150 86 Z', { fill: 'url(#foil)' }),
    path('M156 50 c10 -12 16 -2 0 0 c10 12 16 2 0 0 Z', { fill: 'url(#foil)', stroke: '#92400E', strokeWidth: 0.8 }),
    circle(162, 50, 4, { fill: 'url(#bell)', stroke: '#92400E', strokeWidth: 0.6 }),
    // Nose and whiskers on the front
    ellipse(193, 50, 3.5, 5, { fill: '#F472B6' }),
    ...[-1, 1].flatMap(side => [line(190, 50 + side * 4, 176, 50 + side * 16, { stroke: '#FDE68A', strokeWidth: 0.8 }), line(190, 50 + side * 3, 172, 50 + side * 9, { stroke: '#FDE68A', strokeWidth: 0.8 })]),
    // Cotton tail
    ...[[0, 0, 7], [-3, -4, 4], [-3, 4, 4], [2, -5, 3.5], [2, 5, 3.5]].map(([dx, dy, r]) => circle(9 + dx, 50 + dy, r, { fill: '#FFFFFF', stroke: '#E5E7EB', strokeWidth: 0.6 })),
  ];
}

/** The painted egg car (2 cells): an egg-shaped body, painted, a glass bubble */
function eggCar(color: string): ArtShape[] {
  const outline = dark(color, 0.5);
  const accent = light(color, 0.65);
  const band = (x: number) => path(`M${x} 14 L${x} 86`, { stroke: accent, strokeWidth: 6 });
  return [
    ellipse(106, 56, 94, 40, { fill: SHADOW, opacity: 0.3 }),
    ...tires([50, 150]),
    path('M10 50 C10 18 60 10 110 10 C170 10 196 30 196 50 C196 70 170 90 110 90 C60 90 10 82 10 50 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    band(46), band(150),
    path(`M${[60, 70, 80, 90, 100].map((x, i) => `${x} ${i % 2 ? 26 : 19}`).join(' L')}`, { fill: 'none', stroke: accent, strokeWidth: 2.5 }),
    path(`M${[60, 70, 80, 90, 100].map((x, i) => `${x} ${i % 2 ? 74 : 81}`).join(' L')}`, { fill: 'none', stroke: accent, strokeWidth: 2.5 }),
    ...[[30, 32], [30, 68], [170, 30], [170, 70], [24, 50]].map(([x, y]) => circle(x, y, 3.4, { fill: accent })),
    ellipse(100, 50, 30, 24, { fill: 'url(#glass)', stroke: outline, strokeWidth: 1 }),
    ellipse(92, 42, 8, 5, { fill: '#FFFFFF', opacity: 0.3 }),
    rect(186, 22, 7, 11, { rx: 3, fill: HEADLIGHT }), rect(186, 67, 7, 11, { rx: 3, fill: HEADLIGHT }),
    rect(10, 30, 4, 10, { rx: 2, fill: TAILLIGHT }), rect(10, 60, 4, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** The van carrying a wicker basket of eggs on straw (3 cells) */
function basketVan(color: string): ArtShape[] {
  const weave = Array.from({ length: 12 }, (_, i) => line(16 + i * 16.5, 14, 16 + i * 16.5, 86, { stroke: '#7C4A26', strokeWidth: 1, opacity: 0.5 }));
  const rand = rng(405);
  const straw = Array.from({ length: 30 }, () => {
    const x = 20 + rand() * 180;
    const y = 22 + rand() * 56;
    return line(x, y, x + (rand() - 0.5) * 16, y + (rand() - 0.5) * 10, { stroke: '#FDE68A', strokeWidth: 1.4, strokeLinecap: 'round' });
  });
  const eggs = [[34, 34, -20], [40, 64, 15], [66, 48, 80], [92, 30, -60], [96, 68, 30], [124, 48, 95], [150, 30, 10], [152, 68, -25], [182, 46, 60]];
  return [
    ...van(color, 'url(#wicker)'),
    ...weave,
    ...straw,
    ...eggs.flatMap(([x, y, deg], i) => paintedEgg(x, y, 10, 13, EGGS[i % EGGS.length], i, deg)),
    rect(12, 46, 198, 8, { rx: 3, fill: '#92400E', opacity: 0.25 }),
    ...paintedEgg(231, 50, 9, 11, '#F472B6', 1, 90),
  ];
}

const gradients = (color: string) => vehicleGradients(color, [
  { id: 'foil', stops: [{ offset: 0, color: '#FDE68A' }, { offset: 0.5, color: '#F59E0B' }, { offset: 1, color: '#B45309' }] },
  { id: 'bell', radial: true, stops: [{ offset: 0, color: '#FEF3C7' }, { offset: 0.6, color: '#FACC15' }, { offset: 1, color: '#B45309' }] },
  { id: 'wicker', stops: [{ offset: 0, color: '#A16207' }, { offset: 0.5, color: '#D6A86A' }, { offset: 1, color: '#A16207' }] },
]);

/** The chocolate bunny car of the target car, front on the right (2 cells) */
export function bunnyDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: bunnyCar(color) };
}

/** A vehicle of the Easter palette: the painted egg car for 2 cells, the basket van for 3 or more */
export function eggVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? basketVan(color) : eggCar(color) };
}

// ─── Win effect: eggs and bells ───────────────────────────────────────────────

const effectGradients = gradients('#FFFFFF').filter(g => g.id === 'foil' || g.id === 'bell');

/** The drawings of the Easter effect: painted eggs, chocolate eggs and a flying bell */
export const EASTER_DRAWINGS: ArtDrawing[] = [
  { width: 30, height: 40, gradients: [], shapes: paintedEgg(15, 20, 12, 17, '#F472B6', 0) },
  { width: 30, height: 40, gradients: effectGradients, shapes: chocolateEgg(15, 20, 12, 17) },
  { width: 30, height: 40, gradients: [], shapes: paintedEgg(15, 20, 12, 17, '#60A5FA', 1) },
  { width: 50, height: 40, gradients: effectGradients, shapes: flyingBell(25, 22, 1) },
  { width: 30, height: 40, gradients: [], shapes: paintedEgg(15, 20, 12, 17, '#FACC15', 2) },
  { width: 30, height: 40, gradients: [], shapes: paintedEgg(15, 20, 12, 17, '#4ADE80', 0) },
];

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A butterfly, s times its size */
const butterfly = (x: number, y: number, s: number, color: string): ArtShape[] => [
  ellipse(x - 6 * s, y - 4 * s, 6 * s, 5 * s, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.8 }),
  ellipse(x + 6 * s, y - 4 * s, 6 * s, 5 * s, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.8 }),
  ellipse(x - 4.5 * s, y + 4 * s, 4 * s, 3.5 * s, { fill: light(color, 0.3), stroke: dark(color, 0.35), strokeWidth: 0.8 }),
  ellipse(x + 4.5 * s, y + 4 * s, 4 * s, 3.5 * s, { fill: light(color, 0.3), stroke: dark(color, 0.35), strokeWidth: 0.8 }),
  rect(x - 1 * s, y - 7 * s, 2 * s, 14 * s, { rx: s, fill: '#1F2937' }),
];

/** A tulip on its stem, its foot at (x, ground) */
const tulip = (x: number, ground: number, k: number, color: string): ArtShape[] => [
  line(x, ground, x, ground - 22 * k, { stroke: '#15803D', strokeWidth: 2 * k }),
  path(`M${x} ${ground - 6 * k} q${-9 * k} ${-4 * k} ${-8 * k} ${-14 * k} q${4 * k} ${6 * k} ${8 * k} ${10 * k} Z`, { fill: '#22C55E' }),
  path(`M${x - 6 * k} ${ground - 22 * k} L${x - 6 * k} ${ground - 32 * k} L${x - 2 * k} ${ground - 28 * k} L${x} ${ground - 33 * k} L${x + 2 * k} ${ground - 28 * k} L${x + 6 * k} ${ground - 32 * k} L${x + 6 * k} ${ground - 22 * k} Q${x} ${ground - 17 * k} ${x - 6 * k} ${ground - 22 * k} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8 }),
];

/** A daisy of radius r */
const daisy = (x: number, y: number, r: number): ArtShape[] => [
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.45, r * 0.22, { fill: '#FFFFFF', transform: `rotate(${(a * 180) / Math.PI} ${x + Math.cos(a) * r * 0.6} ${y + Math.sin(a) * r * 0.6})` });
  }),
  circle(x, y, r * 0.32, { fill: '#FACC15' }),
];

export function easterBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(405);
  const ground = h - 36 * u;
  const hill = `M0 ${h} L0 ${ground - 6 * u} Q${w * 0.3} ${ground - 32 * u} ${w * 0.6} ${ground - 6 * u} Q${w * 0.82} ${ground + 12 * u} ${w} ${ground - 18 * u} L${w} ${h} Z`;
  const far = `M0 ${h} L0 ${ground - 44 * u} Q${w * 0.35} ${ground - 72 * u} ${w * 0.65} ${ground - 40 * u} Q${w * 0.85} ${ground - 20 * u} ${w} ${ground - 52 * u} L${w} ${h} Z`;
  const grass = Array.from({ length: Math.round(w / (6 * u)) }, (_, i) => {
    const x = i * 6 * u + rand() * 3 * u;
    const y = ground + (rand() * 26 + 4) * u;
    return path(`M${x} ${y} l${1.5 * u} ${-7 * u} l${1.5 * u} ${7 * u}`, { fill: darkScheme ? '#166534' : '#16A34A', opacity: 0.7 });
  });
  // The bunny peeking out from behind the hill, on the right
  const bx = w * 0.82;
  const by = ground - 4 * u;
  const bunnyColor = darkScheme ? '#D6D3D1' : '#F5F5F4';
  const bunny = [
    ellipse(bx - 7 * u, by - 26 * u, 5 * u, 15 * u, { fill: bunnyColor, stroke: '#A8A29E', strokeWidth: 1, transform: `rotate(-12 ${bx - 7 * u} ${by - 26 * u})` }),
    ellipse(bx - 7 * u, by - 26 * u, 2.4 * u, 11 * u, { fill: '#F9A8D4', transform: `rotate(-12 ${bx - 7 * u} ${by - 26 * u})` }),
    ellipse(bx + 8 * u, by - 26 * u, 5 * u, 15 * u, { fill: bunnyColor, stroke: '#A8A29E', strokeWidth: 1, transform: `rotate(14 ${bx + 8 * u} ${by - 26 * u})` }),
    ellipse(bx + 8 * u, by - 26 * u, 2.4 * u, 11 * u, { fill: '#F9A8D4', transform: `rotate(14 ${bx + 8 * u} ${by - 26 * u})` }),
    ellipse(bx, by - 6 * u, 14 * u, 12 * u, { fill: bunnyColor, stroke: '#A8A29E', strokeWidth: 1 }),
    circle(bx - 5 * u, by - 9 * u, 1.8 * u, { fill: '#1F2937' }),
    circle(bx + 5 * u, by - 9 * u, 1.8 * u, { fill: '#1F2937' }),
    ellipse(bx, by - 4 * u, 2.2 * u, 1.6 * u, { fill: '#F472B6' }),
  ];
  const sun = darkScheme
    ? [circle(w - 36 * u, 58 * u, 60 * u, { fill: 'url(#glow)' }), circle(w - 36 * u, 58 * u, 20 * u, { fill: '#F1F5F9' }), circle(w - 30 * u, 52 * u, 18 * u, { fill: '#1E2A4A' })]
    : [
      circle(w - 36 * u, 58 * u, 70 * u, { fill: 'url(#glow)' }),
      ...Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return line(w - 36 * u + Math.cos(a) * 30 * u, 58 * u + Math.sin(a) * 30 * u, w - 36 * u + Math.cos(a) * 40 * u, 58 * u + Math.sin(a) * 40 * u, { stroke: '#FACC15', strokeWidth: 3 * u, strokeLinecap: 'round' });
      }),
      circle(w - 36 * u, 58 * u, 24 * u, { fill: '#FDE047', stroke: '#F59E0B', strokeWidth: 1.5 }),
    ];
  const middle = (CALM_TOP + 40) * u;
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#1B2340' }, { offset: 0.6, color: '#1E2A4A' }, { offset: 1, color: '#1A2E2A' }]
        : [{ offset: 0, color: '#DCEFFC' }, { offset: 0.6, color: '#EFF8FD' }, { offset: 1, color: '#FDF8E4' }] },
      { id: 'glow', radial: true, stops: [{ offset: 0, color: darkScheme ? '#E2E8F0' : '#FDE68A', opacity: darkScheme ? 0.25 : 0.55 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
      { id: 'bell', radial: true, stops: [{ offset: 0, color: '#FEF3C7' }, { offset: 0.6, color: '#FACC15' }, { offset: 1, color: '#B45309' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...sun,
      // Bells flying back from Rome and butterflies, in the margins
      ...flyingBell(20 * u, middle + 30 * u, 0.9 * u),
      ...flyingBell(w - 22 * u, h * 0.5, 0.8 * u),
      ...butterfly(16 * u, h * 0.56, 0.9 * u, '#F472B6'),
      ...butterfly(w - 16 * u, middle + 10 * u, 0.8 * u, '#A78BFA'),
      ...butterfly(18 * u, h * 0.72, 0.7 * u, '#FACC15'),
      ...butterfly(w - 18 * u, h * 0.7, 0.75 * u, '#60A5FA'),
      path(far, { fill: darkScheme ? '#14532D' : '#BBF7D0', opacity: darkScheme ? 0.6 : 1 }),
      ...bunny,
      path(hill, { fill: darkScheme ? '#166534' : '#4ADE80' }),
      ...grass,
      ...tulip(w * 0.06, ground + 14 * u, 0.9 * u, '#F43F5E'),
      ...tulip(w * 0.12, ground + 18 * u, 0.75 * u, '#FACC15'),
      ...tulip(w * 0.93, ground + 12 * u, 0.85 * u, '#A78BFA'),
      ...daisy(w * 0.36, ground + 14 * u, 6 * u), ...daisy(w * 0.56, ground + 22 * u, 5 * u), ...daisy(w * 0.72, ground + 10 * u, 5 * u),
      // Eggs hidden in the grass
      ...paintedEgg(w * 0.22, ground + 10 * u, 7 * u, 9 * u, EGGS[0], 0, -15),
      ...paintedEgg(w * 0.46, ground + 18 * u, 6 * u, 8 * u, EGGS[1], 1, 20),
      ...paintedEgg(w * 0.64, ground + 6 * u, 6.5 * u, 8.5 * u, EGGS[2], 2, -10),
      ...paintedEgg(w * 0.86, ground + 20 * u, 7 * u, 9 * u, EGGS[4], 0, 12),
    ],
  };
}
