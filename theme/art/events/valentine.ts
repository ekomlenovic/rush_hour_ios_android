import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, heart, tires, van, vehicleGradients } from './vehicleKit';

/**
 * Valentine's Day: the wedding car of the target car (skin), the car with a heart sunroof (2 cells) and the van
 * full of roses (3 cells) of the palette, the hearts of its win effect and the backdrop of its board: heart bunting,
 * hearts floating in the margins and a hedge of roses.
 */

const ROSES = ['#BE123C', '#E11D48', '#F472B6', '#FB7185', '#FDA4AF'];
const LEAF = '#15803D';

/** A rose seen from above: its petals curling toward the heart */
function rose(cx: number, cy: number, r: number, color: string): ArtShape[] {
  const edge = dark(color, 0.4);
  return [
    circle(cx + r * 0.15, cy + r * 0.2, r, { fill: SHADOW, opacity: 0.25 }),
    circle(cx, cy, r, { fill: color, stroke: edge, strokeWidth: Math.max(0.6, r * 0.08) }),
    path(`M${cx - r * 0.7} ${cy} A${r * 0.7} ${r * 0.7} 0 0 1 ${cx + r * 0.6} ${cy - r * 0.2} A${r * 0.5} ${r * 0.5} 0 0 1 ${cx} ${cy + r * 0.5} A${r * 0.3} ${r * 0.3} 0 0 1 ${cx - r * 0.2} ${cy - r * 0.1}`,
      { fill: 'none', stroke: edge, strokeWidth: Math.max(0.6, r * 0.09), strokeLinecap: 'round' }),
    circle(cx - r * 0.3, cy - r * 0.35, r * 0.18, { fill: '#FFFFFF', opacity: 0.35 }),
  ];
}

/** A leaf, its tip toward (dx, dy) */
const leaf = (x: number, y: number, dx: number, dy: number, color = LEAF): ArtShape =>
  path(`M${x} ${y} Q${x + dx / 2 - dy / 3} ${y + dy / 2 + dx / 3} ${x + dx} ${y + dy} Q${x + dx / 2 + dy / 3} ${y + dy / 2 - dx / 3} ${x} ${y} Z`, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.6 });

/** A bow of ribbon at (x, y), k times its size */
const bow = (x: number, y: number, k: number, color: string): ArtShape[] => [
  path(`M${x} ${y} C${x - 10 * k} ${y - 12 * k} ${x - 14 * k} ${y + 6 * k} ${x} ${y} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8 }),
  path(`M${x} ${y} C${x - 10 * k} ${y + 12 * k} ${x + 6 * k} ${y + 14 * k} ${x} ${y} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8 }),
  path(`M${x} ${y} C${x + 12 * k} ${y - 10 * k} ${x + 14 * k} ${y + 8 * k} ${x} ${y} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8 }),
  circle(x, y, 2.4 * k, { fill: dark(color, 0.15) }),
];

/** The wedding car (target car skin): ribbons on the hood, a bouquet on the roof, cans tied behind */
function weddingCar(color: string): ArtShape[] {
  const outline = dark(color, 0.45);
  const ribbon = '#F472B6';
  const can = (x: number, y: number): ArtShape[] => [
    line(x + 10, y, 30, 50 + (y - 50) * 0.3, { stroke: '#D1D5DB', strokeWidth: 0.8 }),
    rect(x, y - 5, 11, 10, { rx: 2, fill: 'url(#chrome)', stroke: '#6B7280', strokeWidth: 0.7 }),
    ellipse(x, y, 1.6, 5, { fill: '#9CA3AF' }),
  ];
  return [
    rect(34, 16, 164, 82, { rx: 22, fill: SHADOW, opacity: 0.3 }),
    ...tires([70, 160]),
    ...can(3, 26), ...can(6, 50), ...can(2, 74),
    path('M48 12 L170 12 Q196 14 197 50 Q196 86 170 88 L48 88 Q30 86 30 50 Q30 14 48 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    path('M128 18 L150 23 Q157 50 150 77 L128 82 Z', { fill: 'url(#glass)' }),
    rect(64, 18, 64, 64, { rx: 10, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M50 24 L64 21 L64 79 L50 76 Q45 50 50 24 Z', { fill: 'url(#glass)' }),
    // Ribbons from the windshield to a bow on the front
    path('M152 22 Q172 34 186 50 M152 78 Q172 66 186 50', { fill: 'none', stroke: ribbon, strokeWidth: 3.2, strokeLinecap: 'round' }),
    ...bow(184, 50, 1, ribbon),
    // The bouquet on the roof
    ...[[-14, -10], [8, 8], [-4, 14], [-12, 10], [12, -12]].map(([dx, dy]) => leaf(96, 50, dx * 1.6, dy * 1.6)),
    ...[[96, 50, 9, 0], [86, 42, 7, 1], [106, 44, 7, 2], [88, 58, 7, 3], [105, 58, 6.5, 4]].flatMap(([x, y, r, c]) => rose(x, y, r, ROSES[c])),
    // Hearts on the trunk
    heart(42, 34, 5, { fill: '#F472B6' }, 'right'), heart(42, 66, 5, { fill: '#E11D48' }, 'right'),
    rect(186, 17, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(186, 70, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(31, 22, 4, 11, { rx: 2, fill: TAILLIGHT }),
    rect(31, 67, 4, 11, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** A car with a heart sunroof (2 cells), a small heart on its hood */
function heartCar(color: string): ArtShape[] {
  return [
    ...car(color),
    heart(86, 50, 24, { fill: 'url(#glass)', stroke: dark(color, 0.5), strokeWidth: 1.5 }, 'right'),
    path('M72 38 Q78 30 88 32', { fill: 'none', stroke: '#FFFFFF', strokeWidth: 2, opacity: 0.35, strokeLinecap: 'round' }),
    heart(170, 50, 8, { fill: light(color, 0.6), stroke: dark(color, 0.3), strokeWidth: 0.8 }, 'right'),
  ];
}

/** A van full of roses (3 cells), a heart on the roof of its cab */
function roseVan(color: string): ArtShape[] {
  const rand = rng(214);
  const flowers: ArtShape[] = [];
  const leaves: ArtShape[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      const x = 24 + col * 21.5 + (row % 2 ? 6 : 0) + (rand() - 0.5) * 4;
      const y = 26 + row * 24 + (rand() - 0.5) * 4;
      if (x > 206) continue;
      leaves.push(leaf(x, y, 12 - rand() * 24, 12));
      flowers.push(...rose(x, y, 8.5 + rand() * 1.5, ROSES[(row + col * 2) % ROSES.length]));
    }
  }
  return [
    ...van(color, '#14532D'),
    ...leaves,
    ...flowers,
    heart(231, 50, 9, { fill: '#F43F5E', stroke: '#881337', strokeWidth: 0.8 }, 'right'),
  ];
}

const gradients = (color: string) => vehicleGradients(color);

/** The wedding car of the target car, front on the right (2 cells) */
export function weddingDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: weddingCar(color) };
}

/** A vehicle of the Valentine palette: the heart sunroof car for 2 cells, the van of roses for 3 or more */
export function loversVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? roseVan(color) : heartCar(color) };
}

// ─── Win effect: hearts ───────────────────────────────────────────────────────

const heartSprite = (color: string): ArtDrawing => ({
  width: 40, height: 40, gradients: [],
  shapes: [
    heart(20, 21, 17, { fill: color, stroke: dark(color, 0.35), strokeWidth: 1.4 }),
    ellipse(12, 14, 4.5, 3, { fill: '#FFFFFF', opacity: 0.6, transform: 'rotate(-35 12 14)' }),
  ],
});

/** The drawings of the hearts effect, red to pink */
export const HEART_DRAWINGS: ArtDrawing[] = ['#E11D48', '#F472B6', '#BE123C', '#FB7185', '#DB2777'].map(heartSprite);

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A little four-point sparkle */
const sparkle = (x: number, y: number, r: number, color: string, opacity: number): ArtShape =>
  path(`M${x} ${y - r} Q${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y} Q${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r} Q${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y} Q${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r} Z`, { fill: color, opacity });

export function valentineBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(214);
  // Heart bunting along the very top: a thin string, a small heart every 22
  const count = Math.max(2, Math.round(w / (110 * u)));
  const swag = w / count;
  const sag = 8 * u;
  const bunting = Array.from({ length: count }, (_, i) => {
    const x0 = i * swag;
    const n = Math.max(2, Math.round(swag / (22 * u)));
    const hearts = Array.from({ length: n }, (_, j) => {
      const f = (j + 0.5) / n;
      const y = sag * 4 * f * (1 - f);
      return heart(x0 + f * swag, y + 7 * u, 4.6 * u, { fill: ['#E11D48', '#F9A8D4', '#F43F5E', darkScheme ? '#FFE4E6' : '#FFFFFF'][(i + j) % 4], stroke: '#9F1239', strokeWidth: 0.5 });
    });
    return [path(`M${x0} 0 Q${x0 + swag / 2} ${sag * 2} ${x0 + swag} 0`, { fill: 'none', stroke: darkScheme ? '#FDA4AF' : '#BE123C', strokeWidth: 1.2 }), ...hearts];
  }).flat();
  // Hearts floating along both sides, under the texts
  const side = (x: number, y: number, r: number, i: number): ArtShape =>
    i % 3 === 2
      ? heart(x, y, r, { fill: 'none', stroke: darkScheme ? '#FDA4AF' : '#F472B6', strokeWidth: 1.6 * u, opacity: 0.8 })
      : heart(x, y, r, { fill: ['#F43F5E', '#F9A8D4'][i % 2], opacity: darkScheme ? 0.75 : 0.85 });
  const floating = Array.from({ length: Math.max(4, Math.round((h - (CALM_TOP + 140) * u) / (44 * u))) }, (_, i) => {
    const y = (CALM_TOP + 20) * u + i * 44 * u + rand() * 14 * u;
    const left = i % 2 === 0;
    const r = (6 + rand() * 7) * u;
    return side(left ? (10 + rand() * 10) * u : w - (10 + rand() * 10) * u, y, r, i);
  });
  const sparkles = Array.from({ length: 10 }, (_, i) => sparkle(i % 2 ? w - (6 + rand() * 24) * u : (6 + rand() * 24) * u, (CALM_TOP + rand() * (h / u - CALM_TOP - 100)) * u, (2.5 + rand() * 3) * u, darkScheme ? '#FDE68A' : '#F59E0B', 0.6));
  // A hedge of roses along the bottom
  const ground = h - 30 * u;
  const bumps = Math.max(4, Math.round(w / (34 * u)));
  const top = Array.from({ length: bumps }, (_, i) => {
    const x = ((i + 1) / bumps) * w;
    return `Q${x - w / bumps / 2} ${ground - (22 + rand() * 10) * u} ${x} ${ground - (8 + rand() * 6) * u}`;
  }).join(' ');
  const hedgeRoses = Array.from({ length: Math.round(w / (16 * u)) }, (_, i) => {
    const x = (i + 0.5) * 16 * u + (rand() - 0.5) * 6 * u;
    const y = ground - (4 + rand() * 18) * u + 4 * u;
    return rose(x, y, (4 + rand() * 2.5) * u, ROSES[i % ROSES.length]);
  }).flat();
  const hedgeLeaves = Array.from({ length: Math.round(w / (9 * u)) }, (_, i) => {
    const x = i * 9 * u + rand() * 4 * u;
    const y = ground - (6 + rand() * 16) * u;
    return leaf(x, y, (rand() - 0.5) * 14 * u, -8 * u, darkScheme ? '#166534' : '#22C55E');
  });
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#2A0F1F' }, { offset: 0.6, color: '#200B19' }, { offset: 1, color: '#170812' }]
        : [{ offset: 0, color: '#FFE4EE' }, { offset: 0.6, color: '#FFF1F6' }, { offset: 1, color: '#FDE2EA' }] },
      { id: 'blush', radial: true, stops: [{ offset: 0, color: '#F472B6', opacity: darkScheme ? 0.22 : 0.18 }, { offset: 1, color: '#F472B6', opacity: 0 }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      circle(0, h * 0.55, 140 * u, { fill: 'url(#blush)' }),
      circle(w, h * 0.35, 140 * u, { fill: 'url(#blush)' }),
      ...sparkles,
      ...floating,
      path(`M0 ${h} L0 ${ground - 10 * u} ${top} L${w} ${h} Z`, { fill: darkScheme ? '#14532D' : '#15803D' }),
      ...hedgeLeaves,
      ...hedgeRoses,
      ...bunting,
    ],
  };
}
